/**
 * Fund all CELO_OPERATOR_WALLET_PRIVATE_KEYS accounts with native CELO from Tycoon owner.
 *
 * Uses CeloBatchNativeDistributor when CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS is set;
 * otherwise sends one transfer per wallet from the owner EOA.
 *
 * Run from repo root:
 *   NODE_PATH=./frontend/node_modules node scripts/fund-operator-wallets.js
 *
 * Optional env:
 *   AMOUNT_CELO=1          (default 1)
 *   DRY_RUN=true           (print plan only)
 *   CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS=0x...  (default: mainnet deploy)
 */

const { createWalletClient, createPublicClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { celo } = require('viem/chains');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../contract/.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) return;
    const key = match[1];
    const val = match[2].trim().split(/\s/)[0];
    if (key && val && !process.env[key]) process.env[key] = val;
  });
}

const RPC = process.env.RPC_URL || 'https://forno.celo.org';
const DISTRIBUTOR =
  process.env.CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS ||
  '0xe1131a26014349417698ac3fd8b51b84852847a8';
const AMOUNT_CELO = process.env.AMOUNT_CELO || '1';
const DRY_RUN = process.env.DRY_RUN === 'true';

const rawKeys = (process.env.CELO_OPERATOR_WALLET_PRIVATE_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k.length >= 32);
if (!rawKeys.length) {
  throw new Error('Set CELO_OPERATOR_WALLET_PRIVATE_KEYS in contract/.env');
}

const accounts = rawKeys.map((k) => privateKeyToAccount(k.startsWith('0x') ? k : `0x${k}`));
const recipients = accounts.map((a) => a.address);

const ownerRaw =
  process.env.TYCOON_OWNER_PRIVATE_KEY ||
  process.env.OWNER_KEY ||
  process.env.PRIVATE_KEY;
if (!ownerRaw) {
  throw new Error('Set PRIVATE_KEY (Tycoon owner) in contract/.env');
}
const ownerAccount = privateKeyToAccount(
  ownerRaw.startsWith('0x') ? ownerRaw : `0x${ownerRaw}`
);

const amountWei = parseEther(AMOUNT_CELO);
const totalWei = amountWei * BigInt(recipients.length);

const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const ownerWallet = createWalletClient({
  account: ownerAccount,
  chain: celo,
  transport: http(RPC),
});

const DISTRIBUTOR_ABI = [
  {
    name: 'distribute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
];

async function fundViaBatch() {
  const amounts = recipients.map(() => amountWei);
  const hash = await ownerWallet.writeContract({
    address: DISTRIBUTOR,
    abi: DISTRIBUTOR_ABI,
    functionName: 'distribute',
    args: [recipients, amounts],
    value: totalWei,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

async function fundViaTransfers() {
  const hashes = [];
  for (let i = 0; i < recipients.length; i++) {
    const hash = await ownerWallet.sendTransaction({
      to: recipients[i],
      value: amountWei,
    });
    await pub.waitForTransactionReceipt({ hash });
    hashes.push(hash);
    console.log(`  [${i + 1}/${recipients.length}] ${recipients[i]} tx ${hash}`);
  }
  return hashes;
}

async function main() {
  const ownerBalance = await pub.getBalance({ address: ownerAccount.address });
  const tycoonOwnerEnv = process.env.TYCOON_OWNER;

  console.log(`Owner:     ${ownerAccount.address}`);
  if (tycoonOwnerEnv) {
    const match =
      tycoonOwnerEnv.toLowerCase() === ownerAccount.address.toLowerCase();
    console.log(`TYCOON_OWNER env: ${tycoonOwnerEnv} ${match ? '✓' : '⚠ mismatch'}`);
  }
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Per wallet: ${AMOUNT_CELO} CELO`);
  console.log(`Total:      ${formatEther(totalWei)} CELO`);
  console.log(`Owner bal:  ${formatEther(ownerBalance)} CELO`);
  console.log(`Mode:       ${DRY_RUN ? 'DRY_RUN' : 'LIVE'}`);
  console.log(`Method:     ${DISTRIBUTOR} (batch distributor)\n`);

  if (ownerBalance < totalWei) {
    throw new Error(
      `Owner balance ${formatEther(ownerBalance)} CELO < required ${formatEther(totalWei)} CELO`
    );
  }

  if (DRY_RUN) {
    recipients.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });
    return;
  }

  const code = await pub.getBytecode({ address: DISTRIBUTOR });
  if (!code || code === '0x') {
    console.warn('Batch distributor has no code; falling back to individual transfers.');
    await fundViaTransfers();
    return;
  }

  console.log('Sending batch distribute...');
  const { hash, receipt } = await fundViaBatch();
  console.log(`Done. tx ${hash} status ${receipt.status}`);

  console.log('\nBalances after:');
  for (let i = 0; i < Math.min(recipients.length, 5); i++) {
    const bal = await pub.getBalance({ address: recipients[i] });
    console.log(`  ${recipients[i]}: ${formatEther(bal)} CELO`);
  }
  if (recipients.length > 5) {
    console.log(`  ... and ${recipients.length - 5} more`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
