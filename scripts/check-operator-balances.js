/**
 * Print native CELO balance for every CELO_OPERATOR_WALLET_PRIVATE_KEYS account.
 *
 *   NODE_PATH=./frontend/node_modules node scripts/check-operator-balances.js
 */

const { createPublicClient, http, formatEther } = require('viem');
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

const rawKeys = (process.env.CELO_OPERATOR_WALLET_PRIVATE_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k.length >= 32);
if (!rawKeys.length) {
  throw new Error('Set CELO_OPERATOR_WALLET_PRIVATE_KEYS in contract/.env');
}

const pub = createPublicClient({ chain: celo, transport: http(RPC) });

async function main() {
  let total = 0n;
  const rows = [];

  for (let i = 0; i < rawKeys.length; i++) {
    const k = rawKeys[i];
    const account = privateKeyToAccount(k.startsWith('0x') ? k : `0x${k}`);
    const balance = await pub.getBalance({ address: account.address });
    total += balance;
    rows.push({
      n: i + 1,
      address: account.address,
      celo: formatEther(balance),
    });
  }

  const w = Math.max(...rows.map((r) => r.celo.length), 4);
  console.log(`#${' '.repeat(2)}Address${' '.repeat(34)}CELO`);
  console.log('-'.repeat(56));
  for (const r of rows) {
    console.log(
      `${String(r.n).padStart(2)}  ${r.address}  ${r.celo.padStart(w)}`
    );
  }
  console.log('-'.repeat(56));
  console.log(`Wallets: ${rows.length}`);
  console.log(`Total:   ${formatEther(total)} CELO`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
