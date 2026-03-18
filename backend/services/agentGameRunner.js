/**
 * Agent game runner (server-autonomous).
 *
 * For AGENT_VS_AGENT / AGENT_VS_AI games, advances turns without any client open.
 * It intentionally reuses existing HTTP endpoints for game actions so the same
 * validation + DB transaction logic applies.
 */
import db from "../config/database.js";
import logger from "../config/logger.js";
import agentRegistry from "./agentRegistry.js";

const ENABLED = process.env.ENABLE_AGENT_GAME_RUNNER === "true";
const POLL_MS = Math.max(500, Number(process.env.AGENT_GAME_RUNNER_POLL_MS) || 2000);

const GAME_TYPES = new Set([
  "AGENT_VS_AGENT",
  "AGENT_VS_AI",
  "ONCHAIN_AGENT_VS_AGENT",
  "ONCHAIN_AGENT_VS_AI",
]);

// Simple in-process locks: gameId -> Promise chain
const locks = new Map();

function withGameLock(gameId, fn) {
  const id = Number(gameId);
  const prev = locks.get(id) || Promise.resolve();
  let resolve;
  const done = new Promise((r) => (resolve = r));
  locks.set(id, prev.then(() => done));
  return prev
    .then(fn)
    .catch((err) => {
      logger.warn({ err: err?.message, gameId: id }, "agent runner step failed");
    })
    .finally(() => {
      resolve();
      // Best-effort cleanup (only if no new chained work)
      if (locks.get(id) === done) locks.delete(id);
    });
}

function baseUrl() {
  const port = process.env.PORT || 3000;
  return `http://127.0.0.1:${port}/api`;
}

async function post(path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function rollDice() {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return { die1, die2, total: die1 + die2, is_double: die1 === die2 };
}

function isBuyableProperty(prop) {
  if (!prop) return false;
  const t = String(prop.type || "").toLowerCase();
  if (!prop.price || Number(prop.price) <= 0) return false;
  // Properties table uses free-form 'type'; keep this permissive.
  return !["corner", "chance", "community_chest", "income_tax", "luxury_tax", "special"].includes(t);
}

async function stepGame(game) {
  const gameId = Number(game.id);
  if (!gameId || game.status !== "RUNNING") return;
  if (!GAME_TYPES.has(String(game.game_type || ""))) return;

  const nextUserId = Number(game.next_player_id || 0);
  if (!nextUserId) return;

  // Resolve slot from turn_order (1..8).
  const gp = await db("game_players").where({ game_id: gameId, user_id: nextUserId }).first();
  if (!gp) return;
  const slot = Math.max(1, Math.min(8, Number(gp.turn_order || 1)));

  // Basic jail handling: if in jail at position 10, just stay (simple + deterministic).
  if (Number(gp.in_jail) === 1 && Number(gp.position) === 10) {
    await post("/game-players/stay-in-jail", { user_id: nextUserId, game_id: gameId });
    await post("/game-players/end-turn", { user_id: nextUserId, game_id: gameId });
    return;
  }

  // Roll and move.
  const dice = rollDice();
  const oldPos = Number(gp.position || 0);
  const newPos = (oldPos + dice.total) % 40;

  await post("/game-players/change-position", {
    user_id: nextUserId,
    game_id: gameId,
    position: newPos,
    rolled: dice.total,
    is_double: dice.is_double,
    die1: dice.die1,
    die2: dice.die2,
  });

  // Determine if we should buy landed property.
  const prop = await db("properties").where({ id: newPos }).first();
  if (!isBuyableProperty(prop)) {
    await post("/game-players/end-turn", { user_id: nextUserId, game_id: gameId });
    return;
  }

  const owned = await db("game_properties").where({ game_id: gameId, property_id: newPos }).first();
  if (owned) {
    await post("/game-players/end-turn", { user_id: nextUserId, game_id: gameId });
    return;
  }

  const myBalance = Number(gp.balance || 0);
  const decision = await agentRegistry.getAIDecision(gameId, slot, "property", {
    myBalance,
    myProperties: [], // keep minimal for now; can enrich later
    opponents: [], // keep minimal for now; can enrich later
    landedProperty: {
      id: prop.id,
      name: prop.name,
      price: Number(prop.price || 0),
      color: prop.color,
      completesMonopoly: false,
      landingRank: null,
    },
  });

  const wantsBuy = String(decision?.action || "").toLowerCase() === "buy";
  const canBuy = myBalance >= Number(prop.price || 0);
  if (wantsBuy && canBuy) {
    try {
      await post("/game-properties/buy", {
        user_id: nextUserId,
        game_id: gameId,
        property_id: prop.id,
      });
    } catch (err) {
      logger.warn({ err: err?.message, gameId, slot, property_id: prop.id }, "agent runner buy failed");
    }
  }

  await post("/game-players/end-turn", { user_id: nextUserId, game_id: gameId });
}

async function pollOnce() {
  const games = await db("games")
    .select("id", "status", "next_player_id", "game_type")
    .where({ status: "RUNNING" })
    .whereIn("game_type", Array.from(GAME_TYPES))
    .limit(50);

  await Promise.all(
    (games || []).map((g) => withGameLock(g.id, () => stepGame(g)))
  );
}

export function startAgentGameRunner() {
  if (!ENABLED) {
    logger.info("Agent game runner disabled (set ENABLE_AGENT_GAME_RUNNER=true to enable)");
    return;
  }

  logger.info({ pollMs: POLL_MS }, "Agent game runner starting");

  // No unref: keep process alive (server).
  setInterval(() => {
    pollOnce().catch((err) =>
      logger.warn({ err: err?.message }, "Agent game runner poll failed")
    );
  }, POLL_MS);
}

