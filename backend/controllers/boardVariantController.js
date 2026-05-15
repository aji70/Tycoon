import { findActiveBoardVariants } from "../utils/boardVariant.js";

export async function listActive(req, res) {
  try {
    const rows = await findActiveBoardVariants();
    res.json({ success: true, message: "successful", data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Failed to load board variants" });
  }
}
