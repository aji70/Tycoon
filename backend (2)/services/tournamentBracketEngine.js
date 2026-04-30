/**
 * Tournament Bracket Engine
 *
 * Generates and manages brackets for different tournament formats:
 * - SINGLE_ELIMINATION (existing)
 * - ROUND_ROBIN (new)
 * - SWISS (new)
 * - BATTLE_ROYALE (new)
 */

import db from "../config/database.js";
import TournamentRound from "../models/TournamentRound.js";
import TournamentMatch from "../models/TournamentMatch.js";
import Tournament from "../models/Tournament.js";
import logger from "../config/logger.js";
import { splitIntoBalancedGroups, splitIntoAgentArenaGroups } from "./tournamentGroupHelpers.js";

/**
 * How many bracket rounds and how many matches per round for group elimination,
 * using the same advance rules as computeGroupEliminationAdvancingAndWinner in tournamentService.
 * @returns {{ matchCount: number }[]} one entry per round_index (0..R-1)
 */
export function projectGroupEliminationSchedule(initialN, isAgentOnly) {
  const schedule = [];
  let n = initialN;
  while (n > 1) {
    let groupSizes;
    let byeCount = 0;
    if (isAgentOnly) {
      const split = splitIntoAgentArenaGroups(Array.from({ length: n }, (_, i) => i + 1));
      groupSizes = split.groups.map((g) => g.length);
      byeCount = split.byes.length;
    } else {
      const gr = splitIntoBalancedGroups(Array.from({ length: n }, (_, i) => i + 1), 2, 4);
      groupSizes = gr.map((g) => g.length);
    }
    const matchesInRound = groupSizes.length + byeCount;
    schedule.push({ matchCount: matchesInRound });
    let nextN = 0;
    for (const sz of groupSizes) {
      const isFinalFourChampionship = matchesInRound === 1 && sz === 4;
      const take = sz <= 2 || isFinalFourChampionship ? 1 : Math.min(2, sz);
      nextN += take;
    }
    nextN += byeCount;
    n = nextN;
  }
  return schedule;
}

function buildGroupEliminationMatchRows(tournamentId, roundIndex, groups, byeEntryIds) {
  const matchRows = [];
  let matchIndex = 0;
  for (const groupIds of groups) {
    const [a, b] = groupIds;
    matchRows.push({
      tournament_id: tournamentId,
      round_index: roundIndex,
      match_index: matchIndex++,
      slot_a_type: "ENTRY",
      slot_a_entry_id: a,
      slot_b_type: "ENTRY",
      slot_b_entry_id: b ?? null,
      participant_entry_ids: groupIds,
      status: "PENDING",
    });
  }
  for (const byeId of byeEntryIds) {
    matchRows.push({
      tournament_id: tournamentId,
      round_index: roundIndex,
      match_index: matchIndex++,
      slot_a_type: "ENTRY",
      slot_a_entry_id: byeId,
      slot_b_type: "BYE",
      slot_b_entry_id: null,
      participant_entry_ids: [byeId],
      status: "BYE",
      winner_entry_id: byeId,
    });
  }
  return matchRows;
}

function buildPlaceholderGroupMatches(tournamentId, roundIndex, matchCount) {
  const rows = [];
  for (let m = 0; m < matchCount; m++) {
    rows.push({
      tournament_id: tournamentId,
      round_index: roundIndex,
      match_index: m,
      slot_a_type: "ENTRY",
      slot_a_entry_id: null,
      slot_b_type: "ENTRY",
      slot_b_entry_id: null,
      participant_entry_ids: [],
      status: "PENDING",
    });
  }
  return rows;
}

/**
 * Generate round-robin bracket.
 * Every entry plays every other entry once.
 * Score: 3 pts win, 1 pt draw, 0 pts loss.
 * Tiebreakers: head-to-head record, then net win/loss.
 */
