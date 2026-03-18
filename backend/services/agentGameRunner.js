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

function isHouseBuildableType(propType) {
  // In this game, houses/hotels are only for the colored "property" tiles.
  // Railroads/utilities don't build houses.
  return String(propType || "").toLowerCase() === "property";
}

async function maybeBuildHouses({ gameId, gp, slot, myBalance }) {
  // gp is a row from game_players (contains: id, user_id, in_jail?, position, balance, turn_order, etc.)
  if (!gp?.id) return;

  // Owned properties for this game seat (game_properties.player_id references game_players.id)
  const ownedProps = await db("game_properties")
    .where({ game_id: gameId, player_id: gp.id })
    .select("property_id", "development", "mortgaged");

  if (!ownedProps?.length) return;

  const ownedPropertyIds = ownedProps.map((o) => Number(o.property_id));
  const ownedById = new Map(ownedProps.map((o) => [Number(o.property_id), o]));

  // Load metadata for owned properties
  const ownedMeta = await db("properties")
    .whereIn("id", ownedPropertyIds)
    .select("id", "type", "group_id", "cost_of_house");

  const ownedMetaById = new Map(ownedMeta.map((p) => [Number(p.id), p]));

  // Consider only groups that contain buildable "property" tiles.
  const candidateGroupIds = Array.from(
    new Set(
      ownedMeta
        .filter((p) => isHouseBuildableType(p.type))
        .map((p) => Number(p.group_id || 0))
        .filter((gid) => gid > 0)
    )
  );
  if (!candidateGroupIds.length) return;

  // Fetch full set of properties per candidate group (again only buildable "property" tiles)
  const groupProps = await db("properties")
    .whereIn("group_id", candidateGroupIds)
    .andWhereRaw("LOWER(type) = 'property'")
    .select("id", "group_id", "type", "cost_of_house");

  const groupToPropIds = new Map();
  for (const p of groupProps) {
    const gid = Number(p.group_id || 0);
    if (!groupToPropIds.has(gid)) groupToPropIds.set(gid, []);
    groupToPropIds.get(gid).push(Number(p.id));
  }

  // Buildable candidates: complete monopoly groups, non-mortgaged props, development < 5, affordable
  const buildCandidates = [];

  for (const gid of candidateGroupIds) {
    const ids = groupToPropIds.get(gid) || [];
    if (!ids.length) continue;

    // Must own every property in the group
    const ownsAll = ids.every((id) => ownedById.has(id));
    if (!ownsAll) continue;

    // Can't build on mortgaged properties; and we disallow that group if any property is mortgaged.
    const anyMortgaged = ids.some((id) => Boolean(ownedById.get(id)?.mortgaged));
    if (anyMortgaged) continue;

    for (const pid of ids) {
      const owned = ownedById.get(pid);
      if (!owned) continue;
      const dev = Number(owned.development ?? 0);
      if (dev >= 5) continue;
      const meta = ownedMetaById.get(pid);
      const cost = Number(meta?.cost_of_house ?? 0);
      if (cost <= 0) continue;
      if (myBalance < cost) continue;
      buildCandidates.push({ propertyId: pid, development: dev, cost, groupId: gid });
    }
  }

  if (!buildCandidates.length) return;

  // Try the agent decision first (preferred).
  // If it fails or points to a non-candidate, fallback to a safe heuristic.
  try {
    const decision = await agentRegistry.getAIDecision(gameId, slot, "building", {
      myBalance,
      // Provide enough info for smarter agents without bloating context.
      myProperties: buildCandidates.map((c) => ({
        propertyId: c.propertyId,
        development: c.development,
        cost_of_house: c.cost,
        group_id: c.groupId,
      })),
    });

    const wantsBuild = String(decision?.action || "").toLowerCase() === "build";
    const targetId = wantsBuild ? Number(decision?.propertyId ?? decision?.property_id ?? 0) : 0;
    const target = buildCandidates.find((c) => c.propertyId === targetId);
    if (target) {
      await post("/game-properties/development", {
        user_id: gp.user_id,
        game_id: gameId,
        property_id: target.propertyId,
      });
      return;
    }
  } catch (err) {
    logger.warn({ err: err?.message, gameId, slot }, "agent build decision failed; using fallback");
  }

  // Fallback: build on the lowest-development candidate (typical Monopoly building rule).
  buildCandidates.sort((a, b) => (a.development ?? 0) - (b.development ?? 0) || (a.cost ?? 0) - (b.cost ?? 0));
  const target = buildCandidates[0];
  if (!target) return;

  await post("/game-properties/development", {
    user_id: gp.user_id,
    game_id: gameId,
    property_id: target.propertyId,
  });
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

  // Pre-roll build phase: agents should build on their turn start when they have monopoly.
  // This mirrors the frontend "pre-roll build" flow and avoids only building on turns
  // where they happen to land on an unowned property.
  const myBalance = Number(gp.balance || 0);
  if (Number(gp.in_jail) !== 1) {
    try {
      await maybeBuildHouses({ gameId, gp, slot, myBalance });
    } catch (err) {
      logger.warn({ err: err?.message, gameId, slot }, "agent runner pre-roll build failed");
    }
  }

  // Basic jail handling: if in jail at position 10, just stay (simple + deterministic).
  if (Number(gp.in_jail) === 1 && Number(gp.position) === 10) {
    // Give the agent better options than always "stay":
    // 1) Use a Get Out of Jail Free card (Chance or Community Chest)
    // 2) If no card, pay $50 to leave jail (if balance allows)
    // 3) Otherwise, stay in jail (advances to next player)
    const chanceCards = Number(gp.chance_jail_card || 0);
    const chestCards = Number(gp.community_chest_jail_card || 0);
    // Use the pre-fetched balance (avoids re-querying during the pre-roll phase).

    try {
      if (chanceCards > 0) {
        await post("/game-players/use-get-out-of-jail-free", {
          user_id: nextUserId,
          game_id: gameId,
          card_type: "chance",
        });
        // Note: backend does NOT end turn here — player can then roll on next poll.
        return;
      }
      if (chestCards > 0) {
        await post("/game-players/use-get-out-of-jail-free", {
          user_id: nextUserId,
          game_id: gameId,
          card_type: "community_chest",
        });
        // Note: backend does NOT end turn here — player can then roll on next poll.
        return;
      }
      if (myBalance >= 50) {
        await post("/game-players/pay-to-leave-jail", { user_id: nextUserId, game_id: gameId });
        // Note: backend does NOT end turn here — player can then roll on next poll.
        return;
      }
    } catch (err) {
      logger.warn(
        { err: err?.message, gameId: gameId, user_id: nextUserId },
        "agent runner jail decision failed; falling back to stay-in-jail"
      );
    }

    await post("/game-players/stay-in-jail", { user_id: nextUserId, game_id: gameId });
    // stay-in-jail already advances to next player, so no need to end-turn explicitly.
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

