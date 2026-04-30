/**
 * Verify USDC transfer on Celo for hosted agent credits purchase.
 * User sends $1 USDC (1e6) to HOSTED_AGENT_CREDITS_USDC_RECIPIENT.
 * Returns { ok, from, amount } if valid.
 */

import { JsonRpcProvider, Interface } from "ethers";
import { getChainConfig } from "../config/chains.js";

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export function isUsdcCreditsConfigured() {
  const recipient = process.env.HOSTED_AGENT_CREDITS_USDC_RECIPIENT;
  const usdc = process.env.CELO_USDC_ADDRESS || process.env.NEXT_PUBLIC_CELO_USDC;
  const celo = getChainConfig("CELO");
  return Boolean(recipient && usdc && celo.rpcUrl);
}

/**
 * Verify a USDC transfer tx and extract from + amount.
 * @param {string} txHash - On-chain transaction hash
 * @returns {Promise<{ ok: boolean, from?: string, amount?: bigint, error?: string }>}
 */
export async function verifyUsdcTransfer(txHash) {
  const recipient = process.env.HOSTED_AGENT_CREDITS_USDC_RECIPIENT;
  const usdcAddress = process.env.CELO_USDC_ADDRESS || process.env.NEXT_PUBLIC_CELO_USDC;
  const celo = getChainConfig("CELO");

  if (!recipient || !usdcAddress || !celo.rpcUrl) {
    return { ok: false, error: "USDC credits not configured" };
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

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcLower) continue;
      if (log.topics[0] !== TRANSFER_TOPIC) continue;

      const decoded = iface.parseLog({ topics: log.topics, data: log.data });
      if (!decoded || decoded.name !== "Transfer") continue;

      const to = decoded.args.to?.toLowerCase?.() || "";
      if (to !== recipientLower && to !== `0x${recipientLower}`) continue;

      const amount = decoded.args.value;
      const minAmount = 1_000_000n; // 1 USDC (6 decimals)
      if (amount < minAmount) return { ok: false, error: "Amount less than $1 USDC" };

      const from = decoded.args.from;
      return { ok: true, from: from?.toString?.() || from, amount };
    }

    return { ok: false, error: "No USDC transfer to recipient in this transaction" };
  } catch (err) {
    return { ok: false, error: err?.message || "Verification failed" };
  }
}
