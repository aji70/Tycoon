import db from "../config/database.js";
import logger from "../config/logger.js";
import {
  getUserGoodDollarVerificationDetail,
  isGoodDollarIdentityEnabled,
} from "../services/goodDollarIdentity.js";

/**
 * GET /api/gooddollar/status
 * Returns the same verification bit the MiniPay play gate uses, plus the
 * addresses that were checked so the UI can show which wallet was tested.
 * Auth required (requireAuthOrWallet) — mounted in server.js.
 */
export async function goodDollarStatus(req, res) {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await db("users").where({ id: user_id }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const enabled = isGoodDollarIdentityEnabled();
    const { verified, checkedAddresses } = await getUserGoodDollarVerificationDetail(user);

    return res.json({
      success: true,
      enabled,
      verified,
      checkedAddresses,
      verifyUrl: "https://goodid.gooddollar.org/",
    });
  } catch (err) {
    logger.error({ err: err?.message }, "goodDollarStatus error");
    return res.status(500).json({ success: false, message: "Failed to get GoodDollar status" });
  }
}
