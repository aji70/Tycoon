/**
 * Tournament service: create, register, bracket, start round, on game finished.
 * All on-chain match actions (create game, join players) are done by the backend.
 */
import db from "../config/database.js";
import Tournament from "../models/Tournament.js";
import TournamentEntry from "../models/TournamentEntry.js";
import TournamentRound from "../models/TournamentRound.js";
import TournamentMatch from "../models/TournamentMatch.js";
import User from "../models/User.js";
import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameSetting from "../models/GameSetting.js";
import Chat from "../models/Chat.js";
import { createGameByBackend, joinGameByBackend, isContractConfigured } from "../services/tycoonContract.js";
import { createTournamentOnChain, isEscrowConfigured } from "../services/tournamentEscrow.js";
import logger from "../config/logger.js";

const TOURNAMENT_SYMBOLS = ["hat", "car", "dog", "thimble", "wheelbarrow", "battleship", "boot", "iron"];
const DEFAULT_STARTING_CASH = 1500;

/**
 * Create a tournament. prize_source: NO_POOL | ENTRY_FEE_POOL | CREATOR_FUNDED.
 */
export async function createTournament(data) {
  const {
    creator_id,
    name,
    prize_source = "NO_POOL",
    max_players = 32,
    min_players = 2,
    entry_fee_wei = 0,
    prize_pool_wei = null,
    prize_distribution = null,
    registration_deadline = null,
    chain,
  } = data;

  if (!creator_id || !name) throw new Error("creator_id and name required");
  if (chain == null || String(chain).trim() === "") throw new Error("chain is required (e.g. POLYGON, BASE, CELO)");
  const max = Math.min(256, Math.max(2, Number(max_players) || 32));
  const min = Math.max(2, Math.min(max, Number(min_players) || 2));

  const normalizedChain = User.normalizeChain(chain);
  const payload = {
    creator_id,
    name: String(name).trim(),
    status: "REGISTRATION_OPEN",
    prize_source: prize_source || "NO_POOL",
    max_players: max,
    min_players: min,
    entry_fee_wei: prize_source === "ENTRY_FEE_POOL" ? Number(entry_fee_wei) || 0 : 0,
    prize_pool_wei: prize_source === "CREATOR_FUNDED" ? (prize_pool_wei != null ? String(prize_pool_wei) : null) : null,
    prize_distribution: prize_source === "NO_POOL" ? null : prize_distribution || null,
    registration_deadline: registration_deadline || null,
    chain: normalizedChain,
  };

  const tournament = await Tournament.create(payload);
  if (isEscrowConfigured(normalizedChain)) {
    try {
      const creator = await User.findById(creator_id);
      const creatorAddress =
        (creator?.address && String(creator.address).trim()) ||
        (creator?.linked_wallet_address && String(creator.linked_wallet_address).trim()) ||
        "0x0000000000000000000000000000000000000000";
      await createTournamentOnChain(
        tournament.id,
        tournament.entry_fee_wei ?? 0,
        creatorAddress,
        normalizedChain
      );
    } catch (err) {
      logger.error({ err: err?.message, tournamentId: tournament.id, chain: normalizedChain }, "Escrow createTournament failed; tournament saved in DB only");
    }
  }
  return tournament;
}

/**
 * Register a player for a tournament (off-chain only).
 * Rejects if user_id or address already has an entry (dual presence).
 */
export async function registerPlayer(tournamentId, { userId, address, chain }, paymentTxHash = null) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "REGISTRATION_OPEN") throw new Error("Registration is closed");

  const normalizedChain = User.normalizeChain(chain || tournament.chain);

  let user;
  if (userId) {
    user = await User.findById(userId);
    if (!user) throw new Error("User not found");
  } else if (address) {
    user = await User.resolveUserByAddress(address, normalizedChain);
    if (!user) throw new Error("User not found for this address on this chain");
  } else {
    throw new Error("userId or address required");
  }

  if (user.chain !== tournament.chain) throw new Error(`You need an account on ${tournament.chain} to join this tournament`);

  const already = await TournamentEntry.hasEntry(tournamentId, { userId: user.id, address: user.address });
  if (already) throw new Error("Already registered for this tournament");
  if (user.linked_wallet_address) {
    const byLinked = await TournamentEntry.findByTournamentAndAddress(tournamentId, user.linked_wallet_address);
    if (byLinked) throw new Error("This wallet is already registered");
  }

  const count = await TournamentEntry.countByTournament(tournamentId);
  if (count >= tournament.max_players) throw new Error("Tournament is full");

  if (tournament.prize_source === "ENTRY_FEE_POOL" && Number(tournament.entry_fee_wei) > 0 && !paymentTxHash) {
    throw new Error("Entry fee payment required");
  }

  return TournamentEntry.create({
    tournament_id: tournamentId,
    user_id: user.id,
    address: user.address,
    chain: user.chain,
    seed_order: count + 1,
    payment_tx_hash: paymentTxHash || null,
    status: "CONFIRMED",
  });
}

