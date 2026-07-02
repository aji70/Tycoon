import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";
import { isContractConfigured, mintVoucherTo, deliverBonusCollectibleToUser, mintCollectibleToUser } from "../services/tycoonContract.js";
import { recordEvent } from "../services/analytics.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";
import {
  getEffectiveDailyClaimConfig,
  getEconomyDailyClaimOverrides,
  upsertSetting,
  clearPlatformSettingsCache,
} from "../services/platformSettings.js";
import { listAdminCollectibleOptions, resolveShopTokenIdForPerk, stockOrRestockAllInitialPerks } from "../services/rewardSystemContract.js";

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function resolveMintToAddress(user) {
  if (!user) return null;
  const sw = user.smart_wallet_address && String(user.smart_wallet_address).trim();
  if (sw && sw !== "0x0000000000000000000000000000000000000000") return sw;
  const lw = user.linked_wallet_address && String(user.linked_wallet_address).trim();
  if (lw) return lw;
  return user.address ? String(user.address).trim() : null;
}

function normalizeRewardChain(chain, userChain) {
  const c = String(chain || userChain || "BASE")
    .trim()
    .toUpperCase();
  return ["CELO", "POLYGON", "BASE"].includes(c) ? c : "BASE";
}

/**
 * GET /api/admin/economy/overview
 */
