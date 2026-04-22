/**
 * Celo-only admin operator tools: EOAs in CELO_OPERATOR_WALLET_PRIVATE_KEYS (or legacy CELO_BOT_FARM_PRIVATE_KEYS)
 * call registerPlayer / createAIGame on-chain. Gated by CELO_OPERATOR_TOOLS_ENABLED (or legacy CELO_BOT_FARM_ENABLED).
 */
import { Contract, Interface, JsonRpcProvider, Network, Wallet, ZeroAddress, formatEther, parseEther } from "ethers";
import { getChainConfig } from "../config/chains.js";
import logger from "../config/logger.js";

const CHAIN = "CELO";

const TYCOON_IFACE = new Interface([
  "function registered(address) view returns (bool)",
  "function registerPlayer(string username) returns (uint256)",
  "function createAIGame(string creatorUsername, string gameType, string playerSymbol, uint8 numberOfAI, string code, uint256 startingBalance) returns (uint256)",
]);

const DISTRIBUTOR_IFACE = new Interface([
  "function distribute(address[] recipients, uint256[] amounts) payable",
]);

/** Light ping: standard ERC-20 calls only (no mint — operator EOAs are not minters). */
const ERC20_LIGHT_IFACE = new Interface([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
]);

/** DashRunner proxy: `dashStep()` increments `dashSteps(msg.sender)`; `dashSteps(address)` is the public mapping getter (view). */
const DASHRUNNER_PING_IFACE = new Interface([
  "function dashStep() external",
  "function dashSteps(address) view returns (uint64)",
]);

const TYCOON_REWARD_READ_ABI = ["function rewardSystem() view returns (address)"];
const REWARD_SYSTEM_TYC_READ_ABI = ["function tycToken() view returns (address)"];

/**
 * TYC ERC20 for operator light-ping: env vars first, else `game.rewardSystem().tycToken()` (same token as shop).
 * @returns {Promise<{ address: string, source: "env" | "onchain" } | null>}
 */
async function resolveLightPingTycAddress(cfg, provider, gameProxyAddress) {
  const fromEnv = cfg.tycTokenAddress?.trim();
  if (fromEnv) return { address: fromEnv, source: "env" };

  if (!gameProxyAddress) return null;
  try {
    const tycoon = new Contract(gameProxyAddress, TYCOON_REWARD_READ_ABI, provider);
    const rsAddr = await tycoon.rewardSystem();
    if (!rsAddr || rsAddr === ZeroAddress) return null;
    const reward = new Contract(rsAddr, REWARD_SYSTEM_TYC_READ_ABI, provider);
    const tyc = await reward.tycToken();
    if (!tyc || tyc === ZeroAddress) return null;
    return { address: String(tyc), source: "onchain" };
  } catch (e) {
    logger.warn({ err: e?.message }, "resolveLightPingTycAddress: on-chain read failed");
    return null;
  }
}

function isOperatorToolsEnabled() {
  const v =
    process.env.CELO_OPERATOR_TOOLS_ENABLED ?? process.env.CELO_BOT_FARM_ENABLED;
  return v === "1" || String(v).toLowerCase() === "true";
}

function parsePrivateKeys() {
  const raw =
    process.env.CELO_OPERATOR_WALLET_PRIVATE_KEYS ?? process.env.CELO_BOT_FARM_PRIVATE_KEYS;
  if (raw == null || String(raw).trim() === "") return [];
  return String(raw)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pk) => (pk.startsWith("0x") ? pk : `0x${pk}`));
}

function getReadContext() {
  const cfg = getChainConfig(CHAIN);
  if (!cfg.rpcUrl || !cfg.contractAddress) {
    throw new Error("CELO_RPC_URL and TYCOON_CELO_CONTRACT_ADDRESS are required for Celo operator tools");
  }
  const chainId = cfg.chainId || 42220;
  const network = new Network("celo", chainId);
  // Many operator wallets in parallel each trigger nonce RPCs; default ethers batching
  // merges them into one HTTP JSON-RPC array — some providers reject that (-32062 "Batch size too large").
  const provider = new JsonRpcProvider(cfg.rpcUrl, network, { staticNetwork: network, batchMaxCount: 1 });
  return { provider, contractAddress: cfg.contractAddress, cfg };
}

