/**
 * Agent game runner (server-autonomous).
 *
 * For AGENT_VS_AGENT / AGENT_VS_AI games, advances turns without any client open.
 * It intentionally reuses existing HTTP endpoints for game actions so the same
 * validation + DB transaction logic applies.
 */
import db from "../config/database.js";
import logger from "../config/logger.js";
import GameSetting from "../models/GameSetting.js";
import agentRegistry from "./agentRegistry.js";
import * as eloService from "./eloService.js";

const ENABLED = process.env.ENABLE_AGENT_GAME_RUNNER === "true";
const POLL_MS = Math.max(500, Number(process.env.AGENT_GAME_RUNNER_POLL_MS) || 2000);
// Hard safety caps for UNTlMED games (duration = 0 or missing).
// When a cap triggers, we end by net worth using the existing
// `POST /game-players/vote-end-by-networth` endpoint (AI games need only 1 vote).
const UNTIMED_WALLCLOCK_CAP_MIN = Math.max(0, Number(process.env.UNTIMED_AGENT_GAME_WALLCLOCK_CAP_MIN) || 30);
const UNTIMED_TURN_CAP = Math.max(0, Number(process.env.UNTIMED_AGENT_GAME_TURN_CAP) || 250);

/**
 * Recovery: payout rows exist but arena_match_stakes left COLLECTED (e.g. ELO ran before payout finished).
 */
