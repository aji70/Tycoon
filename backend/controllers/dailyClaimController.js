/**
 * Daily login / daily claim: track streak and optionally mint a TYC voucher to the user.
 */
import db from "../config/database.js";
import { mintVoucherTo, isContractConfigured } from "../services/tycoonContract.js";
import logger from "../config/logger.js";

const DEFAULT_DAILY_REWARD_TYC = "10";
const STREAK_BONUS_TYC = 5;

function toDateOnly(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

/**
 * POST /api/rewards/daily-claim
 * Body: { chain?: string } (optional; defaults to user's chain or BASE)
 * Requires auth. Claims daily reward: updates streak and mints voucher if contract is configured.
 */
export async function dailyClaim(req, res) {
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

    if (lastClaim === today) {
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

    // IMPORTANT: rewards/perks are typically held on the user's smart wallet.
    // If present, mint vouchers to smart_wallet_address so they show up in the profile (which reads smart wallet holdings).
    const mintToAddress =
      (user.smart_wallet_address && String(user.smart_wallet_address).trim() && String(user.smart_wallet_address).trim() !== "0x0000000000000000000000000000000000000000")
        ? String(user.smart_wallet_address).trim()
        : (user.linked_wallet_address && String(user.linked_wallet_address).trim()
            ? String(user.linked_wallet_address).trim()
            : String(user.address).trim());

    let rewardTyc = null;
    let txHash = null;

    if (isContractConfigured(normalizedChain)) {
      const baseReward = BigInt(DEFAULT_DAILY_REWARD_TYC) * BigInt(1e18);
      const streakBonus = BigInt(Math.min(newStreak - 1, 7)) * BigInt(STREAK_BONUS_TYC) * BigInt(1e18);
      const totalWei = baseReward + streakBonus;

      try {
        const { hash } = await mintVoucherTo(mintToAddress, totalWei.toString(), normalizedChain);
        txHash = hash;
        rewardTyc = Number(totalWei) / 1e18;
      } catch (mintErr) {
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

    await db("users")
      .where({ id: user_id })
      .update({
        last_daily_claim_at: new Date(),
        login_streak: newStreak,
        updated_at: new Date(),
      });

    return res.json({
      success: true,
      already_claimed: false,
      message: rewardTyc != null ? `Day ${newStreak}! You received ${rewardTyc} TYC.` : `Day ${newStreak}! Streak recorded.`,
      streak: newStreak,
      reward_tyc: rewardTyc,
      tx_hash: txHash || undefined,
      mint_to: mintToAddress,
    });
  } catch (err) {
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
    const canClaim = lastClaim !== today;

    return res.json({
      success: true,
      can_claim: canClaim,
      streak: Number(user.login_streak || 0),
      last_claim_at: user.last_daily_claim_at || null,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "dailyClaimStatus error");
    return res.status(500).json({ success: false, message: "Failed to get status" });
  }
}
