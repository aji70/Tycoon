/**
 * Daily login / daily claim: track streak and optionally mint a TYC voucher to the user.
 */
import db from "../config/database.js";
import { mintVoucherTo, isContractConfigured } from "../services/tycoonContract.js";
import logger from "../config/logger.js";
import { getEffectiveDailyClaimConfig } from "../services/platformSettings.js";
import { isGoodDollarIdentityEnabled, isUserGoodDollarVerified } from "../services/goodDollarIdentity.js";
import { recordEvent } from "../services/analytics.js";

function toDateOnly(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

function computeDailyRewardWei(eff, streak, verifiedCitizen) {
  const baseReward = BigInt(String(eff.dailyRewardTycBase).split(".")[0] || "0") * BigInt(1e18);
  const streakDays = Math.min(Math.max(streak, 1) - 1, 7);
  const streakBonus = BigInt(streakDays) * BigInt(Math.round(eff.streakBonusTycPerDay * 1e18));
  const gdBonus =
    verifiedCitizen && eff.gdVerifiedBonusTyc > 0
      ? BigInt(Math.round(eff.gdVerifiedBonusTyc * 1e18))
      : BigInt(0);
  return {
    baseReward,
    streakBonus,
    gdBonus,
    totalWei: baseReward + streakBonus + gdBonus,
  };
}

/**
 * POST /api/rewards/daily-claim
 * Body: { chain?: string } (optional; defaults to user's chain or BASE)
 * Requires auth. Claims daily reward: updates streak and mints voucher if contract is configured.
 */
export async function dailyClaim(req, res) {
  const trx = await db.transaction();
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      await trx.rollback();
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await trx("users").where({ id: user_id }).forUpdate().first();
    if (!user) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const today = toDateOnly(new Date());
    const lastClaim = toDateOnly(user.last_daily_claim_at);
    const yesterday = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      return toDateOnly(d);
    })();

    if (lastClaim === today) {
      await trx.rollback();
      return res.json({
        success: true,
        already_claimed: true,
        message: "You already claimed today. Come back tomorrow!",
        streak: Number(user.login_streak || 0),
        reward_tyc: null,
      });
    }

    let newStreak = 1;
    if (lastClaim === yesterday) {
      newStreak = Number(user.login_streak || 0) + 1;
    }

    const chain = (req.body?.chain || user.chain || "BASE").trim().toUpperCase();
    const normalizedChain = ["CELO", "POLYGON", "BASE"].includes(chain) ? chain : "BASE";

    const mintToAddress =
      (user.smart_wallet_address && String(user.smart_wallet_address).trim() && String(user.smart_wallet_address).trim() !== "0x0000000000000000000000000000000000000000")
        ? String(user.smart_wallet_address).trim()
        : (user.linked_wallet_address && String(user.linked_wallet_address).trim()
            ? String(user.linked_wallet_address).trim()
            : String(user.address).trim());

    let rewardTyc = null;
    let txHash = null;
    let verifiedCitizen = false;
    let gdVerifiedBonusTyc = 0;

    if (isContractConfigured(normalizedChain)) {
      const eff = await getEffectiveDailyClaimConfig();
      verifiedCitizen = await isUserGoodDollarVerified(user);
      const reward = computeDailyRewardWei(eff, newStreak, verifiedCitizen);
      gdVerifiedBonusTyc = verifiedCitizen ? eff.gdVerifiedBonusTyc : 0;

      try {
        const { hash } = await mintVoucherTo(mintToAddress, reward.totalWei.toString(), normalizedChain);
        txHash = hash;
        rewardTyc = Number(reward.totalWei) / 1e18;
        if (verifiedCitizen && gdVerifiedBonusTyc > 0) {
          await recordEvent("gd_verified_bonus_claim", {
            entityType: "user",
            entityId: user_id,
            payload: {
              streak: newStreak,
              gd_verified_bonus_tyc: gdVerifiedBonusTyc,
              reward_tyc: rewardTyc,
              chain: normalizedChain,
            },
          });
        }
      } catch (mintErr) {
        await trx.rollback();
        const rawMsg = String(mintErr?.shortMessage || mintErr?.reason || mintErr?.message || "");
        const msg = rawMsg.toLowerCase().includes("not minter")
          ? "Daily reward mint failed: backend wallet is not authorized (Not minter). Ask admin to call setBackendMinter() on TycoonRewardSystem."
          : rawMsg
            ? `Daily reward mint failed: ${rawMsg}`
            : "Reward mint failed. Try again later.";

        logger.warn({ err: rawMsg, userId: user_id, chain: normalizedChain }, "daily-claim mint failed");
        return res.status(502).json({
          success: false,
          message: msg,
          streak: newStreak,
          chain: normalizedChain,
          mint_to: mintToAddress,
        });
      }
    }

    await trx("users")
      .where({ id: user_id })
      .update({
        last_daily_claim_at: new Date(),
        login_streak: newStreak,
        updated_at: new Date(),
      });

    await trx.commit();

    return res.json({
      success: true,
      already_claimed: false,
      message:
        rewardTyc != null
          ? verifiedCitizen && gdVerifiedBonusTyc > 0
            ? `Day ${newStreak}! You received ${rewardTyc} TYC (includes +${gdVerifiedBonusTyc} G$ citizen bonus).`
            : `Day ${newStreak}! You received ${rewardTyc} TYC.`
          : `Day ${newStreak}! Streak recorded.`,
      streak: newStreak,
      reward_tyc: rewardTyc,
      verified_citizen: verifiedCitizen,
      gd_verified_bonus_tyc: verifiedCitizen ? gdVerifiedBonusTyc : 0,
      tx_hash: txHash || undefined,
      mint_to: mintToAddress,
    });
  } catch (err) {
    await trx.rollback();
    logger.error({ err: err?.message }, "dailyClaim error");
    return res.status(500).json({ success: false, message: "Daily claim failed" });
  }
}

/**
 * GET /api/rewards/daily-claim/status
 * Returns whether user can claim today and current streak (no auth required if we want public status; we require auth for consistency).
 */
export async function dailyClaimStatus(req, res) {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await db("users").where({ id: user_id }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const today = toDateOnly(new Date());
    const lastClaim = toDateOnly(user.last_daily_claim_at);
    const yesterday = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      return toDateOnly(d);
    })();
    const canClaim = lastClaim !== today;
    const streak = Number(user.login_streak || 0);

    let nextStreak = streak;
    if (canClaim) {
      if (lastClaim === yesterday) nextStreak = streak + 1;
      else if (!lastClaim) nextStreak = 1;
      else nextStreak = 1;
    }

    const eff = await getEffectiveDailyClaimConfig();
    const verifiedCitizen = await isUserGoodDollarVerified(user);
    const rewardPreview = computeDailyRewardWei(eff, nextStreak, verifiedCitizen);

    return res.json({
      success: true,
      can_claim: canClaim,
      streak,
      last_claim_at: user.last_daily_claim_at || null,
      verified_citizen: verifiedCitizen,
      gd_identity_enabled: isGoodDollarIdentityEnabled(),
      gd_verified_bonus_tyc: eff.gdVerifiedBonusTyc,
      estimated_reward_tyc: canClaim ? Number(rewardPreview.totalWei) / 1e18 : null,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "dailyClaimStatus error");
    return res.status(500).json({ success: false, message: "Failed to get status" });
  }
}
