import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";
import { isContractConfigured, mintVoucherTo } from "../services/tycoonContract.js";
import { recordEvent } from "../services/analytics.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

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
    const base = process.env.DAILY_REWARD_TYC_BASE ?? "1";
    const streakBonus = process.env.DAILY_REWARD_STREAK_BONUS_TYC ?? "0.5";
    res.json({
      success: true,
      data: {
        dailyClaim: {
          dailyRewardTycBase: base,
          streakBonusTycPerDay: streakBonus,
          envKeys: ["DAILY_REWARD_TYC_BASE", "DAILY_REWARD_STREAK_BONUS_TYC"],
        },
        note: "Values are read from process.env. Restart the backend after changing .env.",
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getEconomyConfig error");
    res.status(500).json({ success: false, error: "Failed to read config" });
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
