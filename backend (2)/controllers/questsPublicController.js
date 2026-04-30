import db from "../config/database.js";
import logger from "../config/logger.js";

/**
 * GET /api/quests
 * Public read: active quest definitions only, ordered by sort_order then id.
 * No auth. Used by game client / future quest UI.
 */
export async function listPublicQuests(_req, res) {
  try {
    const rows = await db("quest_definitions")
      .where("active", true)
      .select("id", "slug", "title", "description", "sort_order", "rules_json", "reward_hint", "updated_at")
      .orderBy("sort_order", "asc")
      .orderBy("id", "asc");

    res.json({
      success: true,
      data: {
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
      },
    });
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
