/**
 * Purchase +5 AI tips for $0.05 USDC (sent to the reward contract).
 */

import db from "../config/database.js";
import User from "../models/User.js";
import GamePlayer from "../models/GamePlayer.js";
import {
  verifyUsdcTransfer,
  isTipPackUsdcConfigured,
  getTipPackUsdcRecipient,
} from "./verifyUsdcTransfer.js";
import {
  grantTipPack,
  getTipQuota,
  getTipPackOffer,
  TIP_PACK_TIPS,
  TIP_PACK_USDC,
  TIP_PACK_USDC_UNITS,
} from "./gameAiTipQuota.js";

/**
 * @param {number} userId
 * @param {number} gameId
 * @param {string} txHash
 * @returns {Promise<{ already_credited?: boolean; tips_granted: number; tipsRemaining: number; tipLimit: number }>}
 */
export async function purchaseTipPack(userId, gameId, txHash) {
  if (!isTipPackUsdcConfigured()) {
    const err = new Error("USDC tip packs not configured (set REWARD_CONTRACT_ADDRESS)");
    err.status = 503;
    throw err;
  }
  if (!userId || !gameId) {
    const err = new Error("userId and gameId required");
    err.status = 400;
    throw err;
  }
  const hash = String(txHash || "").trim();
  if (!hash.startsWith("0x")) {
    const err = new Error("tx_hash required");
    err.status = 400;
    throw err;
  }

  const player = await GamePlayer.findByUserIdAndGameId(userId, gameId);
  if (!player) {
    const err = new Error("You are not in this game");
    err.status = 403;
    throw err;
  }

  const existing = await db("game_ai_tip_pack_purchases").where({ tx_hash: hash }).first();
  if (existing) {
    const quota = await getTipQuota(gameId, userId);
    return {
      already_credited: true,
      tips_granted: Number(existing.tips_granted) || TIP_PACK_TIPS,
      tipsRemaining: quota.remaining,
      tipLimit: quota.limit,
    };
  }

  const recipient = getTipPackUsdcRecipient();
  const result = await verifyUsdcTransfer(hash, {
    minAmount: TIP_PACK_USDC_UNITS,
    recipient,
  });
  if (!result.ok) {
    const err = new Error(result.error || "Invalid transaction");
    err.status = 400;
    throw err;
  }

  const senderUser = result.from ? await User.resolveUserByAddress(result.from, "CELO") : null;
  if (!senderUser || Number(senderUser.id) !== Number(userId)) {
    const err = new Error(
      "Transaction was sent from a different wallet. Sign in with the wallet that sent the USDC."
    );
    err.status = 400;
    throw err;
  }

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
      e?.code === "ER_DUP_ENTRY" ||
      String(e?.message || "").includes("unique") ||
      String(e?.message || "").includes("duplicate")
    ) {
      const quota = await getTipQuota(gameId, userId);
      return {
        already_credited: true,
        tips_granted: TIP_PACK_TIPS,
        tipsRemaining: quota.remaining,
        tipLimit: quota.limit,
      };
    }
    throw e;
  }

  await grantTipPack(gameId, userId);
  const quota = await getTipQuota(gameId, userId);
  return {
    tips_granted: TIP_PACK_TIPS,
    tipsRemaining: quota.remaining,
    tipLimit: quota.limit,
    tipPack: getTipPackOffer(),
  };
}
