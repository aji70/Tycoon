/**
 * Staked arena: pay USDC from TycoonTournamentEscrow when a staked arena game hits FINISHED.
 * Bracket is always 2 entries (escrow pool) even when ONCHAIN_AGENT_VS_AGENT has 3–8 game_players.
 */
import db from "../config/database.js";
import logger from "../config/logger.js";
import * as eloService from "./eloService.js";

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

const ARENA_STAKE_GAME_TYPES = new Set([
  "AGENT_VS_AGENT",
  "ONCHAIN_AGENT_VS_AGENT",
  "ONCHAIN_HUMAN_VS_AGENT",
]);

async function loadEntryIdToUserId(match) {
  const ids = [match.slot_a_entry_id, match.slot_b_entry_id].filter((x) => x != null);
  if (ids.length < 2) return new Map();
  const rows = await db("tournament_entries").whereIn("id", ids).select("id", "user_id");
  return new Map(rows.map((r) => [Number(r.id), Number(r.user_id)]));
}

/** Source of truth for the two staked agents (works for multi-seat games). */
async function loadBracketAgentsForMatch(match) {
  if (!match?.slot_a_entry_id || !match?.slot_b_entry_id) return { agentA: null, agentB: null };
  const [rowA, rowB] = await Promise.all([
    db("tournament_entry_agents").where({ tournament_entry_id: match.slot_a_entry_id }).select("user_agent_id").first(),
    db("tournament_entry_agents").where({ tournament_entry_id: match.slot_b_entry_id }).select("user_agent_id").first(),
  ]);
  const idA = rowA?.user_agent_id != null ? Number(rowA.user_agent_id) : null;
  const idB = rowB?.user_agent_id != null ? Number(rowB.user_agent_id) : null;
  const [agentA, agentB] = await Promise.all([
    idA ? db("user_agents").where("id", idA).first() : null,
    idB ? db("user_agents").where("id", idB).first() : null,
  ]);
  return { agentA: agentA || null, agentB: agentB || null };
}

/** One row per bracket user (multi-seat games have one user per agent slot). */
function pickBracketPlayers(playersRaw, match, entryIdToUserId) {
  const uidA = entryIdToUserId.get(Number(match.slot_a_entry_id));
  const uidB = entryIdToUserId.get(Number(match.slot_b_entry_id));
  if (uidA == null || uidB == null) return { playerA: null, playerB: null };
  const rowsA = playersRaw.filter((p) => Number(p.user_id) === uidA);
  const rowsB = playersRaw.filter((p) => Number(p.user_id) === uidB);
  const playerA = [...rowsA].sort((a, b) => Number(a.turn_order || 0) - Number(b.turn_order || 0))[0] ?? null;
  const playerB = [...rowsB].sort((a, b) => Number(a.turn_order || 0) - Number(b.turn_order || 0))[0] ?? null;
  return { playerA, playerB };
}

/** Align escrow winner with games.winner_id (net worth / finish-by-time), not cash-only. */
function resolveWinnerEntryIdFromGame(match, entryIdToUserId, gameWinnerUserId) {
  if (gameWinnerUserId == null || gameWinnerUserId === "") return null;
  const w = Number(gameWinnerUserId);
  if (!Number.isFinite(w)) return null;
  const sa = Number(match.slot_a_entry_id);
  const sb = Number(match.slot_b_entry_id);
  if (entryIdToUserId.get(sa) === w) return sa;
  if (entryIdToUserId.get(sb) === w) return sb;
  return null;
}

/**
 * Idempotent best-effort: run escrow payout/draw + human arena_completion_at + agent ELO once.
 * @param {number} gameId
 */