export async function getEconomyOverview(req, res) {
  try {
    const startToday = startOfUtcDay();

    const [
      usersAgg,
      claimedTodayRow,
      streakNonZeroRow,
    ] = await Promise.all([
      db("users")
        .select(
          db.raw("COALESCE(SUM(total_earned),0) as sum_earned"),
          db.raw("COALESCE(SUM(total_withdrawn),0) as sum_withdrawn"),
          db.raw("COALESCE(SUM(total_staked),0) as sum_staked")
        )
        .first(),
      db("users").where("last_daily_claim_at", ">=", startToday).count("* as c").first(),
      db("users").where("login_streak", ">", 0).count("* as c").first(),
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          totalEarnedSum: Number(usersAgg?.sum_earned ?? 0),
          totalWithdrawnSum: Number(usersAgg?.sum_withdrawn ?? 0),
          totalStakedSum: Number(usersAgg?.sum_staked ?? 0),
        },
        dailyClaim: {
          usersClaimedTodayUtc: Number(claimedTodayRow?.c ?? 0),
          usersWithNonZeroStreak: Number(streakNonZeroRow?.c ?? 0),
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getEconomyOverview error");
    res.status(500).json({ success: false, error: "Failed to load economy overview" });
  }
}

/**
 * GET /api/admin/economy/config
 * Effective daily-claim tuning from env (change requires deploy / env update).
 */
export async function getEconomyConfig(req, res) {
  try {
    const eff = await getEffectiveDailyClaimConfig();
    const envBase = process.env.DAILY_REWARD_TYC_BASE ?? "1";
    const envStreak = process.env.DAILY_REWARD_STREAK_BONUS_TYC ?? "0.5";
    res.json({
      success: true,
      data: {
        dailyClaim: {
          dailyRewardTycBase: eff.dailyRewardTycBase,
          streakBonusTycPerDay: eff.streakBonusTycPerDay,
          gdVerifiedBonusTyc: eff.gdVerifiedBonusTyc,
          effectiveSource: eff.source,
          envFallback: { dailyRewardTycBase: envBase, streakBonusTycPerDay: envStreak, gdVerifiedBonusTyc: process.env.GD_VERIFIED_BONUS_TYC ?? "0.5" },
          envKeys: ["DAILY_REWARD_TYC_BASE", "DAILY_REWARD_STREAK_BONUS_TYC", "GD_VERIFIED_BONUS_TYC"],
        },
        note:
          eff.source === "db_override"
            ? "Daily claim amounts are overridden in platform_settings (economy_daily_claim). Env is fallback for unset fields."
            : "Values come from process.env unless overridden via PATCH /api/admin/economy/config.",
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getEconomyConfig error");
    res.status(500).json({ success: false, error: "Failed to read config" });
  }
}

/**
 * PATCH /api/admin/economy/config
 * Body: { dailyRewardTycBase?: string|null, streakBonusTycPerDay?: number|null } — null clears override for that field.
 */
export async function patchEconomyConfig(req, res) {
  try {
    const cur = await getEconomyDailyClaimOverrides();
    const next = {
      dailyRewardTycBase: cur.dailyRewardTycBase,
      streakBonusTycPerDay: cur.streakBonusTycPerDay,
      gdVerifiedBonusTyc: cur.gdVerifiedBonusTyc,
    };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "dailyRewardTycBase")) {
      const v = req.body.dailyRewardTycBase;
      if (v === null || v === "") {
        next.dailyRewardTycBase = null;
      } else {
        const s = String(v).trim();
        if (!/^\d+(\.\d+)?$/.test(s)) {
          return res.status(400).json({ success: false, error: "dailyRewardTycBase must be a non-negative number string" });
        }
        next.dailyRewardTycBase = s;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "streakBonusTycPerDay")) {
      const v = req.body.streakBonusTycPerDay;
      if (v === null || v === "") {
        next.streakBonusTycPerDay = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 1e6) {
          return res.status(400).json({ success: false, error: "streakBonusTycPerDay must be a finite non-negative number" });
        }
        next.streakBonusTycPerDay = n;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "gdVerifiedBonusTyc")) {
      const v = req.body.gdVerifiedBonusTyc;
      if (v === null || v === "") {
        next.gdVerifiedBonusTyc = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 1e6) {
          return res.status(400).json({ success: false, error: "gdVerifiedBonusTyc must be a finite non-negative number" });
        }
        next.gdVerifiedBonusTyc = n;
      }
    }

    const rowPayload = {};
    if (next.dailyRewardTycBase != null) rowPayload.dailyRewardTycBase = next.dailyRewardTycBase;
    if (next.streakBonusTycPerDay != null) rowPayload.streakBonusTycPerDay = next.streakBonusTycPerDay;
    if (next.gdVerifiedBonusTyc != null) rowPayload.gdVerifiedBonusTyc = next.gdVerifiedBonusTyc;

    const hasAny = Object.keys(rowPayload).length > 0;
    if (!hasAny) {
      const has = await db.schema.hasTable("platform_settings");
      if (has) {
        await db("platform_settings").where({ setting_key: "economy_daily_claim" }).delete();
      }
      clearPlatformSettingsCache();
    } else {
      await upsertSetting("economy_daily_claim", rowPayload);
    }

    await appendAdminAuditLog({
      action: "economy.config_patch",
      targetType: "platform",
      targetId: "economy_daily_claim",
      payload: { next, cleared: !hasAny },
      req,
    });

    const eff = await getEffectiveDailyClaimConfig();
    res.json({
      success: true,
      data: {
        dailyClaim: {
          dailyRewardTycBase: eff.dailyRewardTycBase,
          streakBonusTycPerDay: eff.streakBonusTycPerDay,
          gdVerifiedBonusTyc: eff.gdVerifiedBonusTyc,
          effectiveSource: eff.source,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin patchEconomyConfig error");
    res.status(500).json({ success: false, error: "Failed to update economy config" });
  }
}

/**
 * POST /api/admin/economy/grant-voucher
 * Body: { userId: number, tycAmount: number (TYC, not wei), chain?: string, reason?: string }
 */
export async function grantVoucher(req, res) {
  try {
    const userId = Number(req.body?.userId ?? req.body?.user_id);
    const tycAmount = Number(req.body?.tycAmount ?? req.body?.tyc_amount);
    const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 500) : "";

    if (!Number.isFinite(userId) || userId < 1) {
      return res.status(400).json({ success: false, error: "Invalid userId" });
    }
    if (!Number.isFinite(tycAmount) || tycAmount <= 0 || tycAmount > 1e12) {
      return res.status(400).json({ success: false, error: "tycAmount must be a positive number (reasonable bound)" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const chain = normalizeRewardChain(req.body?.chain, user.chain);
    if (!isContractConfigured(chain)) {
      return res.status(400).json({
        success: false,
        error: `Reward contract not configured for chain ${chain}`,
      });
    }

    const toAddress = resolveMintToAddress(user);
    if (!toAddress) {
      return res.status(400).json({ success: false, error: "User has no wallet address to mint to" });
    }

    const tycWei = BigInt(Math.round(tycAmount * 1e18));
    if (tycWei <= BigInt(0)) {
      return res.status(400).json({ success: false, error: "Amount too small after conversion" });
    }

    let hash;
    let tokenId;
    try {
      const out = await mintVoucherTo(toAddress, tycWei.toString(), chain);
      hash = out.hash;
      tokenId = out.tokenId;
    } catch (mintErr) {
      const rawMsg = String(mintErr?.shortMessage || mintErr?.reason || mintErr?.message || "");
      logger.warn({ err: rawMsg, userId, chain }, "admin grantVoucher mint failed");
      return res.status(502).json({
        success: false,
        error: rawMsg || "Mint failed",
        mint_to: toAddress,
        chain,
      });
    }

    await recordEvent("admin_grant_voucher", {
      entityType: "user",
      entityId: userId,
      payload: { tycAmount, chain, reason: reason || null, tx_hash: hash || null, token_id: tokenId || null },
    });

    await appendAdminAuditLog({
      action: "economy.grant_voucher",
      targetType: "user",
      targetId: String(userId),
      payload: {
        username: user.username,
        tycAmount,
        chain,
        reason: reason || null,
        txHash: hash || null,
        tokenId: tokenId ?? null,
        mintTo: toAddress,
      },
      req,
    });

    res.json({
      success: true,
      data: {
        userId,
        username: user.username,
        chain,
        tycAmount,
        mintTo: toAddress,
        txHash: hash,
        tokenId: tokenId || null,
        reason: reason || null,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin grantVoucher error");
    res.status(500).json({ success: false, error: "Grant voucher failed" });
  }
}

function isValidEthAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(addr || "").trim());
}

/**
 * GET /api/admin/economy/collectible-options?chain=CELO
 * Human-readable perk list with shop token ids when in stock.
 */
export async function listCollectibleOptions(req, res) {
  try {
    const chain = normalizeRewardChain(req.query?.chain, "CELO");
    if (!isContractConfigured(chain)) {
      return res.status(400).json({
        success: false,
        error: `Reward contract not configured for chain ${chain}`,
      });
    }
    const options = await listAdminCollectibleOptions(chain);
    res.json({ success: true, data: options, chain });
  } catch (err) {
    logger.error({ err }, "admin listCollectibleOptions error");
    res.status(500).json({ success: false, error: err?.message || "Failed to load collectibles" });
  }
}

/**
 * POST /api/admin/economy/deliver-collectible
 * Body: { toAddress?: string, userId?: number, tokenId: string|number, chain?: string, reason?: string }
 *       OR mint path: { toAddress?, userId?, perk: number, strength: number, chain?, reason? }
 * Delivers from shop stock when possible; mints matching perk if out of stock.
 */
export async function deliverCollectible(req, res) {
  try {
    const tokenIdRaw = req.body?.tokenId ?? req.body?.token_id;
    const perk = req.body?.perk != null ? Number(req.body.perk) : null;
    const strength = req.body?.strength != null ? Number(req.body.strength) : null;
    const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 500) : "";

    const userId = req.body?.userId != null ? Number(req.body.userId) : req.body?.user_id != null ? Number(req.body.user_id) : null;
    let toAddress = req.body?.toAddress != null ? String(req.body.toAddress).trim() : req.body?.to_address != null ? String(req.body.to_address).trim() : "";

    let user = null;
    if (userId != null && Number.isFinite(userId) && userId > 0) {
      user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      if (!toAddress) {
        toAddress = resolveMintToAddress(user) || "";
      }
    }

    if (!isValidEthAddress(toAddress)) {
      return res.status(400).json({ success: false, error: "Valid toAddress (0x…) or userId required" });
    }

    const chain = normalizeRewardChain(req.body?.chain, user?.chain || "CELO");
    if (!isContractConfigured(chain)) {
      return res.status(400).json({
        success: false,
        error: `Reward contract not configured for chain ${chain}`,
      });
    }

    let result;
    let tokenId = null;
    let deliveryMethod = "deliver";

    if (tokenIdRaw != null && String(tokenIdRaw).trim() !== "") {
      tokenId = String(tokenIdRaw).trim();
      if (!/^\d+$/.test(tokenId) || BigInt(tokenId) <= 0n) {
        return res.status(400).json({ success: false, error: "tokenId must be a positive integer" });
      }
      try {
        result = await deliverBonusCollectibleToUser(toAddress, tokenId, chain);
        deliveryMethod = result.method || "deliver";
      } catch (mintErr) {
        const rawMsg = String(mintErr?.shortMessage || mintErr?.reason || mintErr?.message || "");
        logger.warn({ err: rawMsg, toAddress, tokenId, chain }, "admin deliverCollectible failed");
        return res.status(502).json({
          success: false,
          error: rawMsg || "Deliver collectible failed",
          deliverTo: toAddress,
          chain,
        });
      }
    } else if (perk != null && strength != null && Number.isFinite(perk) && perk > 0 && Number.isFinite(strength) && strength > 0) {
      try {
        const resolved = await resolveShopTokenIdForPerk(perk, strength, chain);
        if (resolved) {
          tokenId = resolved.toString();
          result = await deliverBonusCollectibleToUser(toAddress, tokenId, chain);
          deliveryMethod = result.method || "deliver";
        } else {
          result = await mintCollectibleToUser(toAddress, perk, strength, chain);
          deliveryMethod = "mint";
        }
      } catch (mintErr) {
        const rawMsg = String(mintErr?.shortMessage || mintErr?.reason || mintErr?.message || "");
        logger.warn({ err: rawMsg, toAddress, perk, strength, chain }, "admin mintCollectible failed");
        return res.status(502).json({
          success: false,
          error: rawMsg || "Mint collectible failed",
          deliverTo: toAddress,
          chain,
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: "Provide tokenId (shop collectible id) or perk + strength to mint",
      });
    }

    const hash = result?.hash || null;

    await recordEvent("admin_deliver_collectible", {
      entityType: userId ? "user" : "wallet",
      entityId: userId || toAddress,
      payload: {
        tokenId,
        perk,
        strength,
        chain,
        reason: reason || null,
        tx_hash: hash,
        method: deliveryMethod,
      },
    });

    await appendAdminAuditLog({
      action: "economy.deliver_collectible",
      targetType: userId ? "user" : "wallet",
      targetId: userId ? String(userId) : toAddress,
      payload: {
        username: user?.username ?? null,
        tokenId,
        perk,
        strength,
        chain,
        reason: reason || null,
        txHash: hash,
        deliverTo: toAddress,
        method: deliveryMethod,
      },
      req,
    });

    res.json({
      success: true,
      data: {
        userId: userId || null,
        username: user?.username ?? null,
        chain,
        tokenId,
        perk,
        strength,
        deliverTo: toAddress,
        txHash: hash,
        method: deliveryMethod,
        reason: reason || null,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin deliverCollectible error");
    res.status(500).json({ success: false, error: "Deliver collectible failed" });
  }
}

/**
 * POST /api/admin/economy/shop-add-all-perks
 * Body: { chain?: string, amount?: number } — restock every catalog perk (or stock if missing).
 */
export async function addAllShopPerks(req, res) {
  try {
    const chain = normalizeRewardChain(req.body?.chain, "CELO");
    const amount = req.body?.amount != null ? Number(req.body.amount) : 200;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: "amount must be a positive number" });
    }
    if (!isContractConfigured(chain)) {
      return res.status(400).json({
        success: false,
        error: `Reward contract not configured for chain ${chain}`,
      });
    }

    const result = await stockOrRestockAllInitialPerks(chain, amount);

    await appendAdminAuditLog({
      action: "economy.shop_add_all_perks",
      targetType: "chain",
      targetId: chain,
      payload: { amount, processed: result.processed, restocked: result.restocked, newlyStocked: result.newlyStocked, failed: result.failed },
      req,
    });

    const status = result.success ? 200 : 207;
    return res.status(status).json({
      success: result.success,
      data: result,
      message: result.success
        ? `Added ${amount} unit(s) to ${result.processed} perk row(s) (${result.restocked} restocked, ${result.newlyStocked} newly stocked).`
        : `Partial failure: ${result.failed} perk row(s) failed.`,
    });
  } catch (err) {
    logger.error({ err }, "admin addAllShopPerks error");
    res.status(500).json({ success: false, error: err?.message || "Failed to add perks to shop" });
  }
}
