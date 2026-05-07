/**
 * fix-game-minter.js
 *
 * Checks if the game proxy is set as gameMinter on TycoonRewardSystem.
 * If not, calls setGameMinter(gameProxy) using the owner's private key.
 *
 * Usage:
 *   node scripts/fix-game-minter.js
 */

const path = require("path");
const fs = require("fs");

// Load .env from contract/
const envPath = path.resolve(__dirname, "../.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const { ethers } = require("../../minipay_frontend/node_modules/ethers");

const GAME_PROXY    = process.env.TYCOON_PROXY_ADDRESS;
const REWARD_SYSTEM = process.env.TYCOON_REWARD_SYSTEM || "0x9728c4f405F8b4180dE56160Fb2F122F77C4C158";
const RPC_URL       = process.env.RPC_URL;
const PRIVATE_KEY   = process.env.PRIVATE_KEY;

const REWARD_ABI = [
  "function owner() view returns (address)",
  "function gameMinter() view returns (address)",
  "function setGameMinter(address newGameMinter)",
];

async function main() {
  if (!GAME_PROXY || !RPC_URL || !PRIVATE_KEY) {
    console.error("❌  Missing: PRIVATE_KEY, RPC_URL, TYCOON_PROXY_ADDRESS in .env");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  const reward   = new ethers.Contract(REWARD_SYSTEM, REWARD_ABI, signer);

  const signerAddr  = await signer.getAddress();
  const rewardOwner = await reward.owner();
  const gameMinter  = await reward.gameMinter();

  console.log("\n🔍  Current state");
  console.log("  Reward system  :", REWARD_SYSTEM);
  console.log("  Owner          :", rewardOwner);
  console.log("  Signer         :", signerAddr);
  console.log("  gameMinter now :", gameMinter);
  console.log("  Game proxy     :", GAME_PROXY);

  if (gameMinter.toLowerCase() === GAME_PROXY.toLowerCase()) {
    console.log("\n✅  gameMinter is already set correctly. registerPlayer should work.\n");
    return;
  }

  if (signerAddr.toLowerCase() !== rewardOwner.toLowerCase()) {
    console.error(`\n❌  Signer (${signerAddr}) is not the reward system owner (${rewardOwner}). Use the owner's private key.\n`);
    process.exit(1);
  }

  console.log("\n⚙️   Setting gameMinter to game proxy...");
  const tx = await reward.setGameMinter(GAME_PROXY, { gasLimit: 100000 });
  console.log("  tx hash:", tx.hash);
  await tx.wait();
  console.log("  ✅  Confirmed.");

  const updated = await reward.gameMinter();
  console.log("  gameMinter now:", updated);
  console.log("\n✅  Done. registerPlayer will now work.\n");
}

main().catch((e) => {
  console.error("\n❌", e.reason || e.message);
  process.exit(1);
});
