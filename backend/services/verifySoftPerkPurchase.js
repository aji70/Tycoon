/**
 * Verify SoftPerkPurchased on TycoonSoftPerkCatalog (funds already sent to RewardSystem treasury).
 */

import { JsonRpcProvider, Interface, id as keccakId } from "ethers";
import { getChainConfig } from "../config/chains.js";
import {
  getSoftPerkCatalogAddress,
  isSoftPerkCatalogConfigured,
  AI_TIP_PACK_PERK_ID,
} from "../lib/softPerkIds.js";
import { getTipPackUsdcRecipient } from "./verifyUsdcTransfer.js";

const SOFT_PERK_ABI = [
  "event SoftPerkPurchased(bytes32 indexed perkId, address indexed buyer, uint256 price, uint8 paymentToken, address indexed treasury)",
];

/** PaymentToken enum: TYC=0, USDC=1, CUSDC=2, USDT=3 */
export const PaymentToken = { TYC: 0, USDC: 1, CUSDC: 2, USDT: 3 };

/**
 * @param {string} txHash
 * @param {{ perkId?: string, minPrice?: bigint, paymentToken?: number, expectedTreasury?: string }} [opts]
 * @returns {Promise<{ ok: boolean, error?: string, buyer?: string, perkId?: string, price?: bigint, paymentToken?: number, treasury?: string }>}
 */
export async function verifySoftPerkPurchase(txHash, opts = {}) {
  if (!isSoftPerkCatalogConfigured()) {
    return { ok: false, error: "Soft perk catalog not configured (set SOFT_PERK_CATALOG_ADDRESS)" };
  }
  if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x")) {
    return { ok: false, error: "Invalid tx_hash" };
  }

  const catalog = getSoftPerkCatalogAddress().toLowerCase();
  const celo = getChainConfig("CELO");
  if (!celo?.rpcUrl) {
    return { ok: false, error: "Celo RPC not configured" };
  }

  const expectedPerkId = opts.perkId
    ? String(opts.perkId).toLowerCase()
    : null;
  const minPrice = opts.minPrice != null ? BigInt(opts.minPrice) : 0n;
  const expectedPayment =
    opts.paymentToken != null ? Number(opts.paymentToken) : PaymentToken.USDC;
  const expectedTreasury = (
    opts.expectedTreasury ||
    getTipPackUsdcRecipient() ||
    ""
  ).toLowerCase();

  try {
    const provider = new JsonRpcProvider(celo.rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { ok: false, error: "Transaction not found" };
    if (receipt.status !== 1) return { ok: false, error: "Transaction failed" };

    const iface = new Interface(SOFT_PERK_ABI);
    const eventTopic = iface.getEvent("SoftPerkPurchased").topicHash;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== catalog) continue;
      if (log.topics[0] !== eventTopic) continue;

      const decoded = iface.parseLog({ topics: log.topics, data: log.data });
      if (!decoded || decoded.name !== "SoftPerkPurchased") continue;

      const perkId = String(decoded.args.perkId).toLowerCase();
      const buyer = String(decoded.args.buyer);
      const price = BigInt(decoded.args.price);
      const paymentToken = Number(decoded.args.paymentToken);
      const treasury = String(decoded.args.treasury).toLowerCase();

      if (expectedPerkId && perkId !== expectedPerkId) {
        continue;
      }
      if (paymentToken !== expectedPayment) {
        return { ok: false, error: "Wrong payment token for this perk" };
      }
      if (price < minPrice) {
        return { ok: false, error: `Price below minimum (${minPrice})` };
      }
      if (expectedTreasury && treasury !== expectedTreasury) {
        return { ok: false, error: "Treasury mismatch (expected reward contract)" };
      }

      return {
        ok: true,
        buyer,
        perkId,
        price,
        paymentToken,
        treasury,
      };
    }

    return { ok: false, error: "No SoftPerkPurchased event from catalog in this transaction" };
  } catch (err) {
    return { ok: false, error: err?.message || "Verification failed" };
  }
}

export { AI_TIP_PACK_PERK_ID, keccakId };