/**
 * Close registration and generate bracket. Pads to power of 2 with BYEs.
 */
export async function generateBracket(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "REGISTRATION_OPEN") throw new Error("Registration already closed");

  const entries = await TournamentEntry.findByTournament(tournamentId);
  const n = entries.length;
  if (n < tournament.min_players) throw new Error(`Need at least ${tournament.min_players} players`);

  const size = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = size - n;

  await Tournament.update(tournamentId, { status: "BRACKET_LOCKED" });

  const numRounds = Math.log2(size);
  for (let r = 0; r < numRounds; r++) {
    await TournamentRound.create({
      tournament_id: tournamentId,
      round_index: r,
      status: r === 0 ? "PENDING" : "PENDING",
    });
  }

  const matchRows = [];
  for (let i = 0; i < size / 2; i++) {
    const slotAEntryId = i * 2 < entries.length ? entries[i * 2].id : null;
    const slotBEntryId = i * 2 + 1 < entries.length ? entries[i * 2 + 1].id : null;
    const isBye = slotAEntryId == null || slotBEntryId == null;
    matchRows.push({
      tournament_id: tournamentId,
      round_index: 0,
      match_index: i,
      slot_a_type: slotAEntryId ? "ENTRY" : "BYE",
      slot_a_entry_id: slotAEntryId,
      slot_b_type: slotBEntryId ? "ENTRY" : "BYE",
      slot_b_entry_id: slotBEntryId,
      status: isBye ? "BYE" : "PENDING",
      winner_entry_id: isBye ? (slotAEntryId || slotBEntryId) : null,
    });
  }
  for (const row of matchRows) {
    await TournamentMatch.create(row);
  }

  for (let r = 1; r < numRounds; r++) {
    const prevRoundMatches = await TournamentMatch.findByTournamentAndRound(tournamentId, r - 1);
    const matchesInRound = prevRoundMatches.length / 2;
    for (let m = 0; m < matchesInRound; m++) {
      const slotAPrevId = prevRoundMatches[m * 2]?.id;
      const slotBPrevId = prevRoundMatches[m * 2 + 1]?.id;
      await TournamentMatch.create({
        tournament_id: tournamentId,
        round_index: r,
        match_index: m,
        slot_a_type: "MATCH_WINNER",
        slot_a_prev_match_id: slotAPrevId,
        slot_b_type: "MATCH_WINNER",
        slot_b_prev_match_id: slotBPrevId,
        status: "PENDING",
      });
    }
  }

  return { entries: n, size, byes, numRounds };
}

/**
 * Create on-chain game + DB game for one match. Both players must have password_hash (guests or backend-actable).
 */
