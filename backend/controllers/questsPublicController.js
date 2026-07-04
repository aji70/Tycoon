import db from "../config/database.js";
import redis from "../config/redis.js";
import logger from "../config/logger.js";

export const PUBLIC_QUESTS_CACHE_KEY = "quests:public";
const CACHE_TTL_SECONDS = 300;

/** Call after admin writes to quest_definitions. */
export async function invalidatePublicQuestsCache() {
  await redis.del(PUBLIC_QUESTS_CACHE_KEY);
}

/**
 * GET /api/quests
 * Public read: active quest definitions only, ordered by sort_order then id.
 * No auth. Used by game client / future quest UI.
 */
export async function listPublicQuests(_req, res) {
  try {
    const cached = await redis.getJSON(PUBLIC_QUESTS_CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: cached });
    }
    const rows = await db("quest_definitions")
      .where("active", true)
      .select("id", "slug", "title", "description", "sort_order", "rules_json", "reward_hint", "updated_at")
      .orderBy("sort_order", "asc")
      .orderBy("id", "asc");

    const data = {
      quests: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        sortOrder: r.sort_order,
        rulesJson: r.rules_json,
        rewardHint: r.reward_hint,
        updatedAt: r.updated_at,
      })),
    };

    await redis.setJSON(PUBLIC_QUESTS_CACHE_KEY, data, CACHE_TTL_SECONDS);

    res.json({ success: true, data });
  } catch (err) {
    const missing =
      err.errno === 1146 ||
      err.code === "ER_NO_SUCH_TABLE" ||
      (typeof err.message === "string" && err.message.includes("doesn't exist"));
    if (missing) {
      return res.json({
        success: true,
        data: { quests: [], tableMissing: true },
      });
    }
    logger.error({ err }, "public listPublicQuests error");
    res.status(500).json({ success: false, error: "Failed to load quests" });
  }
}
