/**
 * chaos.js — interact with all 3 Tycoon contracts on Celo mainnet
 *
 * Reads from:
 *   - TycoonUpgradeable (game proxy)
 *   - TycoonRewardSystem (reward contract)
 *   - TycoonUserRegistry (user registry)
 *
 * Writes (owner-only calls using PRIVATE_KEY from .env):
 *   - setMinStake on game proxy
 *   - setMinTurnsForPerks on game proxy
 *   - setBackendMinter on reward system (sets to GAME_CONTROLLER)
 *
 * Usage:
 *   node scripts/chaos.js
 *
 * Requires .env in contract/ with:
 *   PRIVATE_KEY, RPC_URL, TYCOON_PROXY_ADDRESS, TYCOON_REWARD_SYSTEM (or uses README address),
 *   TYCOON_USER_REGISTRY_ADDRESS, GAME_CONTROLLER
 */

const path = require("path");
const fs = require("fs");

// Load .env from contract/
const envPath = path.resolve(__dirname, "../.env");
const envLines = fs.readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const { ethers } = require("../../minipay_frontend/node_modules/ethers");

// ── Addresses ────────────────────────────────────────────────────────────────
const GAME_PROXY     = process.env.TYCOON_PROXY_ADDRESS;
const REWARD_SYSTEM  = process.env.TYCOON_REWARD_SYSTEM   || "0x9728c4f405F8b4180dE56160Fb2F122F77C4C158";
const USER_REGISTRY  = process.env.TYCOON_USER_REGISTRY_ADDRESS;
const GAME_CTRL      = process.env.GAME_CONTROLLER;
const RPC_URL        = process.env.RPC_URL;
const PRIVATE_KEY    = process.env.PRIVATE_KEY;

// ── Minimal ABIs ─────────────────────────────────────────────────────────────
const GAME_ABI = [
  "function totalUsers() view returns (uint256)",
  "function totalGames() view returns (uint256)",
  "function minStake() view returns (uint256)",
  "function minTurnsForPerks() view returns (uint256)",
  "function backendGameController() view returns (address)",
  "function userRegistry() view returns (address)",
  "function rewardSystem() view returns (address)",
  "function logicContract() view returns (address)",
  "function owner() view returns (address)",
  "function setMinStake(uint256 newMinStake)",
  "function setMinTurnsForPerks(uint256 newMin)",
];

const REWARD_ABI = [
  "function owner() view returns (address)",
  "function backendMinter() view returns (address)",
  "function gameMinter() view returns (address)",
  "function tycToken() view returns (address)",
  "function usdc() view returns (address)",
  "function paused() view returns (bool)",
  "function setBackendMinter(address newMinter)",
];

const REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function gameContract() view returns (address)",
  "function rewardSystemAddress() view returns (address)",
  "function operator() view returns (address)",
  "function totalWallets() view returns (uint256)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const sep  = () => console.log("─".repeat(60));
const head = (t) => { sep(); console.log(`  ${t}`); sep(); };
const ok   = (k, v) => console.log(`  ✅  ${k.padEnd(28)} ${v}`);
const warn = (k, v) => console.log(`  ⚠️   ${k.padEnd(28)} ${v}`);
const tx   = (k, h) => console.log(`  🔗  ${k.padEnd(28)} ${h}`);