async function createMatchGame(tournamentId, matchId) {
  const match = await TournamentMatch.findById(matchId);
  if (!match || match.tournament_id !== Number(tournamentId)) return null;
  if (match.status === "BYE" || match.status === "COMPLETED") return null;
  if (match.game_id) return match;

  const tournament = await Tournament.findById(tournamentId);
  const chain = User.normalizeChain(tournament.chain);
  if (!isContractConfigured(chain)) {
    logger.warn({ tournamentId, matchId, chain }, "Tournament: contract not configured for chain");
    return null;
  }

  const entryA = match.slot_a_entry_id ? await TournamentEntry.findById(match.slot_a_entry_id) : null;
  const entryB = match.slot_b_entry_id ? await TournamentEntry.findById(match.slot_b_entry_id) : null;
  if (!entryA || !entryB) return null;

  const userA = await User.findById(entryA.user_id);
  const userB = await User.findById(entryB.user_id);
  if (!userA?.password_hash || !userB?.password_hash) {
    logger.warn(
      { tournamentId, matchId, userA: !!userA?.password_hash, userB: !!userB?.password_hash },
      "Tournament: both players need password_hash for backend join; skipping match"
    );
    return null;
  }

  const code = `T${tournamentId}-R${match.round_index}-M${match.match_index}`.toUpperCase();
  const symbolA = TOURNAMENT_SYMBOLS[0];
  const symbolB = TOURNAMENT_SYMBOLS[1];

  let result;
  try {
    result = await createGameByBackend(
      userA.address,
      userA.password_hash,
      userA.username,
      "PRIVATE",
      symbolA,
      2,
      code,
      DEFAULT_STARTING_CASH,
      0n,
      chain
    );
  } catch (err) {
    logger.error({ err: err?.message, tournamentId, matchId }, "Tournament createGameByBackend failed");
    throw err;
  }

  const contractGameId = result?.gameId;
  if (!contractGameId) throw new Error("Contract did not return game ID");

  try {
    await joinGameByBackend(
      userB.address,
      userB.password_hash,
      contractGameId,
      userB.username,
      symbolB,
      code,
      chain
    );
  } catch (err) {
    logger.error({ err: err?.message, tournamentId, matchId }, "Tournament joinGameByBackend failed");
    throw err;
  }

  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: userA.id,
    next_player_id: userA.id,
    number_of_players: 2,
    status: "RUNNING",
    is_minipay: false,
    is_ai: false,
    chain: tournament.chain,
    contract_game_id: String(contractGameId),
  });

  await Chat.create({ game_id: game.id, status: "open" });
  await GameSetting.create({
    game_id: game.id,
    auction: true,
    rent_in_prison: false,
    mortgage: true,
    even_build: true,
    randomize_play_order: true,
    starting_cash: DEFAULT_STARTING_CASH,
  });
  await GamePlayer.create({
    game_id: game.id,
    user_id: userA.id,
    address: userA.address,
    balance: DEFAULT_STARTING_CASH,
    position: 0,
    turn_order: 1,
    symbol: symbolA,
    chance_jail_card: false,
    community_chest_jail_card: false,
  });
  await GamePlayer.create({
    game_id: game.id,
    user_id: userB.id,
    address: userB.address,
    balance: DEFAULT_STARTING_CASH,
    position: 0,
    turn_order: 2,
    symbol: symbolB,
    chance_jail_card: false,
    community_chest_jail_card: false,
  });

  await TournamentMatch.update(matchId, {
    game_id: game.id,
    contract_game_id: String(contractGameId),
    status: "IN_PROGRESS",
  });

  return { match, game };
}

/**
 * Start a round: for each match with both entries (or BYE), create game or advance BYE.
 */
export async function startRound(tournamentId, roundIndex) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "BRACKET_LOCKED" && tournament.status !== "IN_PROGRESS") throw new Error("Tournament not in bracket or in progress");

  const matches = await TournamentMatch.findByTournamentAndRound(tournamentId, Number(roundIndex));
  for (const match of matches) {
    if (match.status === "BYE") continue;
    if (match.status === "COMPLETED") continue;
    if (match.game_id) continue;

    if (match.slot_a_type === "BYE" || match.slot_b_type === "BYE") {
      const winnerId = match.slot_a_entry_id || match.slot_b_entry_id;
      await TournamentMatch.update(match.id, { winner_entry_id: winnerId, status: "COMPLETED" });
      continue;
    }

    if (match.slot_a_entry_id && match.slot_b_entry_id) {
      try {
        await createMatchGame(tournamentId, match.id);
      } catch (err) {
        logger.error({ err: err?.message, matchId: match.id }, "startRound createMatchGame failed");
      }
    }
  }

  const round = await TournamentRound.findByTournamentAndIndex(tournamentId, roundIndex);
  if (round) await TournamentRound.update(round.id, { status: "IN_PROGRESS", started_at: db.fn.now() });

  if (tournament.status === "BRACKET_LOCKED") await Tournament.update(tournamentId, { status: "IN_PROGRESS" });

  return { started: matches.length };
}

/**
 * Called when a game finishes. Updates match winner, advances bracket, optionally creates next round game.
 */