export function assertOperatorToolsEnabled() {
  if (!isOperatorToolsEnabled()) {
    const err = new Error(
      "Celo operator tools are disabled. Set CELO_OPERATOR_TOOLS_ENABLED=true (or legacy CELO_BOT_FARM_ENABLED) and CELO_OPERATOR_WALLET_PRIVATE_KEYS (or legacy CELO_BOT_FARM_PRIVATE_KEYS)."
    );
    err.code = "CELO_OPERATOR_DISABLED";
    throw err;
  }
  const keys = parsePrivateKeys();
  if (keys.length === 0) {
    const err = new Error(
      "No operator wallet keys configured. Set CELO_OPERATOR_WALLET_PRIVATE_KEYS (or legacy CELO_BOT_FARM_PRIVATE_KEYS)."
    );
    err.code = "CELO_OPERATOR_NO_KEYS";
    throw err;
  }
}

export function getOperatorWalletsFromEnv() {
  const keys = parsePrivateKeys();
  const { provider } = getReadContext();
  return keys.map((pk) => new Wallet(pk, provider));
}

/** Same wallets as env order, re-sorted by native CELO balance descending (highest first) for funding-heavy ops. */
export async function getOperatorWalletsSortedByBalanceDesc() {
  const wallets = getOperatorWalletsFromEnv();
  const { provider } = getReadContext();
  const rows = await Promise.all(
    wallets.map(async (w) => {
      let balanceWei = 0n;
      try {
        balanceWei = await provider.getBalance(w.address);
      } catch (_) {}
      return { wallet: w, balanceWei };
    })
  );
  rows.sort((a, b) => {
    if (b.balanceWei > a.balanceWei) return 1;
    if (b.balanceWei < a.balanceWei) return -1;
    return String(a.wallet.address).localeCompare(String(b.wallet.address));
  });
  return rows.map((r) => r.wallet);
}

/** On-chain username derived from address (unique, short, valid length). */
export function defaultOperatorUsername(address) {
  const a = String(address).toLowerCase().replace(/^0x/, "");
  const u = `bf_${a.slice(0, 10)}`;
  return u.length > 32 ? u.slice(0, 32) : u;
}

export async function getOperatorToolsStatus() {
  const { provider, contractAddress, cfg } = getReadContext();
  const keys = parsePrivateKeys();
  const distributor = process.env.CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS?.trim() || null;
  const tycResolved = await resolveLightPingTycAddress(cfg, provider, contractAddress);
  const tycTok = tycResolved?.address ?? null;
  const usdcTok = cfg.usdcAddress?.trim();
  const lightPingTokenAddress = tycTok || usdcTok || null;
  const lightPingTokenSymbol = tycTok ? "TYC" : usdcTok ? "USDC" : null;
  const tycoonRead = new Contract(contractAddress, TYCOON_IFACE, provider);
  const wallets = [];
  for (const pk of keys) {
    const w = new Wallet(pk, provider);
    let registered = false;
    try {
      registered = await tycoonRead.registered(w.address);
    } catch (e) {
      logger.warn({ err: e?.message, address: w.address }, "celoOperatorTools registered() failed");
    }
    let balanceWei = 0n;
    try {
      balanceWei = await provider.getBalance(w.address);
    } catch (_) {}
    wallets.push({
      address: w.address,
      registered,
      balanceWei: balanceWei.toString(),
      balanceCelo: formatEther(balanceWei),
      suggestedUsername: defaultOperatorUsername(w.address),
    });
  }
  wallets.sort((a, b) => {
    const ba = BigInt(a.balanceWei);
    const bb = BigInt(b.balanceWei);
    if (bb > ba) return 1;
    if (bb < ba) return -1;
    return String(a.address).localeCompare(String(b.address));
  });
  return {
    enabled: isOperatorToolsEnabled(),
    chain: CHAIN,
    contractAddress,
    distributorAddress: distributor,
    lightPingTokenAddress,
    lightPingTokenSymbol,
    lightPingTycResolvedFrom: tycResolved?.source ?? null,
    dashRunnerContractAddress: cfg.dashRunnerContractAddress ?? null,
    walletCount: wallets.length,
    wallets,
  };
}

/**
 * Encode calldata for CeloBatchNativeDistributor.distribute with equal wei per recipient.
 * @returns {{ to: string, data: string, valueWei: string, valueCelo: string, recipients: string[], amountsWei: string[] }}
 */
