/**
 * Staked arena: pay USDC from TycoonTournamentEscrow when a 2p arena game hits FINISHED.
 * Must run for ONCHAIN_HUMAN_VS_AGENT even when ENABLE_AGENT_GAME_RUNNER is false (human-played games).
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

    if (playersRaw.length !== 2) {
      if (playersRaw.length < 2) {
        logger.warn({ gameId: id, playerCount: playersRaw.length }, "Arena stake settle: expected 2 players");
      }
      return { ok: false, reason: "player_count" };
    }

    const players = [...playersRaw].sort((a, b) => Number(a.turn_order || 0) - Number(b.turn_order || 0));
    const isHumanVsAgent = gt === "ONCHAIN_HUMAN_VS_AGENT";

    if (isHumanVsAgent) {
      const ph = players[0];
      const po = players[1];
      let winnerEntryId = null;
      if (Number(ph.balance) > Number(po.balance)) winnerEntryId = "a";
      else if (Number(po.balance) > Number(ph.balance)) winnerEntryId = "b";

      const stakeRow = await db("arena_match_stakes").where("game_id", id).where("status", "COLLECTED").first();
      if (stakeRow?.tournament_id) {
        const TournamentMatch = (await import("../models/TournamentMatch.js")).default;
        const Tournament = (await import("../models/Tournament.js")).default;
        const match = await TournamentMatch.findByGameId(id);
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

    const bindings = await db("agent_slot_assignments")
      .where("game_id", id)
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
      logger.warn({ gameId: id }, "Arena stake settle: could not resolve user_agents");
      return { ok: false, reason: "no_agents" };
    }

    let winnerId = null;
    if (players[0].balance > players[1].balance) {
      winnerId = agentA.id;
    } else if (players[1].balance > players[0].balance) {
      winnerId = agentB.id;
    }

    const stakeRow = await db("arena_match_stakes").where("game_id", id).where("status", "COLLECTED").first();
    if (stakeRow?.tournament_id) {
      const TournamentMatch = (await import("../models/TournamentMatch.js")).default;
      const Tournament = (await import("../models/Tournament.js")).default;
      const match = await TournamentMatch.findByGameId(id);
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
    }

    await syncArenaStakePaidOutIfPayoutsExist(id);
    const stakeAfter = await db("arena_match_stakes").where("game_id", id).first();
    if (stakeAfter?.status === "COLLECTED") {
      logger.warn({ gameId: id }, "Agent arena: stake still COLLECTED after payout attempt");
      return { ok: false, reason: "stake_still_collected" };
    }

    const alreadyElo = await db("agent_arena_matches").where({ game_id: id }).where("status", "COMPLETED").first();
    if (!alreadyElo) {
      await eloService.recordArenaResult(agentA.id, agentB.id, winnerId, id);
      logger.info({ gameId: id, agentAId: agentA.id, agentBId: agentB.id, winnerId }, "Recorded arena ELO");
    }

    return { ok: true, path: "agent_vs_agent" };
  } catch (err) {
    logger.error({ err: err?.message, gameId: id }, "settleStakedArenaForFinishedGame failed");
    return { ok: false, reason: err?.message || "error" };
  }
}
