/**
 * Celo-only admin operator tools: EOAs in CELO_OPERATOR_WALLET_PRIVATE_KEYS (or legacy CELO_BOT_FARM_PRIVATE_KEYS)
 * call registerPlayer / createAIGame on-chain. Gated by CELO_OPERATOR_TOOLS_ENABLED (or legacy CELO_BOT_FARM_ENABLED).
 */
import { Contract, Interface, JsonRpcProvider, Network, Wallet, formatEther, parseEther } from "ethers";
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

/** Canonical USDC on Celo — `approve` is cheap and already deployed (no new contracts). */
const ERC20_APPROVE_IFACE = new Interface(["function approve(address spender, uint256 amount) external"]);

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
  const provider = new JsonRpcProvider(cfg.rpcUrl, network, { staticNetwork: network });
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
  const tycTok = cfg.tycTokenAddress?.trim();
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
      results.push({ address: w.address, username, ok: false, error: err?.shortMessage || err?.message || String(err) });
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
          error: err?.shortMessage || err?.message || String(err),
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
 * Each operator wallet calls **ERC20.approve(Tycoon game, 0)** on your token.
 * Prefers **TYC** (`CELO_TYC_TOKEN_ADDRESS` / `TYCOON_CELO_TYC` / `TYCOON_CELO_TOKEN`); falls back to **USDC** if TYC unset.
 * Low gas; no token balance required.
 */
export async function lightTokenApproveGameZeroFromAllOperatorWallets(options = {}) {
  assertOperatorToolsEnabled();
  const delayMs = Math.max(0, Number(options.delayMs) || 0);
  const { contractAddress, cfg } = getReadContext();
  const tycAddr = cfg.tycTokenAddress?.trim();
  const usdcAddr = cfg.usdcAddress?.trim();
  const tokenAddr = tycAddr || usdcAddr;
  const tokenSymbol = tycAddr ? "TYC" : "USDC";
  if (!tokenAddr) {
    throw new Error(
      "Set CELO_TYC_TOKEN_ADDRESS (or TYCOON_CELO_TYC / TYCOON_CELO_TOKEN) for TYC, or CELO_USDC_ADDRESS / USDC_ADDRESS for USDC fallback"
    );
  }
  const wallets = await getOperatorWalletsSortedByBalanceDesc();
  const results = [];
  for (const w of wallets) {
    const token = new Contract(tokenAddr, ERC20_APPROVE_IFACE, w);
    try {
      const tx = await token.approve(contractAddress, 0n);
      const receipt = await tx.wait();
      results.push({
        address: w.address,
        hash: receipt?.hash,
        ok: true,
        method: `${tokenSymbol}.approve(game,0)`,
      });
      logger.info({ address: w.address, hash: receipt?.hash, tokenSymbol }, "celoOperatorTools token approve 0 to game");
    } catch (err) {
      logger.error({ err: err?.message, address: w.address }, "celoOperatorTools token approve failed");
      results.push({
        address: w.address,
        ok: false,
        error: err?.shortMessage || err?.message || String(err),
      });
    }
    await sleep(delayMs);
  }
  return {
    results,
    tokenAddress: tokenAddr,
    tokenSymbol,
    spenderGame: contractAddress,
    note: tycAddr
      ? "TYC token → approve(game,0) on your ERC20"
      : "USDC fallback → approve(game,0); set TYC env to use your TYC contract instead",
  };
}
