/**
 * Retries tournament / staked-arena payouts that failed or were never awaited (stuck USDC in escrow).
 *
 * Set TOURNAMENT_PAYOUT_RETRY_POLL_MS=0 to disable (default 60000).
 */
import logger from "../config/logger.js";
import db from "../config/database.js";
import { settleStakedArenaForFinishedGame } from "./arenaStakeSettlement.js";

export function startTournamentPayoutRecoveryPoller() {
  const ms = Number(process.env.TOURNAMENT_PAYOUT_RETRY_POLL_MS ?? "60000");
  if (!Number.isFinite(ms) || ms <= 0) {
    logger.info("Tournament payout recovery poller disabled (TOURNAMENT_PAYOUT_RETRY_POLL_MS unset or 0)");
    return () => {};
  }

  let timer = null;

  /**
   * Payout rows in DB but escrow still Open/Locked with USDC (e.g. first run inserted rows without finalize).
   * executePayouts / executeDrawRefunds idempotent branches now call tryReconcileEscrowFinalize.
   */
  const reconcileStuckEscrowWithPayoutRows = async () => {
    const { executePayouts, executeDrawRefunds } = await import("./tournamentPayoutService.js");
    const rows = await db("tournament_payouts")
      .join("tournaments", "tournaments.id", "tournament_payouts.tournament_id")
      .where("tournaments.status", "COMPLETED")
      .whereNot("tournaments.prize_source", "NO_POOL")
      .groupBy("tournaments.id")
      .select("tournaments.id as tid")
      .limit(12);

    for (const row of rows) {
      const tid = Number(row.tid);
      if (!tid) continue;
      try {
        const matches = await db("tournament_matches").where({ tournament_id: tid });
        const anyWinner = (matches || []).some((m) => m.winner_entry_id != null);
        if (anyWinner) {
          await executePayouts(tid);
        } else {
          await executeDrawRefunds(tid);
        }
      } catch (err) {
        logger.error({ err: err?.message, tournamentId: tid }, "Recovery: stuck escrow + payout rows reconcile failed");
      }
    }
  };

  const repairStakesMarkedByPayoutRows = async () => {
    const collected = await db("arena_match_stakes").where("status", "COLLECTED").select("id", "game_id", "tournament_id").limit(40);
    for (const s of collected) {
      const nRow = await db("tournament_payouts").where({ tournament_id: s.tournament_id }).count("* as c").first();
      if (Number(nRow?.c ?? 0) > 0) {
        await db("arena_match_stakes").where("id", s.id).update({
          status: "PAID_OUT",
          paid_out_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
        logger.info(
          { stakeId: s.id, gameId: s.game_id, tournamentId: s.tournament_id },
          "Recovery: arena stake marked PAID_OUT (payout rows already present)"
        );
      }
    }
  };

  const retryStuckArenaStakes = async () => {
    const rows = await db("arena_match_stakes as s")
      .join("games as g", "g.id", "s.game_id")
      .where("s.status", "COLLECTED")
      .where("g.status", "FINISHED")
      .select("s.game_id")
      .limit(25);
    for (const r of rows) {
      const gid = Number(r.game_id);
      if (!gid) continue;
      try {
        const out = await settleStakedArenaForFinishedGame(gid);
        if (out?.ok) {
          logger.info({ gameId: gid, path: out.path }, "Recovery: staked arena settlement succeeded");
        } else if (out?.reason && out.reason !== "not_staked_arena_type" && out.reason !== "not_finished") {
          logger.warn({ gameId: gid, reason: out.reason }, "Recovery: staked arena settlement still pending or failed");
        }
      } catch (err) {
        logger.error({ err: err?.message, gameId: gid }, "Recovery: settleStakedArenaForFinishedGame threw");
      }
    }
  };

  const retryCompletedTournamentsWithoutPayoutRows = async () => {
    const { executePayouts, executeDrawRefunds } = await import("./tournamentPayoutService.js");

    const rows = await db("tournaments")
      .where("tournaments.status", "COMPLETED")
      .whereNot("tournaments.prize_source", "NO_POOL")
      .where(function hasPool() {
        this.whereRaw("COALESCE(CAST(tournaments.entry_fee_wei AS DECIMAL(40,0)), 0) > 0").orWhereRaw(
          "COALESCE(CAST(tournaments.prize_pool_wei AS DECIMAL(40,0)), 0) > 0"
        );
      })
      .whereNotExists(function payoutExists() {
        this.select(db.raw("1"))
          .from("tournament_payouts")
          .whereRaw("tournament_payouts.tournament_id = tournaments.id");
      })
      .select(db.raw("tournaments.id as tid"))
      .orderBy("tournaments.updated_at", "asc")
      .limit(15);

    for (const row of rows) {
      const tid = Number(row.tid);
      if (!tid) continue;
      try {
        const matches = await db("tournament_matches").where({ tournament_id: tid }).select("status", "winner_entry_id");
        const allDone = matches.length > 0 && matches.every((m) => ["COMPLETED", "BYE"].includes(String(m.status || "")));
        const anyWinner = matches.some((m) => m.winner_entry_id != null);
        if (!allDone) continue;

        const tournament = await db("tournaments").where({ id: tid }).first();
        if (!tournament) continue;

        if (!anyWinner && String(tournament.prize_source || "") === "ENTRY_FEE_POOL") {
          await executeDrawRefunds(tid);
          logger.info({ tournamentId: tid }, "Recovery: executeDrawRefunds completed");
        } else {
          await executePayouts(tid);
          logger.info({ tournamentId: tid }, "Recovery: executePayouts completed");
        }
      } catch (err) {
        logger.error({ err: err?.message, tournamentId: tid }, "Recovery: tournament payout retry failed (will retry next tick)");
      }
    }
  };

  const tick = async () => {
    try {
      await reconcileStuckEscrowWithPayoutRows();
      await repairStakesMarkedByPayoutRows();
      await retryStuckArenaStakes();
      await retryCompletedTournamentsWithoutPayoutRows();
    } catch (err) {
      logger.warn({ err: err?.message }, "Tournament payout recovery poller tick failed");
    }
  };

  timer = setInterval(tick, ms);
  void tick();

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
