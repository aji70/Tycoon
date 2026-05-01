/**
 * update-perk-stable-prices.js
 *
 * Reads every collectible tokenId held by the reward contract (shop stock),
 * then calls updateCollectiblePrices(tokenId, tycPrice, usdcPrice, usdcPrice, usdcPrice)
 * so CUSDC and USDT prices match USDC — fixing the "Not for sale" revert on those tokens.
 *
 * Usage:
 *   node backend/scripts/update-perk-stable-prices.js
 *
 * Requires in backend/.env (or environment):
 *   CELO_RPC_URL=https://forno.celo.org
 *   TYCOON_OWNER_PRIVATE_KEY=0x...        (owner / backendMinter of the reward contract)
 *   REWARD_CONTRACT_ADDRESS=0x...         (or TYCOON_REWARD_SYSTEM)
 */

import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, formatUnits } from 'ethers';

const RPC_URL =
  process.env.CELO_RPC_URL ||
  process.env.CELO_RPC ||
  'https://forno.celo.org';

const PRIVATE_KEY =
  process.env.TYCOON_OWNER_PRIVATE_KEY ||
  process.env.REWARD_STOCK_MINTER_PRIVATE_KEY ||
  process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;

const CONTRACT_ADDRESS =
  process.env.REWARD_CONTRACT_ADDRESS ||
  process.env.TYCOON_REWARD_SYSTEM;

if (!PRIVATE_KEY) {
  console.error('ERROR: Set TYCOON_OWNER_PRIVATE_KEY in backend/.env');
  process.exit(1);
}
if (!CONTRACT_ADDRESS) {
  console.error('ERROR: Set REWARD_CONTRACT_ADDRESS or TYCOON_REWARD_SYSTEM in backend/.env');
  process.exit(1);
}

const ABI = [
  // reads
  {
    type: 'function', name: 'tokenOfOwnerByIndex',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getCollectibleInfoExtended',
    inputs: [{ type: 'uint256' }],
    outputs: [
      { type: 'uint8' },   // perk
      { type: 'uint256' }, // strength
      { type: 'uint256' }, // tycPrice
      { type: 'uint256' }, // usdcPrice
      { type: 'uint256' }, // cusdcPrice
      { type: 'uint256' }, // usdtPrice
      { type: 'uint256' }, // stock
    ],
    stateMutability: 'view',
  },
  // write — 5-param version with cusdc + usdt
  {
    type: 'function', name: 'updateCollectiblePrices',
    inputs: [
      { name: 'tokenId',      type: 'uint256' },
      { name: 'newTycPrice',  type: 'uint256' },
      { name: 'newUsdcPrice', type: 'uint256' },
      { name: 'newCusdcPrice',type: 'uint256' },
      { name: 'newUsdtPrice', type: 'uint256' },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
];

const COLLECTIBLE_BASE = 2_000_000_000n;
const SCAN_CAP = 120;

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  const wallet = new Wallet(pk, provider);
  const contract = new Contract(CONTRACT_ADDRESS, ABI, wallet);

  console.log(`\nReward contract : ${CONTRACT_ADDRESS}`);
  console.log(`Signer          : ${wallet.address}`);
  console.log(`RPC             : ${RPC_URL}\n`);

  // 1. Scan all tokenIds held by the contract (shop stock)
  console.log('Scanning shop stock...');
  const collectibleIds = [];
  for (let i = 0; i < SCAN_CAP; i++) {
    let tid;
    try {
      tid = await contract.tokenOfOwnerByIndex(CONTRACT_ADDRESS, BigInt(i));
    } catch {
      break; // no more tokens
    }
    if (tid >= COLLECTIBLE_BASE) {
      collectibleIds.push(tid);
    }
  }

  if (collectibleIds.length === 0) {
    console.log('No collectible tokenIds found in shop stock. Nothing to update.');
    console.log('Make sure REWARD_CONTRACT_ADDRESS points to the correct deployed contract.');
    process.exit(0);
  }

  console.log(`Found ${collectibleIds.length} collectible(s) in shop.\n`);

  // 2. For each, read current prices and update CUSDC + USDT to match USDC
  let updated = 0;
  let skipped = 0;

  for (const tokenId of collectibleIds) {
    let info;
    try {
      info = await contract.getCollectibleInfoExtended(tokenId);
    } catch (err) {
      console.warn(`  tokenId ${tokenId}: getCollectibleInfoExtended failed — ${err.message}`);
      continue;
    }

    const [perk, strength, tycPrice, usdcPrice, cusdcPrice, usdtPrice, stock] = info;

    console.log(
      `tokenId ${tokenId} | perk=${perk} str=${strength} | ` +
      `usdc=${formatUnits(usdcPrice, 6)} cusdc=${formatUnits(cusdcPrice, 6)} usdt=${formatUnits(usdtPrice, 6)} | stock=${stock}`
    );

    // Skip if CUSDC and USDT are already set correctly
    if (cusdcPrice === usdcPrice && usdtPrice === usdcPrice) {
      console.log(`  → already correct, skipping.\n`);
      skipped++;
      continue;
    }

    if (usdcPrice === 0n) {
      console.log(`  → usdcPrice is 0, skipping (perk has no USDC price set).\n`);
      skipped++;
      continue;
    }

    try {
      console.log(`  → updating CUSDC + USDT to ${formatUnits(usdcPrice, 6)}...`);
      const tx = await contract.updateCollectiblePrices(
        tokenId,
        tycPrice,
        usdcPrice,
        usdcPrice, // cusdcPrice = same as usdc
        usdcPrice  // usdtPrice  = same as usdc
      );
      console.log(`  → tx sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  → confirmed in block ${receipt.blockNumber}\n`);
      updated++;
    } catch (err) {
      console.error(`  → FAILED: ${err.message}\n`);
    }
  }

  console.log('─────────────────────────────────');
  console.log(`Done. Updated: ${updated} | Skipped: ${skipped} | Total: ${collectibleIds.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