export function encodeDistributorFundEqual(recipients, weiPerRecipient) {
  const to = process.env.CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS?.trim();
  if (!to) {
    throw new Error("Set CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS to the deployed distributor contract");
  }
  const w = BigInt(weiPerRecipient);
  if (w <= 0n) throw new Error("weiPerRecipient must be positive");
  const amounts = recipients.map(() => w);
  const sum = w * BigInt(recipients.length);
  const data = DISTRIBUTOR_IFACE.encodeFunctionData("distribute", [recipients, amounts]);
  return {
    to,
    data,
    valueWei: sum.toString(),
    valueCelo: formatEther(sum),
    recipients,
    amountsWei: amounts.map((a) => a.toString()),
  };
}

async function sleep(ms) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

/** Max concurrent operator wallets when "parallel" is on (avoids provider -32090 / rate limits). Override: CELO_OPERATOR_MAX_PARALLEL_WALLETS */
function getMaxParallelWalletsForPing() {
  const n = Number(process.env.CELO_OPERATOR_MAX_PARALLEL_WALLETS);
  if (Number.isFinite(n) && n >= 1) return Math.min(32, Math.floor(n));
  return 4;
}

function isRpcRateLimitError(err) {
  const s = formatEthersSendError(err).toLowerCase();
  return (
    s.includes("rate limit") ||
    s.includes("-32090") ||
    s.includes("too many requests") ||
    s.includes("exhausted") ||
    s.includes(" 429")
  );
}

