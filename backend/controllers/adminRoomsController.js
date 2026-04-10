import db from "../config/database.js";
import logger from "../config/logger.js";
import Game from "../models/Game.js";
import { invalidateGameById } from "../utils/gameCache.js";
import { emitGameUpdate } from "../utils/socketHelpers.js";
import { recordEvent } from "../services/analytics.js";

const NON_TERMINAL = ["PENDING", "RUNNING", "IN_PROGRESS", "AWAITING_PLAYERS"];

function parseStatusFilter(raw) {
  const s = raw != null ? String(raw).trim().toLowerCase() : "active";
  if (s === "all" || s === "") return null;
  if (s === "active") return { mode: "not_terminal" };
  if (s === "finished") return { mode: "one", statuses: ["FINISHED"] };
  if (s === "cancelled") return { mode: "one", statuses: ["CANCELLED"] };
  if (s === "pending") return { mode: "one", statuses: ["PENDING"] };
  if (s === "running") return { mode: "one", statuses: ["RUNNING", "IN_PROGRESS"] };
  const parts = s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  if (parts.length) return { mode: "one", statuses: parts };
  return { mode: "not_terminal" };
}

function applyStatusFilter(qb, filter) {
  if (!filter) return;
  if (filter.mode === "not_terminal") {
    qb.whereNotIn("g.status", ["FINISHED", "CANCELLED"]);
    return;
  }
  if (filter.mode === "one" && filter.statuses?.length) {
    qb.whereIn("g.status", filter.statuses);
  }
}

function durationRunningMs(game) {
  const start = game.started_at ? new Date(game.started_at).getTime() : new Date(game.created_at).getTime();
  const end = ["FINISHED", "CANCELLED"].includes(game.status)
    ? new Date(game.updated_at || game.created_at).getTime()
    : Date.now();
  return Math.max(0, end - start);
}

/**
 * GET /api/admin/rooms
 * Query: page, pageSize, status (active|all|pending|running|finished|cancelled|comma statuses), q (code or id)
 */
export async function listRooms(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const filter = parseStatusFilter(req.query.status);
    const q = req.query.q != null ? String(req.query.q).trim() : "";

    const countBase = db("games as g");
    applyStatusFilter(countBase, filter);
    if (q) {
      if (/^\d+$/.test(q)) {
        countBase.where(function () {
          this.where("g.id", Number(q)).orWhereRaw("UPPER(g.code) LIKE ?", [`%${q.toUpperCase()}%`]);
        });
      } else {
        countBase.whereRaw("UPPER(g.code) LIKE ?", [`%${q.toUpperCase()}%`]);
      }
    }
    const countRow = await countBase.clone().count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    let listQ = db("games as g")
      .select(
        "g.id",
        "g.code",
        "g.status",
        "g.mode",
        "g.chain",
        "g.is_ai",
        "g.creator_id",
        "g.winner_id",
        "g.number_of_players",
        "g.created_at",
        "g.updated_at",
        "g.started_at",
        "g.duration",
        "g.contract_game_id"
      )
      .select(db.raw("(SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count"));

    applyStatusFilter(listQ, filter);
    if (q) {
      if (/^\d+$/.test(q)) {
        listQ.where(function () {
          this.where("g.id", Number(q)).orWhereRaw("UPPER(g.code) LIKE ?", [`%${q.toUpperCase()}%`]);
        });
      } else {
        listQ.whereRaw("UPPER(g.code) LIKE ?", [`%${q.toUpperCase()}%`]);
      }
    }

    listQ = listQ.orderBy("g.updated_at", "desc").offset((page - 1) * pageSize).limit(pageSize);

    const rows = await listQ;
    const rooms = rows.map((g) => ({
      id: g.id,
      code: g.code,
      status: g.status,
      mode: g.mode,
      chain: g.chain,
      isAi: !!g.is_ai,
      creatorId: g.creator_id,
      winnerId: g.winner_id,
      numberOfPlayers: g.number_of_players,
      playerCount: Number(g.player_count ?? 0),
      durationMs: durationRunningMs(g),
      contractGameId: g.contract_game_id ?? null,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
      startedAt: g.started_at,
      durationSetting: g.duration,
    }));

    res.json({
      success: true,
      data: { rooms, total, page, pageSize, statusFilter: req.query.status ?? "active" },
    });
  } catch (err) {
    logger.error({ err }, "admin listRooms error");
    res.status(500).json({ success: false, error: "Failed to list rooms" });
  }
}

/**
 * GET /api/admin/rooms/:id
 */
export async function getRoomById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid game id" });
    }

    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    const playerCountRow = await db("game_players").where({ game_id: id }).count("* as c").first();
    const playerCount = Number(playerCountRow?.c ?? 0);

    const players = await db("game_players as gp")
      .join("users as u", "u.id", "gp.user_id")
      .where("gp.game_id", id)
      .select(
        "gp.id as game_player_id",
        "gp.user_id",
        "u.username",
        "u.address as user_address",
        "gp.balance",
        "gp.position",
        "gp.turn_order",
        "gp.turn_count",
        "gp.symbol"
      )
      .orderBy("gp.turn_order", "asc");

    const properties = await db("game_properties as gp")
      .join("properties as p", "p.id", "gp.property_id")
      .where("gp.game_id", id)
      .select(
        "gp.id as row_id",
        "gp.property_id",
        "p.name as property_name",
        "gp.mortgaged",
        "gp.player_id as game_player_id_fk"
      );

    const history = await db("game_play_history")
      .where({ game_id: id })
      .select("id", "action", "amount", "rolled", "old_position", "new_position", "comment", "created_at")
      .orderBy("id", "desc")
      .limit(40);

    const safeGame = { ...game };
    delete safeGame.placements;

    res.json({
      success: true,
      data: {
        game: safeGame,
        meta: {
          playerCount,
          durationMs: durationRunningMs(game),
        },
        players,
        properties,
        historyTail: history.reverse(),
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getRoomById error");
    res.status(500).json({ success: false, error: "Failed to load room" });
  }
}

/**
 * POST /api/admin/rooms/:id/cancel
 * Sets status to CANCELLED for non-terminal games (DB + cache + socket). Does not unwind on-chain state.
 */
export async function cancelRoom(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid game id" });
    }

    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    if (!NON_TERMINAL.includes(game.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel game in status ${game.status}`,
      });
    }

    await Game.update(id, { status: "CANCELLED" });
    await recordEvent("admin_game_cancelled", {
      entityType: "game",
      entityId: id,
      payload: { code: game.code ?? null, reason: (req.body && req.body.reason) || null },
    });
    await invalidateGameById(id);
    const io = req.app.get("io");
    if (io && game.code) emitGameUpdate(io, game.code);

    const updated = await Game.findById(id);
    res.json({ success: true, data: { game: updated } });
  } catch (err) {
    logger.error({ err }, "admin cancelRoom error");
    res.status(500).json({ success: false, error: "Failed to cancel room" });
  }
}
