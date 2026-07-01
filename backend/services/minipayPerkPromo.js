import db from "../config/database.js";
import logger from "../config/logger.js";
import { deliverCollectibleToUser } from "./tycoonContract.js";

export const MINIPAY_BOGO_PROMO_MODE = "minipay_bogo";

function normalizeAddress(value) {
  const s = String(value || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(s) ? s : null;
}

export function isMinipayBogoPromoMode(value) {
  return String(value || "").trim().toLowerCase() === MINIPAY_BOGO_PROMO_MODE;
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
