/**
 * Balanced grouping for tournament tables (2–4 players per match).
 * Example: 10 → group sizes 4,3,3 (minimize variance under max table size).
 */
import crypto from "crypto";

const MIN_DEFAULT = 2;
const MAX_DEFAULT = 4;

/**
 * @param {number[]} entryIds
 * @param {number} minP
 * @param {number} maxP
 * @returns {number[][]}
 */
export function splitIntoBalancedGroups(entryIds, minP = MIN_DEFAULT, maxP = MAX_DEFAULT) {
  const ids = [...entryIds];
  const n = ids.length;
  if (n < minP) throw new Error(`Need at least ${minP} participants`);
  if (n <= maxP) return [ids];

  const numGroups = Math.ceil(n / maxP);
  const base = Math.floor(n / numGroups);
  const rem = n % numGroups;
  const sizes = [];
  for (let i = 0; i < numGroups; i += 1) {
    sizes.push(base + (i < rem ? 1 : 0));
  }
  const bad = sizes.some((s) => s < minP || s > maxP);
  if (bad) {
    throw new Error(`Cannot split ${n} players into ${numGroups} groups of ${minP}–${maxP}`);
  }

  const out = [];
  let idx = 0;
  for (const sz of sizes) {
    out.push(ids.slice(idx, idx + sz));
    idx += sz;
  }
  return out;
}

/**
 * Agent arena: ≤4 players → one table; &gt;4 → tables of 3–4 only (no 2-bot duels unless the whole event is 2 players).
 * Leftover single entrants get a bye match (handled by caller).
 * @returns {{ groups: number[][], byes: number[] }}
 */
export function splitIntoAgentArenaGroups(entryIds) {
  const ids = [...entryIds];
  const n = ids.length;
  if (n < 2) throw new Error("Need at least 2 participants");
  if (n === 2) return { groups: [ids], byes: [] };
  if (n <= 4) return { groups: [ids], byes: [] };

  const groups = [];
  const byes = [];
  let rest = [...ids];

  while (rest.length > 0) {
    const len = rest.length;
    if (len <= 4) {
      groups.push(rest);
      rest = [];
      break;
    }
    if (len === 5) {
      groups.push(rest.slice(0, 4));
      byes.push(rest[4]);
      rest = [];
      break;
    }
    if (len === 6) {
      groups.push(rest.slice(0, 3), rest.slice(3, 6));
      rest = [];
      break;
    }
    if (len === 7) {
      groups.push(rest.slice(0, 4), rest.slice(4, 7));
      rest = [];
      break;
    }
    if (len === 8) {
      groups.push(rest.slice(0, 4), rest.slice(4, 8));
      rest = [];
      break;
    }
    groups.push(rest.slice(0, 4));
    rest = rest.slice(4);
  }

  return { groups, byes };
}

/**
 * @param {object} match - tournament_matches row
 * @returns {number[]}
 */
export function parseParticipantEntryIds(match) {
  if (!match) return [];
  const raw = match.participant_entry_ids;
  if (raw != null) {
    let arr = raw;
    if (typeof raw === "string") {
      try {
        arr = JSON.parse(raw);
      } catch {
        arr = [];
      }
    }
    if (Array.isArray(arr) && arr.length > 0) {
      return [...new Set(arr.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))];
    }
  }
  const ids = [];
  if (match.slot_a_entry_id) ids.push(Number(match.slot_a_entry_id));
  if (match.slot_b_entry_id) ids.push(Number(match.slot_b_entry_id));
  return [...new Set(ids)];
}

export function newSpectatorToken() {
  return crypto.randomBytes(16).toString("hex");
}