export async function generateRoundRobinBracket(tournamentId, entries, options = {}) {
  const n = entries.length;
  if (n < 2) throw new Error("Need at least 2 entries for round-robin");

  // Round-robin rounds (every player plays once per round)
  // Formula: n-1 rounds for odd n, n rounds for even n
  // But we use n-1 by default (all-play-all)
  const numRounds = n % 2 === 0 ? n - 1 : n;

  await Tournament.update(tournamentId, { status: "BRACKET_LOCKED" });

  const roundRows = [];
  for (let r = 0; r < numRounds; r++) {
    const scheduledStartAt = options.first_round_start_at
      ? new Date(new Date(options.first_round_start_at).getTime() + r * 24 * 60 * 60 * 1000)
      : null;
    roundRows.push({
      tournament_id: tournamentId,
      round_index: r,
      status: "PENDING",
      scheduled_start_at: scheduledStartAt,
    });
  }
  await TournamentRound.bulkCreate(roundRows);

  const matchRows = [];
  let matchIndex = 0;

  // Use rotate algorithm for round-robin scheduling
  for (let r = 0; r < numRounds; r++) {
    const roundMatches = generateRoundRobinRound(entries, r);
    for (const match of roundMatches) {
      matchRows.push({
        tournament_id: tournamentId,
        round_index: r,
        match_index: matchIndex++,
        slot_a_type: "ENTRY",
        slot_a_entry_id: match.entryA.id,
        slot_b_type: "ENTRY",
        slot_b_entry_id: match.entryB.id,
        status: "PENDING",
      });
    }
  }

  await TournamentMatch.bulkCreate(matchRows);

  logger.info(
    { tournamentId, format: "ROUND_ROBIN", entries: n, rounds: numRounds, matches: matchRows.length },
    "Generated round-robin bracket"
  );

  return { entries: n, rounds: numRounds, matches: matchRows.length, format: "ROUND_ROBIN" };
}

/**
 * Generate one round of matches for round-robin using rotate algorithm.
 * Ensures no player gets a bye (unless odd number).
 */
function generateRoundRobinRound(entries, roundIndex) {
  const n = entries.length;
  const matches = [];

  // For even number of players: all play
  // For odd: one gets a bye
  if (n % 2 === 1) {
    // Odd case: rotate with fixed slot
    const rotated = rotateEntries(entries, roundIndex);
    for (let i = 0; i < (n - 1) / 2; i++) {
      matches.push({
        entryA: rotated[i],
        entryB: rotated[n - 1 - i],
      });
    }
  } else {
    // Even case
    const rotated = rotateEntries(entries, roundIndex);
    for (let i = 0; i < n / 2; i++) {
      matches.push({
        entryA: rotated[i],
        entryB: rotated[n - 1 - i],
      });
    }
  }

  return matches;
}

/**
 * Rotate entries for round-robin scheduling (fix first, rotate rest).
 */
function rotateEntries(entries, steps) {
  if (entries.length <= 1) return entries;
  const [fixed, ...rest] = entries;
  const rotated = [...rest];
  // Rotate by 'steps'
  for (let i = 0; i < steps; i++) {
    const last = rotated.pop();
    rotated.unshift(last);
  }
  return [fixed, ...rotated];
}

/**
 * Generate Swiss bracket.
 * Players are paired with similar records each round.
 * Generates one round at a time; call this after each round completes.
 */
export async function generateSwissRound(tournamentId, roundIndex, entries, previousResults = null) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");

  // Create round if doesn't exist
  const existingRound = await db("tournament_rounds")
    .where({ tournament_id: tournamentId, round_index: roundIndex })
    .first();

  if (!existingRound) {
    const scheduledStartAt = roundIndex > 0
      ? new Date(Date.now() + roundIndex * 24 * 60 * 60 * 1000)
      : null;
    await TournamentRound.create({
      tournament_id: tournamentId,
      round_index: roundIndex,
      status: "PENDING",
      scheduled_start_at: scheduledStartAt,
    });
  }

  // Group entries by score
  const entryScores = new Map();
  entries.forEach((e) => {
    entryScores.set(e.id, { entry: e, wins: 0, draws: 0, losses: 0 });
  });

  // If this isn't round 0, calculate scores from previous round matches
  if (roundIndex > 0 && previousResults) {
    for (const result of previousResults) {
      const entryA = entryScores.get(result.entryA.id);
      const entryB = entryScores.get(result.entryB.id);
      if (!entryA || !entryB) continue;

      if (result.winnerId === result.entryA.id) {
        entryA.wins++;
        entryB.losses++;
      } else if (result.winnerId === result.entryB.id) {
        entryB.wins++;
        entryA.losses++;
      } else {
        entryA.draws++;
        entryB.draws++;
      }
    }
  }

  // Pair by score (greedy matching)
  const sorted = Array.from(entryScores.values()).sort((a, b) => {
    const scoreA = a.wins * 3 + a.draws;
    const scoreB = b.wins * 3 + b.draws;
    return scoreB - scoreA;
  });

  const paired = new Set();
  const matchRows = [];
  let matchIndex = 0;

  for (const player of sorted) {
    if (paired.has(player.entry.id)) continue;

    // Find opponent with closest score who hasn't been paired
    let opponent = null;
    for (const other of sorted) {
      if (other.entry.id === player.entry.id || paired.has(other.entry.id)) continue;

      // Check for rematch (optional: disallow rematches)
      const hadRematch = previousResults?.some(
        (r) => (r.entryA.id === player.entry.id && r.entryB.id === other.entry.id) ||
               (r.entryA.id === other.entry.id && r.entryB.id === player.entry.id)
      );
      if (hadRematch) continue;

      opponent = other;
      break;
    }

    if (!opponent) {
      // No opponent found (bye, shouldn't happen in Swiss)
      continue;
    }

    paired.add(player.entry.id);
    paired.add(opponent.entry.id);

    matchRows.push({
      tournament_id: tournamentId,
      round_index: roundIndex,
      match_index: matchIndex++,
      slot_a_type: "ENTRY",
      slot_a_entry_id: player.entry.id,
      slot_b_type: "ENTRY",
      slot_b_entry_id: opponent.entry.id,
      status: "PENDING",
    });
  }

  await TournamentMatch.bulkCreate(matchRows);

  logger.info(
    { tournamentId, format: "SWISS", round: roundIndex, matches: matchRows.length },
    "Generated Swiss round"
  );

  return { roundIndex, matches: matchRows.length };
}

