/**
 * Verify USDC transfer on Celo for credits / tip packs.
 * Tip packs: send to reward contract (REWARD_CONTRACT_ADDRESS / TYCOON_REWARD_SYSTEM).
 */

import { JsonRpcProvider, Interface } from "ethers";
import { getChainConfig } from "../config/chains.js";

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Celo mainnet USDC (bridged). */
const CELO_USDC_FALLBACK = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
/** Production Tycoon reward system — default tip-pack pay-to. */
const CELO_REWARD_FALLBACK = "0xd9806923A40c9436bA53C5C1Bb35DA8c7d3D2D4c";

/**
 * Where tip-pack USDC should be sent: reward contract by default.
 */
export function getTipPackUsdcRecipient() {
  return (
    process.env.TIP_PACK_USDC_RECIPIENT ||
    process.env.REWARD_CONTRACT_ADDRESS ||
    process.env.TYCOON_REWARD_SYSTEM ||
    process.env.X402_PAY_TO_ADDRESS ||
    process.env.NEXT_PUBLIC_CELO_REWARD ||
    process.env.HOSTED_AGENT_CREDITS_USDC_RECIPIENT ||
    CELO_REWARD_FALLBACK
  );
}

export function getUsdcTokenAddress() {
  return process.env.CELO_USDC_ADDRESS || process.env.NEXT_PUBLIC_CELO_USDC || CELO_USDC_FALLBACK;
}

export function isUsdcCreditsConfigured() {
  const recipient = process.env.HOSTED_AGENT_CREDITS_USDC_RECIPIENT;
  const usdc = getUsdcTokenAddress();
  const celo = getChainConfig("CELO");
  return Boolean(recipient && usdc && celo.rpcUrl);
}

export function isTipPackUsdcConfigured() {
  const recipient = getTipPackUsdcRecipient();
  const usdc = getUsdcTokenAddress();
  const celo = getChainConfig("CELO");
  return Boolean(recipient && usdc && celo.rpcUrl);
}

/**
 * Verify a USDC transfer tx and extract from + amount.
 * @param {string} txHash
 * @param {{ minAmount?: bigint, recipient?: string }} [opts]
 */
export async function verifyUsdcTransfer(txHash, opts = {}) {
  const recipient =
    opts.recipient ||
    process.env.HOSTED_AGENT_CREDITS_USDC_RECIPIENT ||
    getTipPackUsdcRecipient();
  const usdcAddress = getUsdcTokenAddress();
  const celo = getChainConfig("CELO");
  const minAmount = opts.minAmount != null ? BigInt(opts.minAmount) : 1_000_000n;

  if (!recipient || !usdcAddress || !celo.rpcUrl) {
    return { ok: false, error: "USDC payments not configured" };
  }

  if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x")) {
    return { ok: false, error: "Invalid tx_hash" };
  }

  try {
    const provider = new JsonRpcProvider(celo.rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { ok: false, error: "Transaction not found" };
    if (receipt.status !== 1) return { ok: false, error: "Transaction failed" };

    const recipientLower = recipient.toLowerCase().replace(/^0x/, "");
    const usdcLower = usdcAddress.toLowerCase().replace(/^0x/, "");
    const iface = new Interface(ERC20_ABI);
    const minLabel = Number(minAmount) / 1_000_000;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcLower) continue;
      if (log.topics[0] !== TRANSFER_TOPIC) continue;

      const decoded = iface.parseLog({ topics: log.topics, data: log.data });
      if (!decoded || decoded.name !== "Transfer") continue;

      const to = decoded.args.to?.toLowerCase?.() || "";
      if (to !== recipientLower && to !== `0x${recipientLower}`) continue;

      const amount = decoded.args.value;
      if (amount < minAmount) {
        return { ok: false, error: `Amount less than $${minLabel} USDC` };
      }

      const from = decoded.args.from;
      return { ok: true, from: from?.toString?.() || from, amount };
    }

    return { ok: false, error: "No USDC transfer to recipient in this transaction" };
  } catch (err) {
    return { ok: false, error: err?.message || "Verification failed" };
  }
}
