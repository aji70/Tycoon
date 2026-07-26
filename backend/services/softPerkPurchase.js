/**
 * Soft perk purchases: verify SoftPerkPurchased, grant entitlement by perkId.
 * Tip packs remain available via tipPackPurchase (which prefers this path when catalog is set).
 */

import db from "../config/database.js";
import User from "../models/User.js";
import GamePlayer from "../models/GamePlayer.js";
import {
  verifySoftPerkPurchase,
  PaymentToken,
  AI_TIP_PACK_PERK_ID,
} from "./verifySoftPerkPurchase.js";
import {
  isSoftPerkCatalogConfigured,
  getSoftPerkCatalogAddress,
  SOFT_PERK_LABELS,
} from "../lib/softPerkIds.js";
import {
  grantTipPack,
  getTipQuota,
  getTipPackOffer,
  TIP_PACK_TIPS,
  TIP_PACK_USDC,
  TIP_PACK_USDC_UNITS,
} from "./gameAiTipQuota.js";

/**
 * @param {{ userId: number, txHash: string, perkId: string, gameId?: number, minPrice?: bigint, paymentToken?: number }} opts
 */
export async function purchaseSoftPerk(opts) {
  const { userId, txHash, perkId, gameId } = opts;
  if (!isSoftPerkCatalogConfigured()) {
    const err = new Error("Soft perk catalog not configured (set SOFT_PERK_CATALOG_ADDRESS)");
    err.status = 503;
    throw err;
  }
  if (!userId || !perkId) {
    const err = new Error("userId and perkId required");
    err.status = 400;
    throw err;
  }
  const hash = String(txHash || "").trim();
  if (!hash.startsWith("0x")) {
    const err = new Error("tx_hash required");
    err.status = 400;
    throw err;
  }

  const normalizedPerkId = String(perkId).toLowerCase();
  const isTipPack = normalizedPerkId === AI_TIP_PACK_PERK_ID.toLowerCase();

  if (isTipPack) {
    if (!gameId) {
      const err = new Error("gameId required for tip pack perk");
      err.status = 400;
      throw err;
    }
    const player = await GamePlayer.findByUserIdAndGameId(userId, gameId);
    if (!player) {
      const err = new Error("You are not in this game");
      err.status = 403;
      throw err;
    }
  }

  const existing = await db("soft_perk_purchases").where({ tx_hash: hash }).first();
  if (existing) {
    let payload = existing.entitlement_payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
    if (isTipPack && gameId) {
      const quota = await getTipQuota(gameId, userId);
      return {
        already_credited: true,
        perkId: normalizedPerkId,
        entitlement: "ai_tip_pack",
        tips_granted: Number(payload?.tips_granted) || TIP_PACK_TIPS,
        tipsRemaining: quota.remaining,
        tipLimit: quota.limit,
      };
    }
    return {
      already_credited: true,
      perkId: normalizedPerkId,
      entitlement: existing.entitlement,
    };
  }

  const minPrice =
    opts.minPrice != null
      ? BigInt(opts.minPrice)
      : isTipPack
        ? TIP_PACK_USDC_UNITS
        : 0n;

  const result = await verifySoftPerkPurchase(hash, {
    perkId: normalizedPerkId,
    minPrice,
    paymentToken: opts.paymentToken != null ? opts.paymentToken : PaymentToken.USDC,
  });
  if (!result.ok) {
    const err = new Error(result.error || "Invalid soft perk purchase");
    err.status = 400;
    throw err;
  }

  const senderUser = result.buyer
    ? await User.resolveUserByAddress(result.buyer, "CELO")
    : null;
  if (!senderUser || Number(senderUser.id) !== Number(userId)) {
    const err = new Error(
      "Transaction was sent from a different wallet. Sign in with the wallet that paid."
    );
    err.status = 400;
    throw err;
  }

  let entitlement = "generic";
  let entitlementPayload = {
    price: result.price?.toString?.() || String(result.price),
    paymentToken: result.paymentToken,
  };

  if (isTipPack) {
    entitlement = "ai_tip_pack";
    entitlementPayload = {
      ...entitlementPayload,
      tips_granted: TIP_PACK_TIPS,
      amount_usdc: TIP_PACK_USDC,
      game_id: gameId,
    };
  }

  try {
    await db("soft_perk_purchases").insert({
      user_id: userId,
      game_id: gameId || null,
      perk_id: normalizedPerkId,
      tx_hash: hash,
      entitlement,
      entitlement_payload: entitlementPayload,
      amount: String(result.price),
      payment_token: result.paymentToken,
      treasury: result.treasury,
    });
  } catch (e) {
    if (
      e?.code === "ER_DUP_ENTRY" ||
      String(e?.message || "").includes("unique") ||
      String(e?.message || "").includes("duplicate")
    ) {
      return {
        already_credited: true,
        perkId: normalizedPerkId,
        entitlement,
      };
    }
    throw e;
  }

  if (isTipPack && gameId) {
    // Also record on tip-pack table for existing quota tooling
    try {
      await db("game_ai_tip_pack_purchases").insert({
        user_id: userId,
        game_id: gameId,
        tx_hash: hash,
        tips_granted: TIP_PACK_TIPS,
        amount_usdc: TIP_PACK_USDC,
      });
    } catch (e) {
      if (
        !(
          e?.code === "ER_DUP_ENTRY" ||
          String(e?.message || "").includes("unique") ||
          String(e?.message || "").includes("duplicate")
        )
      ) {
        throw e;
      }
    }
    await grantTipPack(gameId, userId);
    const quota = await getTipQuota(gameId, userId);
    return {
      perkId: normalizedPerkId,
      entitlement,
      tips_granted: TIP_PACK_TIPS,
      tipsRemaining: quota.remaining,
      tipLimit: quota.limit,
      tipPack: getTipPackOffer(),
      catalog: getSoftPerkCatalogAddress(),
    };
  }

  return {
    perkId: normalizedPerkId,
    entitlement,
    catalog: getSoftPerkCatalogAddress(),
  };
}

export function listKnownSoftPerks() {
  return {
    catalog: getSoftPerkCatalogAddress(),
    configured: isSoftPerkCatalogConfigured(),
    perks: [
      {
        label: SOFT_PERK_LABELS.AI_TIP_PACK_V1,
        perkId: AI_TIP_PACK_PERK_ID,
        entitlement: "ai_tip_pack",
        usdc: TIP_PACK_USDC,
        tips: TIP_PACK_TIPS,
      },
    ],
  };
}