/**
 * Generate Battle Royale bracket.
 * All entries play simultaneously in one or more multi-player games.
 * Each game has up to 8 players; survivors advance to next round.
 * Uses game_id to group matches rather than slot pairs.
 */
export async function generateBattleRoyaleBracket(tournamentId, entries, options = {}) {
  const n = entries.length;
  if (n < 3) throw new Error("Need at least 3 entries for battle royale");

  // Calculate rounds: each round eliminates ~half the field
  // If 8 entries: 1 round (1 game, top 4 advance to final)
  // If 16 entries: 2 rounds (2 games of 8 in round 1, 1 game of 8 in round 2)
  const numRounds = Math.ceil(Math.log2(n / 2));

  await Tournament.update(tournamentId, { status: "BRACKET_LOCKED" });

  const roundRows = [];
  for (let r = 0; r < numRounds; r++) {
    const scheduledStartAt = options.first_round_start_at
      ? new Date(new Date(options.first_round_start_at).getTime() + r * 24 * 60 * 60 * 1000)
      : null;
    roundRows.push({
      tournament_id: tournamentId,
      round_index: r,
      status: "PENDING",
      scheduled_start_at: scheduledStartAt,
    });
  }
  await TournamentRound.bulkCreate(roundRows);

  // Round 0: divide entries into games of 8 (or less for final round)
  const matchRows = [];
  let matchIndex = 0;
  const entryList = [...entries];

  for (let r = 0; r < numRounds; r++) {
    const roundEntries = r === 0 ? entryList : getAdvancers(tournamentId, r - 1);
    const gamesInRound = Math.ceil(roundEntries.length / 8);

    for (let g = 0; g < gamesInRound; g++) {
      const gameEntries = roundEntries.slice(g * 8, (g + 1) * 8);

      // In Battle Royale, we create one match per game with multiple entry slots
      // For simplicity, store first entry in slot_a, rest via match-specific metadata
      const matchRow = {
        tournament_id: tournamentId,
        round_index: r,
        match_index: matchIndex++,
        slot_a_type: "ENTRY",
        slot_a_entry_id: gameEntries[0]?.id,
        // Schema only allows ENTRY | MATCH_WINNER | BYE; multi-player list lives in `notes`.
        slot_b_type: "BYE",
        slot_b_entry_id: null,
        status: "PENDING",
        // Store battle_royale_entry_ids as JSON in metadata
        notes: JSON.stringify({
          format: "BATTLE_ROYALE",
          entryIds: gameEntries.map((e) => e.id),
          playerCount: gameEntries.length,
        }),
      };
      matchRows.push(matchRow);
    }
  }

  await TournamentMatch.bulkCreate(matchRows);

  logger.info(
    { tournamentId, format: "BATTLE_ROYALE", entries: n, rounds: numRounds, matches: matchRows.length },
    "Generated battle royale bracket"
  );

  return { entries: n, rounds: numRounds, matches: matchRows.length, format: "BATTLE_ROYALE" };
}

