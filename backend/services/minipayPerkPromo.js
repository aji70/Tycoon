import db from "../config/database.js";
import logger from "../config/logger.js";
import { ethers } from "ethers";
import { getChainConfig } from "../config/chains.js";
import { deliverCollectibleToUser } from "./tycoonContract.js";

export const MINIPAY_BOGO_PROMO_MODE = "minipay_bogo";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MINIPAY_BOGO_EVENT_ABI = [
  "event CollectibleBought(uint256 indexed tokenId, address indexed buyer, uint256 price, bool usedUsdc)",
];

function normalizeAddress(value) {
  const s = String(value || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(s) ? s : null;
}

export function isMinipayBogoPromoMode(value) {
  return String(value || "").trim().toLowerCase() === MINIPAY_BOGO_PROMO_MODE;
}

export function promoAddressSetFromUser(user) {
  const set = new Set();
  for (const raw of [user?.address, user?.linked_wallet_address, user?.smart_wallet_address]) {
    const s = String(raw || "").trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(s)) set.add(s.toLowerCase());
  }
  return set;
}

async function getRewardAddressForChain(chain) {
  const cfg = getChainConfig(chain);
  if (!cfg?.rpcUrl || !cfg?.contractAddress) {
    throw new Error(`Reward verification unavailable for ${chain}`);
  }
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const tycoon = new ethers.Contract(
    cfg.contractAddress,
    [{ type: "function", name: "rewardSystem", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }],
    provider
  );
  const rewardAddress = await tycoon.rewardSystem();
  if (!rewardAddress || rewardAddress === ZERO_ADDRESS) {
    throw new Error(`Reward system not set on chain ${chain}`);
  }
  return { provider, rewardAddress };
}

/** Confirms a successful CollectibleBought log for tokenId + buyer on txHash. */
export async function verifyCollectiblePurchaseReceipt({ txHash, tokenId, recipient, chain }) {
  const { provider, rewardAddress } = await getRewardAddressForChain(chain);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction receipt not found yet");
  if (receipt.status !== 1) throw new Error("Purchase transaction did not succeed");

  const iface = new ethers.Interface(MINIPAY_BOGO_EVENT_ABI);
  const tokenStr = String(tokenId);
  const recipientLower = String(recipient).toLowerCase();
  for (const log of receipt.logs || []) {
    if (String(log.address || "").toLowerCase() !== String(rewardAddress).toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (
        parsed?.name === "CollectibleBought" &&
        String(parsed.args?.tokenId) === tokenStr &&
        String(parsed.args?.buyer || "").toLowerCase() === recipientLower
      ) {
        return { rewardAddress, buyer: recipientLower };
      }
    } catch (_) {}
  }
  throw new Error("Could not verify perk purchase from transaction receipt");
}

/**
 * Grants the extra promo copy exactly once per claim key.
 */
export async function claimMinipayPerkBogo({
  claimKey,
  userId,
  tokenId,
  chain = "CELO",
  deliveryAddress,
  source = "minipay",
  purchaseTxHash = null,
  paymentRef = null,
}) {
  const safeClaimKey = String(claimKey || "").trim();
  const safeAddress = normalizeAddress(deliveryAddress);
  const safeTokenId = String(tokenId || "").trim();
  if (!safeClaimKey || !safeAddress || !safeTokenId) {
    return { applied: false, reason: "invalid_input" };
  }

  const existing = await db("perk_purchase_promos")
    .where({ claim_key: safeClaimKey, promo_type: MINIPAY_BOGO_PROMO_MODE })
    .first();
  if (existing?.status === "completed" || existing?.status === "pending") {
    return { applied: false, duplicate: true, status: existing.status };
  }

  if (!existing) {
    try {
      await db("perk_purchase_promos").insert({
        promo_type: MINIPAY_BOGO_PROMO_MODE,
        claim_key: safeClaimKey,
        user_id: userId,
        token_id: safeTokenId,
        chain,
        delivery_address: safeAddress,
        source,
        purchase_tx_hash: purchaseTxHash,
        payment_ref: paymentRef,
        status: "pending",
      });
    } catch (err) {
      if (/duplicate|unique/i.test(String(err?.message || ""))) {
        return { applied: false, duplicate: true, status: "pending" };
      }
      throw err;
    }
  } else {
    await db("perk_purchase_promos")
      .where({ id: existing.id })
      .update({
        status: "pending",
        error_message: null,
        updated_at: db.fn.now(),
      });
  }

  try {
    const { hash } = await deliverCollectibleToUser(safeAddress, safeTokenId, chain);
    await db("perk_purchase_promos")
      .where({ claim_key: safeClaimKey, promo_type: MINIPAY_BOGO_PROMO_MODE })
      .update({
        status: "completed",
        bonus_tx_hash: hash || null,
        completed_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    return { applied: true, bonusTxHash: hash || null };
  } catch (err) {
    const msg = String(err?.shortMessage || err?.reason || err?.message || "Promo delivery failed");
    logger.warn({ err: msg, claimKey: safeClaimKey, userId, tokenId: safeTokenId, chain }, "minipay perk bogo failed");
    await db("perk_purchase_promos")
      .where({ claim_key: safeClaimKey, promo_type: MINIPAY_BOGO_PROMO_MODE })
      .update({
        status: "failed",
        error_message: msg.slice(0, 1000),
        updated_at: db.fn.now(),
      });
    return { applied: false, error: msg };
  }
}
