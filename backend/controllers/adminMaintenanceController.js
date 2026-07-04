import logger from "../config/logger.js";
import {
  countGamePlayHistory,
  runGamePlayHistoryMaintenance,
} from "../services/gamePlayHistoryMaintenance.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

/** GET /api/admin/dashboard/maintenance/game-history */
export async function getGameHistoryStats(req, res) {
  try {
    const totalRows = await countGamePlayHistory();
    const dry = await runGamePlayHistoryMaintenance({ dryRun: true });
    res.json({
      success: true,
      data: {
        totalRows,
        prunableOlderThan30d: dry.prunableOlderThanRetention,
        prunableAllFinished: dry.prunableAllFinished,
      },
    });
  } catch (err) {
    logger.error({ err }, "getGameHistoryStats failed");
    res.status(500).json({ success: false, error: "Failed to load game history stats" });
  }
}

/** POST /api/admin/dashboard/maintenance/prune-game-history — manual only; never runs automatically. */
export async function postPruneGameHistory(req, res) {
  try {
    const aggressive = req.body?.aggressive === true;
    const result = await runGamePlayHistoryMaintenance({ aggressive });
    await appendAdminAuditLog({
      action: "maintenance.prune_game_history",
      targetType: "game_play_history",
      payload: result,
      req,
    }).catch(() => {});
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, "postPruneGameHistory failed");
    res.status(500).json({
      success: false,
      error: err?.message || "Prune failed",
    });
  }
}
