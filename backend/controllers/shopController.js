/**
 * Shop: perk bundles (list only; purchase requires contract buyBundle support).
 */
import db from "../config/database.js";

export async function listBundles(req, res) {
  try {
    const bundles = await db("perk_bundles")
      .where({ active: true })
      .orderBy("id", "asc")
      .select("id", "name", "description", "token_ids", "amounts", "price_tyc", "price_usdc", "created_at");

    return res.json({
      success: true,
      bundles: bundles.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        token_ids: b.token_ids,
        amounts: b.amounts,
        price_tyc: String(b.price_tyc ?? 0),
        price_usdc: String(b.price_usdc ?? 0),
      })),
    });
  } catch (err) {
    console.error("listBundles error:", err);
    return res.status(500).json({ success: false, message: "Failed to list bundles" });
  }
}