export async function onGameFinished(gameId) {
  const match = await TournamentMatch.findByGameId(gameId);
  if (!match) return null;

  const game = await Game.findById(gameId);
  if (!game || game.status !== "FINISHED") return null;

  const winnerUserId = game.winner_id;
  const entries = await TournamentEntry.findByTournament(match.tournament_id);
  const winnerEntry = entries.find((e) => e.user_id === winnerUserId);
  if (!winnerEntry) {
    logger.warn({ gameId, winnerUserId, tournamentId: match.tournament_id }, "Tournament: winner not in entries");
    return null;
  }

  await TournamentMatch.update(match.id, { winner_entry_id: winnerEntry.id, status: "COMPLETED" });

  const tournament = await Tournament.findById(match.tournament_id);
  const nextRoundMatches = await TournamentMatch.findByTournamentAndRound(match.tournament_id, match.round_index + 1);
  for (const next of nextRoundMatches || []) {
    let updated = false;
    if (next.slot_a_prev_match_id === match.id) {
      await TournamentMatch.update(next.id, { slot_a_entry_id: winnerEntry.id });
      updated = true;
    }
    if (next.slot_b_prev_match_id === match.id) {
      await TournamentMatch.update(next.id, { slot_b_entry_id: winnerEntry.id });
      updated = true;
    }
    if (updated) {
      const refreshed = await TournamentMatch.findById(next.id);
      if (refreshed.slot_a_entry_id && refreshed.slot_b_entry_id && refreshed.status === "PENDING" && !refreshed.game_id) {
        try {
          await createMatchGame(match.tournament_id, refreshed.id);
        } catch (err) {
          logger.error({ err: err?.message, matchId: refreshed.id }, "onGameFinished createMatchGame failed");
        }
      }
    }
  }

  const allMatches = await TournamentMatch.findByTournament(match.tournament_id);
  const finalMatch = allMatches.find((m) => m.round_index >= 0 && m.match_index === 0 && m.round_index === Math.max(...allMatches.map((x) => x.round_index)));
  const finalCompleted = finalMatch && (await TournamentMatch.findById(finalMatch.id))?.status === "COMPLETED";
  if (finalCompleted) {
    await Tournament.update(match.tournament_id, { status: "COMPLETED" });
    const t = await Tournament.findById(match.tournament_id);
    if (t.prize_source !== "NO_POOL" && (Number(t.prize_pool_wei) > 0 || Number(t.entry_fee_wei) > 0)) {
      try {
        const { executePayouts } = await import("./tournamentPayoutService.js");
        await executePayouts(match.tournament_id);
      } catch (err) {
        logger.error({ err: err?.message, tournamentId: match.tournament_id }, "Tournament executePayouts failed");
      }
    }
  }

  return { matchId: match.id, winnerEntryId: winnerEntry.id, tournamentCompleted: !!finalCompleted };
}

/**
 * Get leaderboard for a tournament (during or final). Entries with placement, round_eliminated, match_wins.
 */
export async function getLeaderboard(tournamentId, phase = "live") {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return null;

  const entries = await TournamentEntry.findByTournament(tournamentId, { withUser: true });
  const matches = await TournamentMatch.findByTournament(tournamentId);

  const entryIdToWins = {};
  const entryIdToRoundEliminated = {};
  const rounds = [...new Set(matches.map((m) => m.round_index))].sort((a, b) => a - b);

  for (const m of matches) {
    if (m.winner_entry_id) entryIdToWins[m.winner_entry_id] = (entryIdToWins[m.winner_entry_id] || 0) + 1;
  }
  for (const e of entries) {
    const lost = matches.find((m) => (m.slot_a_entry_id === e.id || m.slot_b_entry_id === e.id) && m.winner_entry_id !== e.id && m.status === "COMPLETED");
    entryIdToRoundEliminated[e.id] = lost != null ? lost.round_index : null;
  }

  const placementOrder = [];
  if (tournament.status === "COMPLETED" && phase === "final") {
    const finalMatch = matches.filter((m) => m.round_index === rounds[rounds.length - 1])[0];
    if (finalMatch?.winner_entry_id) placementOrder.push(finalMatch.winner_entry_id);
    if (finalMatch) {
      const loserId = finalMatch.slot_a_entry_id === finalMatch.winner_entry_id ? finalMatch.slot_b_entry_id : finalMatch.slot_a_entry_id;
      if (loserId) placementOrder.push(loserId);
    }
    for (let r = rounds.length - 2; r >= 0; r--) {
      const roundMatches = matches.filter((m) => m.round_index === r);
      for (const m of roundMatches) {
        if (m.winner_entry_id && !placementOrder.includes(m.winner_entry_id)) placementOrder.push(m.winner_entry_id);
        const other = m.slot_a_entry_id === m.winner_entry_id ? m.slot_b_entry_id : m.slot_a_entry_id;
        if (other && !placementOrder.includes(other)) placementOrder.push(other);
      }
    }
  }

  const rows = entries.map((e) => ({
    entry_id: e.id,
    user_id: e.user_id,
    username: e.username || e.user_address,
    address: e.address,
    match_wins: entryIdToWins[e.id] || 0,
    round_eliminated: entryIdToRoundEliminated[e.id],
    placement: tournament.status === "COMPLETED" && phase === "final" ? placementOrder.indexOf(e.id) + 1 || null : null,
  }));

  if (tournament.status === "COMPLETED" && phase === "final") {
    rows.sort((a, b) => (a.placement || 999) - (b.placement || 999));
  } else {
    rows.sort((a, b) => (b.match_wins || 0) - (a.match_wins || 0));
  }

  return { tournament_id: tournamentId, status: tournament.status, phase, entries: rows };
}