/**
 * Get entries that advanced from previous round (for battle royale).
 * Based on match results: top 4 or top 2 per game advance.
 */
async function getAdvancers(tournamentId, roundIndex) {
  const matches = await db("tournament_matches")
    .where({ tournament_id: tournamentId, round_index: roundIndex })
    .where("status", "COMPLETED");

  const advancerIds = new Set();
  for (const match of matches) {
    // If match has a winner, they advance
    if (match.winner_entry_id) {
      advancerIds.add(match.winner_entry_id);
    }
  }

  // Fetch entries
  return db("tournament_entries")
    .whereIn("id", Array.from(advancerIds))
    .select("*");
}

/**
 * Dispatch bracket generation based on tournament format.
 */
/**
 * Multi-table elimination: 2–4 players per match. All tournament_rounds and match *slots*
 * are created up front; later rounds are filled when the previous round completes.
 */
export async function generateGroupEliminationBracket(tournamentId, entries, options = {}) {
  const n = entries.length;
  if (n < 2) throw new Error("Need at least 2 entries");
  const isAgentOnly = Boolean(options.isAgentOnly);
  const schedule = projectGroupEliminationSchedule(n, isAgentOnly);
  if (!schedule.length) throw new Error("Could not project group elimination schedule");

  let groups;
  let byeEntryIds = [];
  if (isAgentOnly) {
    const split = splitIntoAgentArenaGroups(entries.map((e) => e.id));
    groups = split.groups;
    byeEntryIds = split.byes;
  } else {
    groups = splitIntoBalancedGroups(
      entries.map((e) => e.id),
      2,
      4
    );
  }

  await Tournament.update(tournamentId, { status: "BRACKET_LOCKED" });

  const roundRows = schedule.map((_, r) => ({
    tournament_id: tournamentId,
    round_index: r,
    status: "PENDING",
    scheduled_start_at: options.first_round_start_at
      ? new Date(new Date(options.first_round_start_at).getTime() + r * 24 * 60 * 60 * 1000)
      : null,
  }));
  await TournamentRound.bulkCreate(roundRows);

  const round0Rows = buildGroupEliminationMatchRows(tournamentId, 0, groups, byeEntryIds);
  await TournamentMatch.bulkCreate(round0Rows);

  const placeholderRows = [];
  for (let r = 1; r < schedule.length; r++) {
    placeholderRows.push(...buildPlaceholderGroupMatches(tournamentId, r, schedule[r].matchCount));
  }
  if (placeholderRows.length) {
    await TournamentMatch.bulkCreate(placeholderRows);
  }

  logger.info(
    {
      tournamentId,
      format: "GROUP_ELIMINATION",
      entries: n,
      rounds: schedule.length,
      round0Matches: round0Rows.length,
      placeholders: placeholderRows.length,
    },
    "Generated full group elimination bracket"
  );

  return {
    entries: n,
    matches: round0Rows.length + placeholderRows.length,
    format: "GROUP_ELIMINATION",
    round_count: schedule.length,
  };
}

/**
 * Fill a group round that was pre-created as placeholders, or insert matches if missing (legacy brackets).
 * @param {number} tournamentId
 * @param {number} roundIndex
 * @param {{ id: number }[]} entryRows - advancers from the previous round
 * @param {{ scheduled_start_at?: Date | string | null, isAgentOnly?: boolean }} options
 */
