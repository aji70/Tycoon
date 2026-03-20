/**
 * Users with at least one agent and a configured smart wallet — eligible for free (0 entry fee) tournaments without spending permission.
 */
import db from "../config/database.js";

/**
 * One row per user_id (most recently updated agent). Shape matches auto-fill / runner expectations.
 * @returns {Promise<{ user_id: number, user_agent_id: number, max_entry_fee_usdc: string, daily_cap_usdc: null }[]>}
 */
export async function listAgentSmartWalletCandidates() {
  const rows = await db("user_agents as ua")
    .join("users as u", "u.id", "ua.user_id")
    .whereNotNull("u.smart_wallet_address")
    .whereRaw("TRIM(u.smart_wallet_address) <> ''")
    .whereRaw("LOWER(TRIM(u.smart_wallet_address)) <> ?", ["0x0000000000000000000000000000000000000000"])
    .select("ua.user_id", "ua.id as user_agent_id", "ua.updated_at")
    .orderBy("ua.updated_at", "desc");

  const byUser = new Map();
  for (const r of rows || []) {
    const uid = Number(r.user_id);
    const aid = Number(r.user_agent_id);
    if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(aid) || aid <= 0) continue;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        user_id: uid,
        user_agent_id: aid,
        max_entry_fee_usdc: "0",
        daily_cap_usdc: null,
      });
    }
  }
  return Array.from(byUser.values());
}
