/**
 * Append the Agentic Payments & DeFAI hackathon attribution tag (ERC-8021) to Celo txs.
 * Tag is locked to aji70/Tycoon: celo_e62d1c6c9f82
 */
import { toDataSuffix } from "@celo/attribution-tags";
import { Wallet } from "ethers";

/** Celo mainnet */
const CELO_MAINNET_CHAIN_ID = 42220n;
/** Celo Sepolia */
const CELO_SEPOLIA_CHAIN_ID = 11142220n;

export const CELO_ATTRIBUTION_TAG =
  String(process.env.CELO_ATTRIBUTION_TAG || "celo_e62d1c6c9f82").trim() ||
  "celo_e62d1c6c9f82";

const ATTRIBUTION_SUFFIX = toDataSuffix(CELO_ATTRIBUTION_TAG);

export function isCeloChainId(chainId) {
  const id = typeof chainId === "bigint" ? chainId : BigInt(chainId);
  return id === CELO_MAINNET_CHAIN_ID || id === CELO_SEPOLIA_CHAIN_ID;
}

/**
 * Append ERC-8021 suffix to calldata. Idempotent if already tagged.
 * @param {string} [data]
 * @returns {string}
 */
export function appendAttributionTag(data) {
  const base = !data || data === "0x" ? "0x" : String(data);
  const suffixBody = ATTRIBUTION_SUFFIX.slice(2).toLowerCase();
  if (base.toLowerCase().endsWith(suffixBody)) return base;
  return base === "0x" ? ATTRIBUTION_SUFFIX : `${base}${ATTRIBUTION_SUFFIX.slice(2)}`;
}

/**
 * Wrap an ethers Wallet so every Celo sendTransaction carries the attribution tag.
 * @param {import('ethers').Wallet} wallet
 */
export function wrapWalletWithAttribution(wallet) {
  if (!wallet || wallet.__celoAttributionWrapped) return wallet;

  const originalSend = wallet.sendTransaction.bind(wallet);
  wallet.sendTransaction = async (tx) => {
    let next = tx;
    try {
      const network = await wallet.provider?.getNetwork?.();
      if (network && isCeloChainId(network.chainId)) {
        next = {
          ...tx,
          data: appendAttributionTag(tx?.data ?? "0x"),
        };
      }
    } catch {
      // If chain lookup fails, still tag — backend game traffic is Celo-first.
      next = {
        ...tx,
        data: appendAttributionTag(tx?.data ?? "0x"),
      };
    }
    return originalSend(next);
  };

  wallet.__celoAttributionWrapped = true;
  return wallet;
}

/**
 * Create an ethers Wallet that tags Celo transactions.
 * @param {string} privateKey
 * @param {import('ethers').Provider | null} [provider]
 */
export function createAttributedWallet(privateKey, provider = null) {
  const wallet = provider ? new Wallet(privateKey, provider) : new Wallet(privateKey);
  return wrapWalletWithAttribution(wallet);
}