async function syncArenaStakePaidOutIfPayoutsExist(gameId) {
  const stake = await db("arena_match_stakes").where("game_id", gameId).where("status", "COLLECTED").first();
  if (!stake?.tournament_id) return;
  const r = await db("tournament_payouts").where({ tournament_id: stake.tournament_id }).count("* as c").first();
  const n = Number(r?.c ?? 0);
  if (n > 0) {
    await db("arena_match_stakes").where("id", stake.id).update({
      status: "PAID_OUT",
      paid_out_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    logger.info({ gameId, tournamentId: stake.tournament_id, payoutRows: n }, "Arena stake → PAID_OUT (payout rows present)");
  }
}

const GAME_TYPES = new Set([
  "AGENT_VS_AGENT",
  "AGENT_VS_AI",
  "ONCHAIN_AGENT_VS_AGENT",
  "ONCHAIN_AGENT_VS_AI",
  "ONCHAIN_HUMAN_VS_AGENT",
  "TOURNAMENT_AGENT_VS_AGENT",
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

async function endGameByCaps(gameId, userId, reason) {
  try {
    await post("/game-players/vote-end-by-networth", { game_id: gameId, user_id: userId });
    logger.info({ gameId, userId, reason }, "agent runner ended game by net-worth vote");
    return true;
  } catch (voteErr) {
    logger.warn({ err: voteErr?.message, gameId, userId, reason }, "agent runner net-worth vote failed, trying finish-by-time fallback");
    try {
      await post(`/games/${gameId}/finish-by-time`, {});
      logger.info({ gameId, reason }, "agent runner ended game by finish-by-time fallback");
      return true;
    } catch (finishErr) {
      logger.error(
        { err: finishErr?.message, voteErr: voteErr?.message, gameId, userId, reason },
        "agent runner cap enforcement failed"
      );
      return false;
    }
  }
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

/** Monopoly even-build: only properties at min development within each color group. */
function filterBuildCandidatesEvenBuild(buildCandidates) {
  const byGroup = new Map();
  for (const c of buildCandidates) {
    const g = c.groupId;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(c);
  }
  const out = [];
  for (const list of byGroup.values()) {
    const minD = Math.min(...list.map((x) => x.development));
    for (const c of list) {
      if (c.development === minD) out.push(c);
    }
  }
  return out;
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

  const gameSettings = await GameSetting.findByGameId(gameId);
  const evenBuild = Boolean(gameSettings?.even_build);
  const candidatesForAgent = evenBuild ? filterBuildCandidatesEvenBuild(buildCandidates) : buildCandidates;
  if (!candidatesForAgent.length) return;

  // Try the agent decision first (preferred).
  // If it fails or points to a non-candidate, fallback to a safe heuristic.
  try {
    const decision = await agentRegistry.getAIDecision(gameId, slot, "building", {
      myBalance,
      // Provide enough info for smarter agents without bloating context.
      myProperties: candidatesForAgent.map((c) => ({
        propertyId: c.propertyId,
        development: c.development,
        cost_of_house: c.cost,
        group_id: c.groupId,
      })),
    });

    const wantsBuild = String(decision?.action || "").toLowerCase() === "build";
    const targetId = wantsBuild ? Number(decision?.propertyId ?? decision?.property_id ?? 0) : 0;
    const target = candidatesForAgent.find((c) => c.propertyId === targetId);
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
  candidatesForAgent.sort(
    (a, b) => (a.development ?? 0) - (b.development ?? 0) || (a.cost ?? 0) - (b.cost ?? 0)
  );
  const target = candidatesForAgent[0];
  if (!target) return;

  await post("/game-properties/development", {
    user_id: gp.user_id,
    game_id: gameId,
    property_id: target.propertyId,
  });
}

async function stepGame(game) {
  const gameId = Number(game.id);
  if (!gameId || !["RUNNING", "IN_PROGRESS"].includes(game.status)) return;
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
  if (!refreshed || !["RUNNING", "IN_PROGRESS"].includes(refreshed.status)) return;
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
        await endGameByCaps(gameId, nextUserId, "untimed_wallclock_cap");
        return;
      }
    }
  }

  // Resolve slot from turn_order (1..8).
  const gp = await db("game_players").where({ game_id: gameId, user_id: nextUserId }).first();
  if (!gp) return;
  const slot = Math.max(1, Math.min(8, Number(gp.turn_order || 1)));

  // Human plays seat 1; only the opponent agent (seat 2+) is auto-driven.
  if (String(game.game_type || "") === "ONCHAIN_HUMAN_VS_AGENT" && slot === 1) {
    return;
  }

  // Pre-roll build phase: agents should build on their turn start when they have monopoly.
  // This mirrors the frontend "pre-roll build" flow and avoids only building on turns
  // where they happen to land on an unowned property.
  const myBalance = Number(gp.balance || 0);

  // 2) Turn cap: end after too many turns (untimed games only).
  if (durationMinutes <= 0 && UNTIMED_TURN_CAP > 0 && Number(gp.turn_count || 0) >= UNTIMED_TURN_CAP) {
    await endGameByCaps(gameId, nextUserId, "untimed_turn_cap");
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
      .whereIn("games.game_type", ["AGENT_VS_AGENT", "ONCHAIN_AGENT_VS_AGENT", "ONCHAIN_HUMAN_VS_AGENT"])
      .where("games.status", "FINISHED")
      .where(function humanOrAgentArena() {
        this.where(function agentVsAgent() {
          this.whereIn("games.game_type", ["AGENT_VS_AGENT", "ONCHAIN_AGENT_VS_AGENT"]).whereNotExists(
            db("agent_arena_matches")
              .where("agent_arena_matches.game_id", db.raw("games.id"))
              .where("agent_arena_matches.status", "COMPLETED")
          );
        }).orWhere(function humanVsAgent() {
          this.where("games.game_type", "ONCHAIN_HUMAN_VS_AGENT").whereNull("games.arena_completion_at");
        });
      })
      .limit(10);

    for (const game of completedGames) {
      try {
        const playersRaw = await db("game_players")
          .where("game_id", game.id)
          .select("user_id", "balance", "turn_order");

        if (playersRaw.length !== 2) {
          if (playersRaw.length > 2) continue;
          logger.warn({ gameId: game.id, playerCount: playersRaw.length }, "Expected 2 players in agent arena game");
          continue;
        }

        const players = [...playersRaw].sort((a, b) => Number(a.turn_order || 0) - Number(b.turn_order || 0));
        const isHumanVsAgent = String(game.game_type || "") === "ONCHAIN_HUMAN_VS_AGENT";

        if (isHumanVsAgent) {
          const ph = players[0];
          const po = players[1];
          let winnerEntryId = null;
          if (Number(ph.balance) > Number(po.balance)) winnerEntryId = "a";
          else if (Number(po.balance) > Number(ph.balance)) winnerEntryId = "b";

          const stakeRow = await db("arena_match_stakes").where("game_id", game.id).where("status", "COLLECTED").first();
          if (stakeRow?.tournament_id) {
            const TournamentMatch = (await import("../models/TournamentMatch.js")).default;
            const Tournament = (await import("../models/Tournament.js")).default;
            const match = await TournamentMatch.findByGameId(game.id);
            if (match?.slot_a_entry_id != null && match?.slot_b_entry_id != null) {
              const payoutService = await import("./tournamentPayoutService.js");
              const winId =
                winnerEntryId === "a"
                  ? match.slot_a_entry_id
                  : winnerEntryId === "b"
                    ? match.slot_b_entry_id
                    : null;
              if (winId != null) {
                await TournamentMatch.update(match.id, { winner_entry_id: winId, status: "COMPLETED" });
                await Tournament.update(stakeRow.tournament_id, { status: "COMPLETED" });
                try {
                  await payoutService.executePayouts(stakeRow.tournament_id);
                  await db("arena_match_stakes").where("id", stakeRow.id).update({
                    status: "PAID_OUT",
                    paid_out_at: db.fn.now(),
                    updated_at: db.fn.now(),
                  });
                } catch (payoutErr) {
                  logger.error(
                    { err: payoutErr?.message, gameId: game.id, tournamentId: stakeRow.tournament_id },
                    "Human vs agent executePayouts failed"
                  );
                }
              } else {
                await TournamentMatch.update(match.id, { status: "COMPLETED" });
                await Tournament.update(stakeRow.tournament_id, { status: "COMPLETED" });
                try {
                  await payoutService.executeDrawRefunds(stakeRow.tournament_id);
                  await db("arena_match_stakes").where("id", stakeRow.id).update({
                    status: "PAID_OUT",
                    paid_out_at: db.fn.now(),
                    updated_at: db.fn.now(),
                  });
                } catch (drawErr) {
                  logger.error(
                    { err: drawErr?.message, gameId: game.id, tournamentId: stakeRow.tournament_id },
                    "Human vs agent executeDrawRefunds failed"
                  );
                }
              }
            }
          }

          await syncArenaStakePaidOutIfPayoutsExist(game.id);
          const stakeStill = await db("arena_match_stakes").where("game_id", game.id).first();
          if (stakeStill?.status === "COLLECTED") {
            logger.warn(
              { gameId: game.id },
              "Human vs agent: stake still COLLECTED after payout attempt; will retry (no arena_completion_at yet)"
            );
            continue;
          }

          await db("games").where("id", game.id).update({ arena_completion_at: db.fn.now() });
          logger.info({ gameId: game.id }, "Human vs agent arena post-process done (no ELO)");
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

        let winnerId = null;
        if (players[0].balance > players[1].balance) {
          winnerId = agentA.id;
        } else if (players[1].balance > players[0].balance) {
          winnerId = agentB.id;
        }

        const stakeRow = await db("arena_match_stakes").where("game_id", game.id).where("status", "COLLECTED").first();
        if (stakeRow?.tournament_id) {
          const TournamentMatch = (await import("../models/TournamentMatch.js")).default;
          const Tournament = (await import("../models/Tournament.js")).default;
          const match = await TournamentMatch.findByGameId(game.id);
          if (match?.slot_a_entry_id != null && match?.slot_b_entry_id != null) {
            const payoutService = await import("./tournamentPayoutService.js");
            if (winnerId != null) {
              const winnerEntryId = winnerId === agentA.id ? match.slot_a_entry_id : match.slot_b_entry_id;
              await TournamentMatch.update(match.id, { winner_entry_id: winnerEntryId, status: "COMPLETED" });
              await Tournament.update(stakeRow.tournament_id, { status: "COMPLETED" });
              try {
                await payoutService.executePayouts(stakeRow.tournament_id);
                await db("arena_match_stakes").where("id", stakeRow.id).update({
                  status: "PAID_OUT",
                  paid_out_at: db.fn.now(),
                  updated_at: db.fn.now(),
                });
                logger.info(
                  { gameId: game.id, tournamentId: stakeRow.tournament_id, winnerEntryId },
                  "Staked arena payout executed"
                );
              } catch (payoutErr) {
                logger.error(
                  { err: payoutErr?.message, gameId: game.id, tournamentId: stakeRow.tournament_id },
                  "Staked arena executePayouts failed"
                );
              }
            } else {
              await TournamentMatch.update(match.id, { status: "COMPLETED" });
              await Tournament.update(stakeRow.tournament_id, { status: "COMPLETED" });
              try {
                await payoutService.executeDrawRefunds(stakeRow.tournament_id);
                await db("arena_match_stakes").where("id", stakeRow.id).update({
                  status: "PAID_OUT",
                  paid_out_at: db.fn.now(),
                  updated_at: db.fn.now(),
                });
                logger.info(
                  { gameId: game.id, tournamentId: stakeRow.tournament_id },
                  "Staked arena draw: house 5%, equal refunds"
                );
              } catch (drawErr) {
                logger.error(
                  { err: drawErr?.message, gameId: game.id, tournamentId: stakeRow.tournament_id },
                  "Staked arena executeDrawRefunds failed"
                );
              }
            }
          }
        }

        await syncArenaStakePaidOutIfPayoutsExist(game.id);
        const stakeAfter = await db("arena_match_stakes").where("game_id", game.id).first();
        if (stakeAfter?.status === "COLLECTED") {
          logger.warn(
            { gameId: game.id },
            "Agent arena: stake still COLLECTED; skipping ELO until payout/refund completes"
          );
          continue;
        }

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
    .whereIn("status", ["RUNNING", "IN_PROGRESS"])
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