async function main() {
  console.log("\n🎲  TYCOON CHAOS SCRIPT — Celo Mainnet\n");

  if (!GAME_PROXY || !USER_REGISTRY || !RPC_URL || !PRIVATE_KEY) {
    console.error("❌  Missing env vars. Need: PRIVATE_KEY, RPC_URL, TYCOON_PROXY_ADDRESS, TYCOON_USER_REGISTRY_ADDRESS");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  const signerAddr = await signer.getAddress();

  const network = await provider.getNetwork();
  const balance = await provider.getBalance(signerAddr);

  head("🌐  Network & Wallet");
  ok("Chain ID",    network.chainId);
  ok("Signer",      signerAddr);
  ok("CELO balance", ethers.utils.formatEther(balance) + " CELO");

  // ── Contract instances ────────────────────────────────────────────────────
  const game     = new ethers.Contract(GAME_PROXY,    GAME_ABI,     signer);
  const reward   = new ethers.Contract(REWARD_SYSTEM, REWARD_ABI,   signer);
  const registry = new ethers.Contract(USER_REGISTRY, REGISTRY_ABI, signer);

  // ── 1. Read: Game Proxy ───────────────────────────────────────────────────
  head("📋  TycoonUpgradeable (Game Proxy)");
  ok("Address",          GAME_PROXY);

  const [
    totalUsers, totalGames, minStake, minTurns,
    controller, regAddr, rewardAddr, logicAddr, gameOwner
  ] = await Promise.all([
    game.totalUsers(),
    game.totalGames(),
    game.minStake(),
    game.minTurnsForPerks(),
    game.backendGameController(),
    game.userRegistry(),
    game.rewardSystem(),
    game.logicContract(),
    game.owner(),
  ]);

  ok("Owner",             gameOwner);
  ok("Total users",       totalUsers.toString());
  ok("Total games",       totalGames.toString());
  ok("Min stake (USDC)",  minStake.toString() + " (raw)");
  ok("Min turns for perks", minTurns.toString());
  ok("Backend controller", controller);
  ok("User registry",     regAddr);
  ok("Reward system",     rewardAddr);
  ok("Logic contract",    logicAddr);

  if (logicAddr === ethers.constants.AddressZero) {
    warn("Logic contract", "NOT SET — createGame/joinGame will revert!");
  }

  // ── 2. Read: Reward System ────────────────────────────────────────────────
  head("🏆  TycoonRewardSystem");
  ok("Address",          REWARD_SYSTEM);

  const [
    rewardOwner, backendMinter, gameMinter,
    tycToken, usdcToken, isPaused
  ] = await Promise.all([
    reward.owner(),
    reward.backendMinter(),
    reward.gameMinter(),
    reward.tycToken(),
    reward.usdc(),
    reward.paused(),
  ]);

  ok("Owner",            rewardOwner);
  ok("Backend minter",   backendMinter);
  ok("Game minter",      gameMinter);
  ok("TYC token",        tycToken);
  ok("USDC token",       usdcToken);
  ok("Paused",           isPaused ? "⛔ YES" : "✅ No");

  if (gameMinter.toLowerCase() !== GAME_PROXY.toLowerCase()) {
    warn("Game minter mismatch", `expected ${GAME_PROXY}`);
  }

  // ── 3. Read: User Registry ────────────────────────────────────────────────
  head("👤  TycoonUserRegistry");
  ok("Address",          USER_REGISTRY);

  const [
    regOwner, regGame, regReward, regOperator, totalWallets
  ] = await Promise.all([
    registry.owner(),
    registry.gameContract(),
    registry.rewardSystemAddress(),
    registry.operator(),
    registry.totalWallets().catch(() => "N/A"),
  ]);

  ok("Owner",            regOwner);
  ok("Game contract",    regGame);
  ok("Reward system",    regReward);
  ok("Operator",         regOperator);
  ok("Total wallets",    totalWallets.toString());

  if (regGame.toLowerCase() !== GAME_PROXY.toLowerCase()) {
    warn("Registry game mismatch", `expected ${GAME_PROXY}`);
  }
  if (regReward.toLowerCase() !== REWARD_SYSTEM.toLowerCase()) {
    warn("Registry reward mismatch", `expected ${REWARD_SYSTEM}`);
  }

  // ── 4. Write: only if signer is owner ────────────────────────────────────
  head("✍️   Write Calls (owner-only)");

  const isGameOwner   = signerAddr.toLowerCase() === gameOwner.toLowerCase();
  const isRewardOwner = signerAddr.toLowerCase() === rewardOwner.toLowerCase();

  if (!isGameOwner && !isRewardOwner) {
    warn("Signer is not owner", "Skipping all write calls");
  }

  // 4a. setMinStake — keep current value (no-op to confirm call works)
  if (isGameOwner) {
    const currentMinStake = minStake;
    console.log(`\n  → setMinStake(${currentMinStake}) on game proxy (no-op, same value)...`);
    try {
      const t = await game.setMinStake(currentMinStake, { gasLimit: 100000 });
      await t.wait();
      tx("setMinStake tx", t.hash);
    } catch (e) {
      warn("setMinStake failed", e.reason || e.message?.slice(0, 80));
    }

    // 4b. setMinTurnsForPerks — keep current value
    const currentMinTurns = minTurns;
    console.log(`\n  → setMinTurnsForPerks(${currentMinTurns}) on game proxy (no-op, same value)...`);
    try {
      const t = await game.setMinTurnsForPerks(currentMinTurns, { gasLimit: 100000 });
      await t.wait();
      tx("setMinTurnsForPerks tx", t.hash);
    } catch (e) {
      warn("setMinTurnsForPerks failed", e.reason || e.message?.slice(0, 80));
    }
  }

  // 4c. setBackendMinter on reward system — set to GAME_CONTROLLER if different
  if (isRewardOwner && GAME_CTRL) {
    const currentMinter = backendMinter.toLowerCase();
    const targetMinter  = GAME_CTRL.toLowerCase();
    if (currentMinter !== targetMinter) {
      console.log(`\n  → setBackendMinter(${GAME_CTRL}) on reward system...`);
      try {
        const t = await reward.setBackendMinter(GAME_CTRL, { gasLimit: 100000 });
        await t.wait();
        tx("setBackendMinter tx", t.hash);
      } catch (e) {
        warn("setBackendMinter failed", e.reason || e.message?.slice(0, 80));
      }
    } else {
      ok("setBackendMinter", "already correct, skipped");
    }
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  head("📊  Summary");
  ok("Game proxy",       GAME_PROXY);
  ok("Reward system",    REWARD_SYSTEM);
  ok("User registry",    USER_REGISTRY);
  ok("Users on-chain",   totalUsers.toString());
  ok("Games on-chain",   totalGames.toString());
  ok("Wallets created",  totalWallets.toString());
  sep();
  console.log("\n✅  Done.\n");
}

main().catch((e) => {
  console.error("\n❌  Fatal:", e.message || e);
  process.exit(1);
});