export async function fillGroupEliminationRound(tournamentId, roundIndex, entryRows, options = {}) {
  const ids = entryRows.map((e) => e.id);
  const isAgentOnly = Boolean(options.isAgentOnly);
  let groups;
  let byeEntryIds = [];
  if (isAgentOnly) {
    const split = splitIntoAgentArenaGroups(ids);
    groups = split.groups;
    byeEntryIds = split.byes;
  } else {
    groups = splitIntoBalancedGroups(ids, 2, 4);
  }

  const scheduledStartAt = options.scheduled_start_at != null ? new Date(options.scheduled_start_at) : null;

  let roundRow = await TournamentRound.findByTournamentAndIndex(tournamentId, roundIndex);
  if (!roundRow) {
    roundRow = await TournamentRound.create({
      tournament_id: tournamentId,
      round_index: roundIndex,
      status: "PENDING",
      scheduled_start_at: scheduledStartAt,
    });
  }

  const built = buildGroupEliminationMatchRows(tournamentId, roundIndex, groups, byeEntryIds);
  const existing = await TournamentMatch.findByTournamentAndRound(tournamentId, roundIndex);

  if (!existing.length) {
    await TournamentMatch.bulkCreate(built);
    logger.info(
      { tournamentId, format: "GROUP_ELIMINATION", roundIndex, matches: built.length },
      "Created group elimination round (no placeholders)"
    );
    return { roundIndex, matches: built.length };
  }

  if (existing.length !== built.length) {
    logger.warn(
      { tournamentId, roundIndex, existing: existing.length, expected: built.length },
      "Group round match count mismatch; replacing round matches"
    );
    await db("tournament_matches").where({ tournament_id: tournamentId, round_index: roundIndex }).del();
    await TournamentMatch.bulkCreate(built);
    logger.info(
      { tournamentId, format: "GROUP_ELIMINATION", roundIndex, matches: built.length },
      "Rebuilt group elimination round matches"
    );
    return { roundIndex, matches: built.length };
  }

  const sorted = [...existing].sort((a, b) => Number(a.match_index) - Number(b.match_index));
  for (let i = 0; i < built.length; i++) {
    const row = built[i];
    const id = sorted[i].id;
    await TournamentMatch.update(id, {
      slot_a_type: row.slot_a_type,
      slot_a_entry_id: row.slot_a_entry_id,
      slot_b_type: row.slot_b_type,
      slot_b_entry_id: row.slot_b_entry_id,
      participant_entry_ids: row.participant_entry_ids,
      status: row.status,
      winner_entry_id: row.winner_entry_id ?? null,
      advancing_entry_ids: null,
    });
  }

  logger.info(
    { tournamentId, format: "GROUP_ELIMINATION", roundIndex, matches: built.length },
    "Filled group elimination round from placeholders"
  );

  return { roundIndex, matches: built.length };
}

/** @deprecated Use fillGroupEliminationRound */
export async function createGroupEliminationRound(tournamentId, roundIndex, entryRows, options = {}) {
  return fillGroupEliminationRound(tournamentId, roundIndex, entryRows, options);
}

export async function generateBracketByFormat(tournamentId, format, entries, options = {}) {
  switch (format.toUpperCase()) {
    case "SINGLE_ELIMINATION":
      return generateSingleEliminationBracket(tournamentId, entries, options);
    case "ROUND_ROBIN":
      return generateRoundRobinBracket(tournamentId, entries, options);
    case "BATTLE_ROYALE":
      return generateBattleRoyaleBracket(tournamentId, entries, options);
    case "SWISS":
      // Swiss: generate first round
      return generateSwissRound(tournamentId, 0, entries, null);
    case "GROUP_ELIMINATION":
      return generateGroupEliminationBracket(tournamentId, entries, options);
    default:
      throw new Error(`Unknown tournament format: ${format}`);
  }
}

/**
 * Single elimination (existing logic adapted).
 */
export async function generateSingleEliminationBracket(tournamentId, entries, options = {}) {
  const n = entries.length;
  const size = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = size - n;

  await Tournament.update(tournamentId, { status: "BRACKET_LOCKED" });

  const numRounds = Math.log2(size);
  const roundRows = [];
  for (let r = 0; r < numRounds; r++) {
    const scheduledStartAt = options.first_round_start_at
      ? new Date(new Date(options.first_round_start_at).getTime() + r * 24 * 60 * 60 * 1000)
      : null;
    roundRows.push({
      tournament_id: tournamentId,
      round_index: r,
      status: "PENDING",
      scheduled_start_at: scheduledStartAt,
    });
  }
  await TournamentRound.bulkCreate(roundRows);

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
  await TournamentMatch.bulkCreate(matchRows);

  // Generate future rounds
  for (let r = 1; r < numRounds; r++) {
    const prevRoundMatches = await TournamentMatch.findByTournamentAndRound(tournamentId, r - 1);
    const matchesInRound = prevRoundMatches.length / 2;
    const nextRoundRows = [];
    for (let m = 0; m < matchesInRound; m++) {
      const slotAPrevId = prevRoundMatches[m * 2]?.id;
      const slotBPrevId = prevRoundMatches[m * 2 + 1]?.id;
      nextRoundRows.push({
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
    await TournamentMatch.bulkCreate(nextRoundRows);
  }

  logger.info(
    { tournamentId, format: "SINGLE_ELIMINATION", entries: n, rounds: numRounds, byes },
    "Generated single elimination bracket"
  );

  return { entries: n, size, byes, numRounds, format: "SINGLE_ELIMINATION" };
}