export async function settleStakedArenaForFinishedGame(gameId) {
  const id = Number(gameId);
  if (!id) return { ok: false, reason: "bad_id" };

  const game = await db("games").where("id", id).first();
  if (!game || String(game.status || "") !== "FINISHED") {
    return { ok: false, reason: "not_finished" };
  }
  const gt = String(game.game_type || "");
  if (!ARENA_STAKE_GAME_TYPES.has(gt)) {
    return { ok: false, reason: "not_staked_arena_type" };
  }

  try {
    const playersRaw = await db("game_players")
      .where("game_id", id)
      .select("user_id", "balance", "turn_order");

    const TournamentMatch = (await import("../models/TournamentMatch.js")).default;
    const stakeAny = await db("arena_match_stakes").where("game_id", id).first();
    const stakeRow = stakeAny?.status === "COLLECTED" ? stakeAny : null;
    const match = stakeAny?.tournament_id ? await TournamentMatch.findByGameId(id) : null;
    const hasStakedBracket = Boolean(
      stakeAny && match && match.slot_a_entry_id != null && match.slot_b_entry_id != null
    );

    let entryIdToUserId = new Map();
    let playerA = null;
    let playerB = null;
    if (hasStakedBracket) {
      entryIdToUserId = await loadEntryIdToUserId(match);
      const picked = pickBracketPlayers(playersRaw, match, entryIdToUserId);
      playerA = picked.playerA;
      playerB = picked.playerB;
    }

    const isHumanVsAgent = gt === "ONCHAIN_HUMAN_VS_AGENT";

    if (isHumanVsAgent) {
      const ph = playerA;
      const po = playerB;
      if (stakeRow?.tournament_id) {
        const Tournament = (await import("../models/Tournament.js")).default;
        if (match?.slot_a_entry_id != null && match?.slot_b_entry_id != null) {
          const payoutService = await import("./tournamentPayoutService.js");
          let winId = resolveWinnerEntryIdFromGame(match, entryIdToUserId, game.winner_id);
          if (winId == null && ph && po) {
            if (Number(ph.balance) > Number(po.balance)) winId = Number(match.slot_a_entry_id);
            else if (Number(po.balance) > Number(ph.balance)) winId = Number(match.slot_b_entry_id);
          }
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
                { err: payoutErr?.message, gameId: id, tournamentId: stakeRow.tournament_id },
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
                { err: drawErr?.message, gameId: id, tournamentId: stakeRow.tournament_id },
                "Human vs agent executeDrawRefunds failed"
              );
            }
          }
        }
      }

      await syncArenaStakePaidOutIfPayoutsExist(id);
      const stakeStill = await db("arena_match_stakes").where("game_id", id).first();
      if (stakeStill?.status === "COLLECTED") {
        logger.warn({ gameId: id }, "Human vs agent: stake still COLLECTED; retry later");
        return { ok: false, reason: "stake_still_collected" };
      }

      await db("games").where("id", id).update({ arena_completion_at: db.fn.now() });
      logger.info({ gameId: id }, "Human vs agent arena post-process done");
      return { ok: true, path: "human_vs_agent" };
    }

    if (!hasStakedBracket) {
      if (playersRaw.length !== 2) {
        if (playersRaw.length < 2) {
          logger.warn({ gameId: id, playerCount: playersRaw.length }, "Arena stake settle: expected 2 players (no bracket)");
        }
        return { ok: false, reason: "player_count" };
      }
    }

    const players = [...playersRaw].sort((a, b) => Number(a.turn_order || 0) - Number(b.turn_order || 0));
    const ph = players[0];
    const po = players[1];

    let agentA;
    let agentB;
    if (hasStakedBracket) {
      const loaded = await loadBracketAgentsForMatch(match);
      agentA = loaded.agentA;
      agentB = loaded.agentB;
    }
    if (!agentA || !agentB) {
      const bindings = await db("agent_slot_assignments")
        .where("game_id", id)
        .whereNotNull("user_agent_id")
        .orderBy("slot", "asc");
      if (bindings.length >= 2) {
        agentA = await db("user_agents").where("id", bindings[0].user_agent_id).first();
        agentB = await db("user_agents").where("id", bindings[1].user_agent_id).first();
      }
    }
    if (!agentA || !agentB) {
      if (playersRaw.length >= 2) {
        const player1Agents = await db("user_agents").where("user_id", ph.user_id);
        const player2Agents = await db("user_agents").where("user_id", po.user_id);
        agentA = player1Agents.find((a) => a.status === "active");
        agentB = player2Agents.find((a) => a.status === "active");
      }
    }

    if (!agentA || !agentB) {
      logger.warn(
        { gameId: id, hasStakedBracket, playerCount: playersRaw.length },
        "Arena stake settle: could not resolve user_agents"
      );
      return { ok: false, reason: "no_agents" };
    }

    let winnerAgentIdForElo = null;

    if (stakeRow?.tournament_id && hasStakedBracket) {
      const Tournament = (await import("../models/Tournament.js")).default;
      const payoutService = await import("./tournamentPayoutService.js");
      let winnerEntryId = resolveWinnerEntryIdFromGame(match, entryIdToUserId, game.winner_id);
      if (winnerEntryId == null && playerA && playerB) {
        if (Number(playerA.balance) > Number(playerB.balance)) winnerEntryId = Number(match.slot_a_entry_id);
        else if (Number(playerB.balance) > Number(playerA.balance)) winnerEntryId = Number(match.slot_b_entry_id);
      }
      if (winnerEntryId != null) {
        winnerAgentIdForElo =
          Number(winnerEntryId) === Number(match.slot_a_entry_id) ? agentA.id : agentB.id;
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
            { gameId: id, tournamentId: stakeRow.tournament_id, winnerEntryId },
            "Staked arena payout executed"
          );
        } catch (payoutErr) {
          logger.error(
            { err: payoutErr?.message, gameId: id, tournamentId: stakeRow.tournament_id },
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
          logger.info({ gameId: id, tournamentId: stakeRow.tournament_id }, "Staked arena draw refunds");
        } catch (drawErr) {
          logger.error(
            { err: drawErr?.message, gameId: id, tournamentId: stakeRow.tournament_id },
            "Staked arena executeDrawRefunds failed"
          );
        }
      }
    }

    if (winnerAgentIdForElo == null) {
      if (playerA && playerB) {
        if (Number(playerA.balance) > Number(playerB.balance)) winnerAgentIdForElo = agentA.id;
        else if (Number(playerB.balance) > Number(playerA.balance)) winnerAgentIdForElo = agentB.id;
      } else if (ph && po) {
        if (Number(ph.balance) > Number(po.balance)) winnerAgentIdForElo = agentA.id;
        else if (Number(po.balance) > Number(ph.balance)) winnerAgentIdForElo = agentB.id;
      }
    }

    await syncArenaStakePaidOutIfPayoutsExist(id);
    const stakeAfter = await db("arena_match_stakes").where("game_id", id).first();
    if (stakeAfter?.status === "COLLECTED") {
      logger.warn({ gameId: id }, "Agent arena: stake still COLLECTED after payout attempt");
      return { ok: false, reason: "stake_still_collected" };
    }

    const alreadyElo = await db("agent_arena_matches").where({ game_id: id }).where("status", "COMPLETED").first();
    if (!alreadyElo) {
      await eloService.recordArenaResult(agentA.id, agentB.id, winnerAgentIdForElo, id);
      logger.info(
        { gameId: id, agentAId: agentA.id, agentBId: agentB.id, winnerId: winnerAgentIdForElo },
        "Recorded arena ELO"
      );
    }

    return { ok: true, path: "agent_vs_agent" };
  } catch (err) {
    logger.error({ err: err?.message, gameId: id }, "settleStakedArenaForFinishedGame failed");
    return { ok: false, reason: err?.message || "error" };
  }
}