/** Retry transient RPC / HTTP rate limits (e.g. Ankr -32090). */
async function withRpcRetry(fn, { maxAttempts = 8 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = isRpcRateLimitError(err);
      if (!retryable || attempt === maxAttempts - 1) throw err;
      let waitMs = 1500 * 2 ** attempt;
      const msg = formatEthersSendError(err);
      const m = msg.match(/retry in\s+(\d+)\s*s/i);
      if (m) waitMs = Math.max(waitMs, Number(m[1]) * 1000 + 250);
      waitMs = Math.min(waitMs, 90_000);
      logger.warn({ attempt: attempt + 1, waitMs, snippet: msg.slice(0, 160) }, "celoOperatorTools RPC backoff");
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

/**
 * When parallelWallets is true, run at most maxParallel wallets at a time (still parallel within each chunk).
 * @param {import("ethers").Wallet[]} wallets
 * @param {boolean} parallelWallets
 * @param {number} maxParallel
 * @param {(w: import("ethers").Wallet) => Promise<unknown[]>} worker
 * @param {number} [interChunkDelayMs]
 */
async function runPingAcrossWalletsLimited(wallets, parallelWallets, maxParallel, worker, interChunkDelayMs = 500) {
  if (!parallelWallets || wallets.length <= 1) {
    const out = [];
    for (const w of wallets) out.push(...(await worker(w)));
    return out;
  }
  const chunkSize = Math.max(1, Math.min(maxParallel, wallets.length));
  const out = [];
  for (let i = 0; i < wallets.length; i += chunkSize) {
    const chunk = wallets.slice(i, i + chunkSize);
    const parts = await Promise.all(chunk.map((w) => worker(w)));
    for (const p of parts) out.push(...p);
    if (i + chunkSize < wallets.length && interChunkDelayMs > 0) await sleep(interChunkDelayMs);
  }
  return out;
}

/**
 * When the RPC returns odd bodies (429/HTML, gateway errors), ethers may only expose
 * "could not coalesce error". Pull nested JSON-RPC / HTTP hints for debugging.
 * @param {unknown} err
 * @returns {string}
 */
function formatEthersSendError(err) {
  if (err == null) return "unknown error";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const e = /** @type {Record<string, unknown>} */ (err);
  const parts = [];
  const push = (s) => {
    if (s == null) return;
    const t = typeof s === "string" ? s.trim() : String(s).trim();
    if (t && !parts.includes(t)) parts.push(t);
  };
  push(e.shortMessage);
  push(e.reason);
  push(e.code);
  if (e.message != null && e.message !== e.shortMessage) push(String(e.message));
  try {
    if (e.info != null && typeof e.info === "object") {
      const info = /** @type {Record<string, unknown>} */ (e.info);
      if (info.error != null) push(JSON.stringify(info.error));
      else push(JSON.stringify(info));
    }
  } catch {
    push(String(e.info));
  }
  if (e.error != null && e.error !== e.info) {
    try {
      push(typeof e.error === "string" ? e.error : JSON.stringify(e.error));
    } catch {
      push(String(e.error));
    }
  }
  if (e.cause) push(`cause: ${formatEthersSendError(e.cause)}`);
  const out = parts.join(" | ");
  return out || String(e.message || err);
}

export async function registerAllOperatorWallets(options = {}) {
  assertOperatorToolsEnabled();
  const delayMs = Math.max(0, Number(options.delayMs) || 0);
  const { provider, contractAddress } = getReadContext();
  const wallets = await getOperatorWalletsSortedByBalanceDesc();
  const results = [];
  for (const w of wallets) {
    const username = defaultOperatorUsername(w.address);
    const tycoon = new Contract(contractAddress, TYCOON_IFACE, w);
    try {
      const reg = await new Contract(contractAddress, TYCOON_IFACE, provider).registered(w.address);
      if (reg) {
        results.push({ address: w.address, skipped: true, reason: "already_registered" });
        await sleep(delayMs);
        continue;
      }
      const tx = await tycoon.registerPlayer(username);
      const receipt = await tx.wait();
      results.push({ address: w.address, username, hash: receipt?.hash, ok: true });
      logger.info({ address: w.address, hash: receipt?.hash }, "celoOperatorTools registerPlayer");
    } catch (err) {
      logger.error({ err: err?.message, address: w.address }, "celoOperatorTools registerPlayer failed");
      results.push({
        address: w.address,
        username,
        ok: false,
        error: formatEthersSendError(err),
      });
    }
    await sleep(delayMs);
  }
  return { results };
}

export async function createAIGamesForAllOperatorWallets(options = {}) {
  assertOperatorToolsEnabled();
  const delayMs = Math.max(0, Number(options.delayMs) || 0);
  const gamesPerWallet = Math.max(1, Math.min(50, Number(options.gamesPerWallet) || 1));
  const startingBalance = BigInt(options.startingBalance ?? 1500);
  const gameType = String(options.gameType || "PRIVATE").toUpperCase();
  const playerSymbol = String(options.playerSymbol || "hat").toLowerCase();
  const numberOfAI = Math.max(1, Math.min(7, Number(options.numberOfAI) || 1));

  if (gameType !== "PUBLIC" && gameType !== "PRIVATE") {
    throw new Error('gameType must be "PUBLIC" or "PRIVATE"');
  }

  const { provider, contractAddress } = getReadContext();
  const wallets = await getOperatorWalletsSortedByBalanceDesc();
  const results = [];

  for (const w of wallets) {
    const username = defaultOperatorUsername(w.address);
    const tycoonRead = new Contract(contractAddress, TYCOON_IFACE, provider);
    const reg = await tycoonRead.registered(w.address);
    if (!reg) {
      results.push({ address: w.address, skipped: true, reason: "not_registered" });
      await sleep(delayMs);
      continue;
    }
    const tycoon = new Contract(contractAddress, TYCOON_IFACE, w);
    for (let g = 0; g < gamesPerWallet; g++) {
      const code = `g${Date.now().toString(36)}${w.address.slice(2, 6)}${g}`.slice(0, 16);
      try {
        const tx = await tycoon.createAIGame(username, gameType, playerSymbol, numberOfAI, code, startingBalance);
        const receipt = await tx.wait();
        results.push({ address: w.address, code, hash: receipt?.hash, ok: true });
        logger.info({ address: w.address, code, hash: receipt?.hash }, "celoOperatorTools createAIGame");
      } catch (err) {
        logger.error({ err: err?.message, address: w.address, code }, "celoOperatorTools createAIGame failed");
        results.push({
          address: w.address,
          code,
          ok: false,
          error: formatEthersSendError(err),
        });
      }
      await sleep(delayMs);
    }
  }
  return { results, gamesPerWallet, startingBalance: startingBalance.toString(), gameType, playerSymbol, numberOfAI };
}

export function parseWeiFromCeloString(celoStr) {
  const s = String(celoStr || "").trim();
  if (!s) throw new Error("amount required");
  return parseEther(s);
}

/**
 * Each operator wallet sends a short sequence of **cheap ERC-20 txs** on TYC (preferred) or USDC:
 * rotates `approve(game,0)`, `transfer(self,0)`, `transfer(game,0)` so calldata / selectors vary (RPC + explorer noise).
 * No token balance required. Mint is not used (operators are not token minters).
 *
 * Prefers **TYC**: env (`CELO_TYC_TOKEN_ADDRESS` / `TYCOON_CELO_TYC` / `TYCOON_CELO_TOKEN`), else reads `rewardSystem().tycToken()` from the game proxy. **USDC** only if TYC cannot be resolved.
 *
 * @param {object} [options]
 * @param {number} [options.delayMs] Delay after each step for this wallet (nonce ordering).
 * @param {number} [options.approvalsPerWallet] 1–100; default 1. **Steps** per wallet (name kept for API compatibility); each step is one of the rotated calls above.
 * @param {boolean} [options.parallelWallets] If true (default when approvalsPerWallet > 1), run all wallets concurrently; if false, one wallet at a time.
 */
export async function lightTokenApproveGameZeroFromAllOperatorWallets(options = {}) {
  assertOperatorToolsEnabled();
  const delayMs = Math.max(0, Number(options.delayMs) || 0);
  const approvalsPerWallet = Math.max(1, Math.min(100, Number(options.approvalsPerWallet) || 1));
  const parallelWalletsExplicit = options.parallelWallets;
  const parallelWallets =
    parallelWalletsExplicit !== undefined && parallelWalletsExplicit !== null
      ? Boolean(parallelWalletsExplicit)
      : approvalsPerWallet > 1;

  const { provider, contractAddress, cfg } = getReadContext();
  const tycResolved = await resolveLightPingTycAddress(cfg, provider, contractAddress);
  const tycAddr = tycResolved?.address ?? null;
  const usdcAddr = cfg.usdcAddress?.trim();
  const tokenAddr = tycAddr || usdcAddr;
  const tokenSymbol = tycAddr ? "TYC" : "USDC";
  if (!tokenAddr) {
    throw new Error(
      "Could not resolve TYC (set CELO_TYC_TOKEN_ADDRESS / TYCOON_CELO_TYC, or fix game proxy rewardSystem) and CELO_USDC_ADDRESS / USDC_ADDRESS is unset"
    );
  }
  const wallets = await getOperatorWalletsSortedByBalanceDesc();

  async function stepsForWallet(w) {
    const token = new Contract(tokenAddr, ERC20_LIGHT_IFACE, w);
    const game = contractAddress;
    const out = [];
    for (let i = 0; i < approvalsPerWallet; i++) {
      const phase = i % 3;
      let method;
      try {
        const receipt = await withRpcRetry(async () => {
          let tx;
          if (phase === 0) {
            tx = await token.approve(game, 0n);
            method = `${tokenSymbol}.approve(game,0)`;
          } else if (phase === 1) {
            tx = await token.transfer(w.address, 0n);
            method = `${tokenSymbol}.transfer(self,0)`;
          } else {
            tx = await token.transfer(game, 0n);
            method = `${tokenSymbol}.transfer(game,0)`;
          }
          return tx.wait();
        });
        out.push({
          address: w.address,
          stepIndex: i,
          approveIndex: i,
          hash: receipt?.hash,
          ok: true,
          method,
        });
        logger.info(
          { address: w.address, stepIndex: i, hash: receipt?.hash, tokenSymbol, method },
          "celoOperatorTools light chain ping step"
        );
      } catch (err) {
        logger.error({ err: err?.message, address: w.address, stepIndex: i, phase }, "celoOperatorTools light chain ping failed");
        out.push({
          address: w.address,
          stepIndex: i,
          approveIndex: i,
          ok: false,
          error: formatEthersSendError(err),
        });
        break;
      }
      await sleep(delayMs);
    }
    return out;
  }

  const maxParallel = getMaxParallelWalletsForPing();
  const results = await runPingAcrossWalletsLimited(wallets, parallelWallets, maxParallel, stepsForWallet, 500);

  return {
    results,
    approvalsPerWallet,
    stepsPerWallet: approvalsPerWallet,
    parallelWallets,
    maxParallelWallets: parallelWallets ? maxParallel : 1,
    walletCount: wallets.length,
    totalAttempts: results.length,
    totalOk: results.filter((r) => r.ok).length,
    tokenAddress: tokenAddr,
    tokenSymbol,
    tycResolvedFrom: tycResolved?.source ?? null,
    spenderGame: contractAddress,
    stepPattern: "rotate: approve(game,0) → transfer(self,0) → transfer(game,0)",
    note: tycAddr
      ? `TYC (${tycResolved?.source ?? "?"}) — low-footprint ERC-20 mix (no mint). For load / RPC checks only. When parallel is on, at most ${maxParallel} wallets run at once (CELO_OPERATOR_MAX_PARALLEL_WALLETS).`
      : `USDC fallback — same step pattern; TYC was not found via env or rewardSystem().tycToken(). When parallel is on, at most ${maxParallel} wallets run at once (CELO_OPERATOR_MAX_PARALLEL_WALLETS).`,
  };
}

/**
 * Each operator wallet calls **DashRunner.dashStep()** on the Celo DashRunner proxy (increments `dashSteps[msg.sender]`).
 * After each wallet’s successful batch, reads **`dashSteps(address)`** (public mapping getter) for that wallet for the log.
 *
 * Configure proxy: `CELO_DASHRUNNER_CONTRACT_ADDRESS` or `DASHRUNNER_CELO_CONTRACT_ADDRESS`.
 *
 * @param {object} [options]
 * @param {number} [options.delayMs]
 * @param {number} [options.stepsPerWallet] 1–100; default 1. Same name as light ping body field `approvalsPerWallet` when sent from admin UI.
 * @param {boolean} [options.parallelWallets]
 */
export async function dashRunnerDashStepPingFromAllOperatorWallets(options = {}) {
  assertOperatorToolsEnabled();
  const delayMs = Math.max(0, Number(options.delayMs) || 0);
  const rawSteps = Number(options.stepsPerWallet ?? options.approvalsPerWallet);
  const stepsPerWallet = Math.max(1, Math.min(100, Number.isFinite(rawSteps) ? rawSteps : 1));
  const parallelWalletsExplicit = options.parallelWallets;
  const parallelWallets =
    parallelWalletsExplicit !== undefined && parallelWalletsExplicit !== null
      ? Boolean(parallelWalletsExplicit)
      : stepsPerWallet > 1;

  const { provider, cfg } = getReadContext();
  const dashAddr = cfg.dashRunnerContractAddress?.trim();
  if (!dashAddr) {
    throw new Error(
      "DashRunner proxy not configured. Set CELO_DASHRUNNER_CONTRACT_ADDRESS (or DASHRUNNER_CELO_CONTRACT_ADDRESS) to the DashRunner ERC1967 proxy on Celo."
    );
  }

  const wallets = await getOperatorWalletsSortedByBalanceDesc();
  const dashRead = new Contract(dashAddr, DASHRUNNER_PING_IFACE, provider);

  async function stepsForWallet(w) {
    const dash = new Contract(dashAddr, DASHRUNNER_PING_IFACE, w);
    const out = [];
    for (let i = 0; i < stepsPerWallet; i++) {
      try {
        const receipt = await withRpcRetry(async () => {
          const tx = await dash.dashStep();
          return tx.wait();
        });
        out.push({
          address: w.address,
          stepIndex: i,
          hash: receipt?.hash,
          ok: true,
          method: "DashRunner.dashStep()",
        });
        logger.info({ address: w.address, stepIndex: i, hash: receipt?.hash }, "celoOperatorTools dashRunner dashStep");
      } catch (err) {
        logger.error({ err: err?.message, address: w.address, stepIndex: i }, "celoOperatorTools dashRunner dashStep failed");
        out.push({
          address: w.address,
          stepIndex: i,
          ok: false,
          error: formatEthersSendError(err),
        });
        break;
      }
      await sleep(delayMs);
    }
    const last = out[out.length - 1];
    if (last?.ok) {
      try {
        const c = await withRpcRetry(() => dashRead.dashSteps(w.address));
        last.dashStepsAfter = c.toString();
      } catch (e) {
        logger.warn({ err: e?.message, address: w.address }, "celoOperatorTools dashSteps() view failed");
      }
    }
    return out;
  }

  const maxParallel = getMaxParallelWalletsForPing();
  const results = await runPingAcrossWalletsLimited(wallets, parallelWallets, maxParallel, stepsForWallet, 500);

  return {
    results,
    stepsPerWallet,
    parallelWallets,
    maxParallelWallets: parallelWallets ? maxParallel : 1,
    walletCount: wallets.length,
    totalAttempts: results.length,
    totalOk: results.filter((r) => r.ok).length,
    dashRunnerContractAddress: dashAddr,
    note:
      "Each tx calls DashRunner.dashStep() (increments dashSteps[msg.sender]). dashSteps(address) is read after each wallet batch. When parallel is on, wallets run in chunks of maxParallelWallets to reduce RPC rate limits (set CELO_OPERATOR_MAX_PARALLEL_WALLETS).",
  };
}
