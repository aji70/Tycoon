/**
 * register.js — register a player on-chain using a private key
 *
 * Usage:
 *   PRIVATE_KEY=0x... USERNAME=myname node scripts/register.js
 *
 * Or set PRIVATE_KEY + USERNAME in contract/.env and just run:
 *   node scripts/register.js
 */

const path = require("path");
const fs   = require("fs");

// Load .env
for (const line of fs.readFileSync(path.resolve(__dirname, "../.env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const { ethers } = require("../../minipay_frontend/node_modules/ethers");

const GAME_PROXY  = process.env.TYCOON_PROXY_ADDRESS;
const RPC_URL     = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const USERNAME    = process.env.USERNAME || process.argv[2];

const ABI = [
  "function registerPlayer(string username) returns (uint256)",
  "function registered(address) view returns (bool)",
  "function addressToUsername(address) view returns (string)",
  "function users(string) view returns (uint256,string,address,uint64,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)",
];

async function main() {
  if (!GAME_PROXY || !RPC_URL || !PRIVATE_KEY) {
    console.error("❌  Missing PRIVATE_KEY, RPC_URL, or TYCOON_PROXY_ADDRESS in .env");
    process.exit(1);
  }
  if (!USERNAME) {
    console.error("❌  Provide a username: USERNAME=myname node scripts/register.js");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  const game     = new ethers.Contract(GAME_PROXY, ABI, signer);
  const addr     = await signer.getAddress();
  const balance  = await provider.getBalance(addr);

  console.log("\n🎲  Tycoon — Register Player");
  console.log("  Address  :", addr);
  console.log("  Username :", USERNAME);
  console.log("  CELO bal :", ethers.utils.formatEther(balance), "CELO");
  console.log("  Contract :", GAME_PROXY);

  // Pre-flight checks
  const alreadyRegistered = await game.registered(addr);
  if (alreadyRegistered) {
    const existing = await game.addressToUsername(addr);
    console.log(`\n⚠️   Address already registered as "${existing}". Nothing to do.\n`);
    return;
  }

  const [,, takenBy] = await game.users(USERNAME);
  if (takenBy !== ethers.constants.AddressZero) {
    console.error(`\n❌  Username "${USERNAME}" is already taken by ${takenBy}\n`);
    process.exit(1);
  }

  if (balance.eq(0)) {
    console.error("\n❌  No CELO balance — can't pay network fee.\n");
    process.exit(1);
  }

  console.log("\n⚙️   Sending registerPlayer tx...");
  const tx = await game.registerPlayer(USERNAME, { gasLimit: 500000 });
  console.log("  tx hash  :", tx.hash);
  console.log("  Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("  ✅  Confirmed in block", receipt.blockNumber);
  console.log("\n🎉  Registered! Username:", USERNAME, "| Address:", addr, "\n");
}

main().catch((e) => {
  const reason = e.reason || e.error?.reason || e.message?.split("\n")[0];
  console.error("\n❌  Failed:", reason, "\n");
  process.exit(1);
});
