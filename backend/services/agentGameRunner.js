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
import * as eloService from "./eloService.js";

const ENABLED = process.env.ENABLE_AGENT_GAME_RUNNER === "true";
const POLL_MS = Math.max(500, Number(process.env.AGENT_GAME_RUNNER_POLL_MS) || 2000);
// Hard safety caps for UNTlMED games (duration = 0 or missing).
// When a cap triggers, we end by net worth using the existing
// `POST /game-players/vote-end-by-networth` endpoint (AI games need only 1 vote).
const UNTIMED_WALLCLOCK_CAP_MIN = Math.max(0, Number(process.env.UNTIMED_AGENT_GAME_WALLCLOCK_CAP_MIN) || 30);
const UNTIMED_TURN_CAP = Math.max(0, Number(process.env.UNTIMED_AGENT_GAME_TURN_CAP) || 250);

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

function getMonopolyGroups() {
  // Must match frontend/internalAgent's colorGroups mapping (by property id).
  // These ids are the "tile numbers" on the board.
  return {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
  };
}

function completesMonopolyAfterBuy(landedPropertyId, ownedPropertyIds) {
  if (!landedPropertyId || !Array.isArray(ownedPropertyIds)) return false;
  const groups = getMonopolyGroups();
  const ownedSet = new Set(ownedPropertyIds.map((id) => Number(id)));
  // Completion only matters for standard "colored property" sets; ignore railroads/utilities.
  for (const ids of Object.values(groups)) {
    if (!ids.includes(landedPropertyId)) continue;
    const wouldOwnAll = ids.every((id) => ownedSet.has(Number(id)) || Number(id) === Number(landedPropertyId));
    if (wouldOwnAll) return true;
  }
  return false;
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

  try {
    const { eliminateNegativeBalancePlayersForAgentGames } = await import(
      "../controllers/gamePlayerController.js"
    );
    await eliminateNegativeBalancePlayersForAgentGames(gameId, null);
  } catch (err) {
    logger.warn({ err: err?.message, gameId }, "eliminateNegativeBalancePlayers failed");
  }

  const refreshed = await db("games")
    .where({ id: gameId })
    .select(
      "id",
      "status",
      "next_player_id",
      "game_type",
      "duration",
      "created_at",
      "started_at",
      "code",
      "chain",
      "contract_game_id"
    )
    .first();
  if (!refreshed || refreshed.status !== "RUNNING") return;
  Object.assign(game, refreshed);

  // Auto-finish timed games.
  // The runner previously advanced turns forever because it never called
  // the existing `POST /games/:id/finish-by-time` endpoint.
  const durationMinutes = Number(game.duration) || 0;
  if (durationMinutes > 0) {
    const startAt = game.started_at || game.created_at;
    const startMs = startAt ? new Date(startAt).getTime() : null;
    if (startMs != null && Number.isFinite(startMs)) {
      const endMs = startMs + durationMinutes * 60 * 1000;
      // Keep consistent with finishByTime: allow up to 30s grace.
      if (Date.now() >= endMs - 30000) {
        try {
          await post(`/games/${gameId}/finish-by-time`, {});
        } catch (err) {
          // If another request already finished it, or it failed for any reason,
          // don't crash the runner.
          logger.warn(
            { err: err?.message, gameId, durationMinutes },
            "agent runner finishByTime failed"
          );
        }
        return;
      }
    }
  }

  const nextUserId = Number(game.next_player_id || 0);
  if (!nextUserId) return;

  // Hard safety caps for untimed games (duration = 0).
  // 1) Wall-clock: if it runs too long, end by net worth.
  if (durationMinutes <= 0 && UNTIMED_WALLCLOCK_CAP_MIN > 0) {
    const startAt = game.started_at || game.created_at;
    const startMs = startAt ? new Date(startAt).getTime() : null;
    if (startMs != null && Number.isFinite(startMs)) {
      const endMs = startMs + UNTIMED_WALLCLOCK_CAP_MIN * 60 * 1000;
      if (Date.now() >= endMs) {
        try {
          await post("/game-players/vote-end-by-networth", { game_id: gameId, user_id: nextUserId });
        } catch (err) {
          logger.warn(
            { err: err?.message, gameId, nextUserId },
            "agent runner untimed wallclock cap ended game failed"
          );
        }
        return;
      }
    }
  }

  // Resolve slot from turn_order (1..8).
  const gp = await db("game_players").where({ game_id: gameId, user_id: nextUserId }).first();
  if (!gp) return;
  const slot = Math.max(1, Math.min(8, Number(gp.turn_order || 1)));

  // Pre-roll build phase: agents should build on their turn start when they have monopoly.
  // This mirrors the frontend "pre-roll build" flow and avoids only building on turns
  // where they happen to land on an unowned property.
  const myBalance = Number(gp.balance || 0);

  // 2) Turn cap: end after too many turns (untimed games only).
  if (durationMinutes <= 0 && UNTIMED_TURN_CAP > 0 && Number(gp.turn_count || 0) >= UNTIMED_TURN_CAP) {
    try {
      await post("/game-players/vote-end-by-networth", { game_id: gameId, user_id: nextUserId });
    } catch (err) {
      logger.warn(
        { err: err?.message, gameId, nextUserId, turn_count: gp.turn_count },
        "agent runner untimed turn cap ended game failed"
      );
    }
    return;
  }

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

  // Compute owned properties for this agent seat so the decision engine can
  // correctly detect when buying completes a Monopoly set.
  const myOwned = await db("game_properties")
    .where({ game_id: gameId, player_id: gp.id })
    .select("property_id");
  const myOwnedPropertyIds = (myOwned || []).map((r) => Number(r.property_id));
  const myProperties = myOwnedPropertyIds.map((id) => ({ id }));

  const completesMono = completesMonopolyAfterBuy(Number(newPos), myOwnedPropertyIds);

  const decision = await agentRegistry.getAIDecision(gameId, slot, "property", {
    myBalance,
    myProperties,
    opponents: [], // keep minimal for now; can enrich later
    landedProperty: {
      id: prop.id,
      name: prop.name,
      price: Number(prop.price || 0),
      color: prop.color,
      completesMonopoly: completesMono,
      landingRank: null,
    },
  });

  const propPrice = Number(prop.price || 0);
  const canBuy = myBalance >= propPrice;

  let wantsBuy = String(decision?.action || "").toLowerCase() === "buy";
  // Fallback when no agent decision is available (e.g. AGENT_VS_AGENT games with no
  // external callback and internal agent gated behind game.is_ai):
  if (!decision) {
    const balanceAfter = myBalance - propPrice;
    const reserveOk = balanceAfter >= 500; // matches INTERNAL_AGENT CASH_RESERVE_MIN = 500
    wantsBuy = completesMono || (canBuy && reserveOk);
  }

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

/**
 * Check for newly completed AGENT_VS_AGENT games and record ELO changes.
 * This runs separately from game stepping to handle post-game processing.
 */
async function processCompletedArenaMatches() {
  try {
    // Games use FINISHED when a match ends (not COMPLETED)
    const completedGames = await db("games")
      .select("games.id", "games.game_type", "games.status")
      .whereIn("games.game_type", ["AGENT_VS_AGENT", "ONCHAIN_AGENT_VS_AGENT"])
      .where("games.status", "FINISHED")
      .whereNotExists(
        db("agent_arena_matches")
          .where("agent_arena_matches.game_id", db.raw("games.id"))
          .where("agent_arena_matches.status", "COMPLETED")
      )
      .limit(10);

    for (const game of completedGames) {
      try {
        // Get game players to find the agents and winner
        const players = await db("game_players")
          .where("game_id", game.id)
          .select("user_id", "balance", "turn_order");

        if (players.length !== 2) {
          // Multi-seat on-chain arena: XP is only recorded for 2-player agent games
          if (players.length > 2) continue;
          logger.warn({ gameId: game.id, playerCount: players.length }, "Expected 2 players in agent arena game");
          continue;
        }

        const bindings = await db("agent_slot_assignments")
          .where("game_id", game.id)
          .whereNotNull("user_agent_id")
          .orderBy("slot", "asc");

        let agentA;
        let agentB;
        if (bindings.length >= 2) {
          agentA = await db("user_agents").where("id", bindings[0].user_agent_id).first();
          agentB = await db("user_agents").where("id", bindings[1].user_agent_id).first();
        }
        if (!agentA || !agentB) {
          const player1Agents = await db("user_agents").where("user_id", players[0].user_id);
          const player2Agents = await db("user_agents").where("user_id", players[1].user_id);
          agentA = player1Agents.find((a) => a.status === "active");
          agentB = player2Agents.find((a) => a.status === "active");
        }

        if (!agentA || !agentB) {
          logger.warn({ gameId: game.id }, "Could not resolve user_agents for arena game");
          continue;
        }

        // Winner is the player with higher balance
        let winnerId = null;
        if (players[0].balance > players[1].balance) {
          winnerId = agentA.id;
        } else if (players[1].balance > players[0].balance) {
          winnerId = agentB.id;
        }
        // else: draw (both null)

        // Record ELO result
        await eloService.recordArenaResult(agentA.id, agentB.id, winnerId, game.id);
        logger.info(
          { gameId: game.id, agentAId: agentA.id, agentBId: agentB.id, winnerId },
          "Recorded arena match result and ELO change"
        );
      } catch (err) {
        logger.error(
          { err: err?.message, gameId: game.id },
          "Failed to process completed arena match"
        );
      }
    }
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to process completed arena matches");
  }
}

async function pollOnce() {
  const games = await db("games")
    .select("id", "status", "next_player_id", "game_type", "duration", "created_at", "started_at")
    .where({ status: "RUNNING" })
    .whereIn("game_type", Array.from(GAME_TYPES))
    .limit(50);

  await Promise.all(
    (games || []).map((g) => withGameLock(g.id, () => stepGame(g)))
  );

  // Process newly completed arena matches for ELO
  await processCompletedArenaMatches();
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

