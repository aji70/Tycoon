/**
 * Tournament service: create, register, bracket, start round, on game finished.
 * All on-chain match actions (create game, join players) are done by the backend.
 */
import crypto from "crypto";
import db from "../config/database.js";
import Tournament from "../models/Tournament.js";
import UserAgent from "../models/UserAgent.js";
import TournamentEntry from "../models/TournamentEntry.js";
import TournamentRound from "../models/TournamentRound.js";
import TournamentMatch from "../models/TournamentMatch.js";
import User from "../models/User.js";
import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameSetting from "../models/GameSetting.js";
import Chat from "../models/Chat.js";
import { createGameByBackend, joinGameByBackend, isContractConfigured } from "../services/tycoonContract.js";
import { ensureUserHasContractAuthResult } from "../utils/ensureContractAuth.js";
import { getOnchainAddressForGuestFlow } from "../utils/onchainUserAddress.js";
import { createTournamentOnChain, registerForTournamentFor, isEscrowConfigured } from "../services/tournamentEscrow.js";
import logger from "../config/logger.js";
import agentRegistry from "./agentRegistry.js";
import * as bracketEngine from "./tournamentBracketEngine.js";
import { parseParticipantEntryIds, newSpectatorToken } from "./tournamentGroupHelpers.js";
import { ACTIVITY_XP, awardActivityXpByAgentId } from "./eloService.js";
import { computeNetWorthResultForGameId, placementsFromNetWorths } from "./gameNetWorthCompute.js";
import { createTwoPlayerAgentArenaGame, createMultiPlayerAgentArenaGame } from "./agentArenaGameFactory.js";

const TOURNAMENT_SYMBOLS = ["hat", "car", "dog", "thimble", "wheelbarrow", "battleship", "boot", "iron"];
const DEFAULT_STARTING_CASH = 1500;

/** Ensure guest/Privy address + DB password match on-chain state (fixes createGameByBackend "No password set"). */
async function resolveTournamentOnChainPlayer(user, chain) {
  const normalized = User.normalizeChain(chain);
  const addrOverride = getOnchainAddressForGuestFlow(user);
  const r = await ensureUserHasContractAuthResult(db, user.id, normalized, addrOverride);
  if (!r.ok) {
    logger.warn({ userId: user.id, reason: r.reason, chain: normalized }, "tournament resolveTournamentOnChainPlayer failed");
    throw new Error(r.reason || `On-chain setup failed for user ${user.id}`);
  }
  return r;
}
/** Timed autonomous agent-vs-agent tournament matches (server runner can finish-by-time). Override for tests: e.g. AGENT_TOURNAMENT_MATCH_DURATION_MIN=5 */
const AGENT_TOURNAMENT_MATCH_DURATION_MIN = (() => {
  const raw = Number(process.env.AGENT_TOURNAMENT_MATCH_DURATION_MIN);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 240) return Math.floor(raw);
  return 30;
})();
const GAME_READY_WINDOW_SECONDS = 30;

/**
 * TOURNAMENT_AGENT_VS_AGENT games use synthetic AI rows in game_players; `games.placements` keys are those user_ids.
 * Tournament entries use the human owner's `user_id`. Map tournament entry id → seat `user_id` for placement lookup.
 * When `agent_slot_assignments` rows are missing (e.g. cleaned up), optional positional fallback aligns
 * `orderedEntryIdsForFallback` index i with `game_players` sorted by turn_order (factory creation order).
 * @param {number} gameId
 * @param {number[]} entryIds
 * @param {number[]|null} [orderedEntryIdsForFallback]
 * @param {boolean} [allowPositionalFallback]
 * @returns {Promise<Map<number, number>>}
 */
export async function mapTournamentEntryIdsToSeatUserIds(
  gameId,
  entryIds,
  orderedEntryIdsForFallback = null,
  allowPositionalFallback = false
) {
  const gId = Number(gameId);
  const eids = [...new Set((entryIds || []).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
  if (!Number.isInteger(gId) || gId <= 0 || !eids.length) return new Map();

  const gps = await db("game_players")
    .where({ game_id: gId })
    .orderBy("turn_order", "asc")
    .select("user_id", "turn_order");
  if (!gps?.length) return new Map();

  const order =
    orderedEntryIdsForFallback?.length > 0
      ? [...new Set(orderedEntryIdsForFallback.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))]
      : [...eids];

  const buildPositionalMap = () => {
    const m = new Map();
    const n = Math.min(order.length, gps.length);
    for (let i = 0; i < n; i++) {
      const uid = Number(gps[i].user_id);
      if (Number.isFinite(uid)) m.set(order[i], uid);
    }
    return m;
  };

  const slotRows = await db("agent_slot_assignments")
    .where({ game_id: gId })
    .whereNotNull("user_agent_id")
    .select("slot", "user_agent_id");

  if (!slotRows?.length) {
    return allowPositionalFallback ? buildPositionalMap() : new Map();
  }

  const teas = await db("tournament_entry_agents")
    .whereIn("tournament_entry_id", eids)
    .select("tournament_entry_id", "user_agent_id");
  const teaByEid = new Map((teas || []).map((t) => [Number(t.tournament_entry_id), Number(t.user_agent_id)]));
  const slotByAgent = new Map((slotRows || []).map((s) => [Number(s.user_agent_id), Number(s.slot)]));
  const uidBySlot = new Map((gps || []).map((g) => [Number(g.turn_order), Number(g.user_id)]));

  const assignmentMap = new Map();
  for (const eid of eids) {
    const aid = teaByEid.get(eid);
    if (!aid) continue;
    const slot = slotByAgent.get(aid);
    if (slot == null || !Number.isFinite(slot)) continue;
    const uid = uidBySlot.get(slot);
    if (uid != null && Number.isFinite(uid)) assignmentMap.set(eid, uid);
  }

  if (assignmentMap.size >= order.length) return assignmentMap;

  if (assignmentMap.size === 0) {
    return allowPositionalFallback ? buildPositionalMap() : new Map();
  }

  if (!allowPositionalFallback) return assignmentMap;

  const positional = buildPositionalMap();
  const merged = new Map(assignmentMap);
  for (const eid of order) {
    if (!merged.has(eid) && positional.has(eid)) merged.set(eid, positional.get(eid));
  }
  return merged.size >= order.length ? merged : positional;
}

/**
 * Snapshot for bracket lobby: entry_id + place + display name (JSON on tournament_matches.finish_standings).
 * Written when the table game finishes so Results do not depend on agent_slot_assignments surviving.
 */
async function buildFinishStandingsForMatch(game, match, entries, winnerEntry) {
  const entryMap = new Map((entries || []).map((e) => [Number(e.id), e]));
  const entryDisplay = (e) =>
    (e?.agent_name && String(e.agent_name).trim()) || e?.username || e?.user_address || null;

  let participantIds = parseParticipantEntryIds(match);
  if (!participantIds.length) {
    participantIds = [match.slot_a_entry_id, match.slot_b_entry_id].filter(Boolean).map(Number);
  }
  participantIds = [...new Set(participantIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (participantIds.length < 2) return null;

  let placements = {};
  if (game?.placements != null) {
    try {
      const raw = typeof game.placements === "string" ? JSON.parse(game.placements) : game.placements;
      if (raw && typeof raw === "object") placements = raw;
    } catch {
      placements = {};
    }
  }

  const gtUpper = String(game.game_type || "").toUpperCase();
  const allowPos = gtUpper === "TOURNAMENT_AGENT_VS_AGENT";
  const seatMap = await mapTournamentEntryIdsToSeatUserIds(
    game.id,
    participantIds,
    participantIds,
    allowPos
  );

  const rows = participantIds.map((eid) => {
    const e = entryMap.get(Number(eid));
    const seatUid = seatMap.get(Number(eid));
    const uid = seatUid != null ? seatUid : e?.user_id != null ? Number(e.user_id) : null;
    let place = 999;
    if (uid != null) {
      if (Object.prototype.hasOwnProperty.call(placements, uid)) place = Number(placements[uid]);
      else if (Object.prototype.hasOwnProperty.call(placements, String(uid))) place = Number(placements[String(uid)]);
    }
    return { entry_id: Number(eid), place, username: entryDisplay(e) };
  });

  let allBad = rows.length > 0 && rows.every((r) => r.place >= 900);
  if (allBad && participantIds.length === 2 && winnerEntry) {
    const wid = Number(winnerEntry.id);
    if (participantIds.includes(wid)) {
      rows.forEach((r) => {
        r.place = r.entry_id === wid ? 1 : 2;
      });
      allBad = false;
    }
  }

  rows.sort((a, b) => a.place - b.place || a.entry_id - b.entry_id);
  if (rows.some((r) => r.place >= 900)) return null;
  return rows;
}

function getMatchEntryIds(match) {
  const parsed = parseParticipantEntryIds(match);
  if (parsed.length >= 2) return parsed;
  const ids = [];
  if (match.slot_a_entry_id) ids.push(Number(match.slot_a_entry_id));
  if (match.slot_b_entry_id) ids.push(Number(match.slot_b_entry_id));
  return [...new Set(ids)];
}

/** Advancers from a completed match row (GROUP_ELIMINATION: advancing_entry_ids or winner only). */
function parseAdvancingEntryIdsFromMatchRow(m) {
  if (!m) return [];
  if (String(m.status).toUpperCase() === "BYE" && m.winner_entry_id) {
    const id = Number(m.winner_entry_id);
    return Number.isInteger(id) && id > 0 ? [id] : [];
  }
  let raw = m.advancing_entry_ids;
  if (raw != null && typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
  }
  if (m.winner_entry_id) {
    const id = Number(m.winner_entry_id);
    return Number.isInteger(id) && id > 0 ? [id] : [];
  }
  return [];
}

/**
 * GROUP_ELIMINATION: top 2 advance from 3–4 player pods (by net-worth placements).
 * Single match in round with 4 entrants = championship (final four) → winner only advances.
 */
async function computeGroupEliminationAdvancingAndWinner(game, match, tournamentEntries) {
  const participantEntryIds = getMatchEntryIds(match);
  const n = participantEntryIds.length;
  if (n < 1) return null;

  const roundMatches = await TournamentMatch.findByTournamentAndRound(match.tournament_id, match.round_index);
  const matchesInRound = (roundMatches || []).filter((mm) => String(mm.status).toUpperCase() !== "CANCELLED").length;
  const isFinalFourChampionship = matchesInRound === 1 && n === 4;

  let placementsObj = {};
  if (game.placements != null) {
    try {
      placementsObj = typeof game.placements === "string" ? JSON.parse(game.placements) : game.placements;
    } catch {
      placementsObj = {};
    }
  }

  const entryById = new Map((tournamentEntries || []).map((e) => [Number(e.id), e]));

  const placementForUser = (uid) => {
    if (uid == null) return 999;
    const u = Number(uid);
    if (Number.isFinite(u) && Object.prototype.hasOwnProperty.call(placementsObj, u)) return Number(placementsObj[u]);
    if (Object.prototype.hasOwnProperty.call(placementsObj, String(u))) return Number(placementsObj[String(u)]);
    return 999;
  };

  const gtUpper = String(game.game_type || "").toUpperCase();
  const entrySeatUid =
    gtUpper === "TOURNAMENT_AGENT_VS_AGENT"
      ? await mapTournamentEntryIdsToSeatUserIds(game.id, participantEntryIds, participantEntryIds, true)
      : new Map();
  const uidForPlacement = (eid) => {
    const seat = entrySeatUid.get(Number(eid));
    if (seat != null) return seat;
    const entry = entryById.get(Number(eid));
    return entry?.user_id != null ? Number(entry.user_id) : null;
  };

  const buildRanked = () =>
    participantEntryIds
      .map((eid) => {
        const entry = entryById.get(Number(eid));
        const uid = uidForPlacement(eid);
        return { entry, eid: Number(eid), pos: placementForUser(uid) };
      })
      .filter((x) => x.entry)
      .sort((a, b) => a.pos - b.pos);

  let ranked = buildRanked();
  let hasGoodPlacements = ranked.length >= n && ranked[0].pos < 900;

  /** 3–4 player pods often finish without game.placements (client PATCH FINISHED only). Derive from net worth. */
  if (!hasGoodPlacements && n >= 3) {
    const nw = await computeNetWorthResultForGameId(game.id);
    if (nw?.net_worths?.length) {
      const allowedUids = new Set(
        participantEntryIds
          .map((eid) => entryById.get(Number(eid))?.user_id)
          .filter((uid) => uid != null)
          .map((uid) => Number(uid))
      );
      const subset = nw.net_worths.filter((row) => allowedUids.has(Number(row.user_id)));
      const source = subset.length >= n ? subset : nw.net_worths.length >= n ? nw.net_worths : null;
      if (source) {
        placementsObj = placementsFromNetWorths(source);
        ranked = buildRanked();
        hasGoodPlacements = ranked.length >= n && ranked[0].pos < 900;
        if (hasGoodPlacements) {
          try {
            await db("games").where({ id: game.id }).update({
              placements: JSON.stringify(placementsObj),
              updated_at: db.fn.now(),
            });
          } catch (err) {
            logger.warn(
              { err: err?.message, gameId: game.id },
              "Could not persist derived placements for tournament game"
            );
          }
        }
      }
    }
  }

  const gt = String(game.game_type || "");

  if (n === 2 && !hasGoodPlacements) {
    if (gt === "TOURNAMENT_AGENT_VS_AGENT") {
      const winnerUserId = game.winner_id;
      const wgp = await db("game_players")
        .where({ game_id: game.id, user_id: winnerUserId })
        .select("turn_order")
        .first();
      const ord = Number(wgp?.turn_order || 0);
      const winEntryId = ord === 1 ? match.slot_a_entry_id : ord === 2 ? match.slot_b_entry_id : null;
      let we =
        tournamentEntries.find((e) => Number(e.id) === Number(winEntryId)) ||
        (winEntryId ? await TournamentEntry.findById(winEntryId) : null);
      if (we) return { advancingEntryIds: [we.id], winnerEntry: we };
    }
    const we = tournamentEntries.find((e) => e.user_id === game.winner_id);
    if (we) return { advancingEntryIds: [we.id], winnerEntry: we };
    return null;
  }

  if (!hasGoodPlacements) return null;

  const takeCount = n <= 2 || isFinalFourChampionship ? 1 : Math.min(2, ranked.length);
  const advancingEntryIds = ranked.slice(0, takeCount).map((x) => x.eid);
  const winnerEntry = ranked[0]?.entry || null;
  if (!winnerEntry) return null;
  return { advancingEntryIds, winnerEntry };
}

function tournamentBoardRedirectUrl(code) {
  const c = code ? String(code).trim() : "";
  return `/board-3d-multi?gameCode=${encodeURIComponent(c)}`;
}

/** Tournament game code pattern (e.g. T7-R0-M0). Used to detect tournament games for "all ready" flow. */
function isTournamentGameCode(code) {
  return code && /^T\d+-R\d+-M\d+$/i.test(String(code).trim());
}

/** Cross-tournament “already on a board” guard removed so multiple tournament games can run in parallel. */
async function assertNoCrossTournamentConflict(_tournamentId, _entryList) {
  return;
}

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
    visibility: rawVisibility,
    allowed_agent_ids: rawAllowedAgents,
    is_agent_only: rawAgentOnly,
  } = data;

  if (!creator_id || !name) throw new Error("creator_id and name required");
  if (chain == null || String(chain).trim() === "") throw new Error("chain is required (e.g. POLYGON, BASE, CELO)");

  const visUpper = rawVisibility ? String(rawVisibility).toUpperCase() : "OPEN";
  const visibility = ["OPEN", "INVITE_ONLY", "BOT_SELECTION"].includes(visUpper) ? visUpper : "OPEN";

  let allowedIds = [];
  if (visibility === "BOT_SELECTION") {
    const raw = rawAllowedAgents;
    if (Array.isArray(raw)) allowedIds = [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
    else if (raw != null && typeof raw === "string") {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) allowedIds = [...new Set(p.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
      } catch {
        allowedIds = [];
      }
    }
    if (allowedIds.length < 2) throw new Error("Bot-selection tournaments need at least two discoverable agents");
    const agents = await db("user_agents").whereIn("id", allowedIds).select("id", "is_public");
    if (agents.length !== allowedIds.length) throw new Error("One or more agent IDs are invalid");
    const allPublic = agents.every((a) => Number(a.is_public) === 1 || a.is_public === true);
    if (!allPublic) throw new Error("All invited agents must be public (visible in Discover)");
  }

  let max = Math.min(512, Math.max(2, Number(max_players) || 32));
  let min = Math.max(2, Math.min(max, Number(min_players) || 2));
  if (visibility === "BOT_SELECTION") {
    max = Math.min(512, Math.max(2, allowedIds.length));
    min = Math.min(min, max);
  }

  const normalizedChain = User.normalizeChain(chain);
  const allowedFormats = ["SINGLE_ELIMINATION", "ROUND_ROBIN", "SWISS", "BATTLE_ROYALE", "GROUP_ELIMINATION"];
  const fmt = data.format && allowedFormats.includes(String(data.format).toUpperCase()) ? String(data.format).toUpperCase() : "SINGLE_ELIMINATION";

  if (prize_source === "CREATOR_FUNDED") {
    const pw = prize_pool_wei != null ? Number(prize_pool_wei) : 0;
    if (!Number.isFinite(pw) || pw <= 0) {
      throw new Error("Creator-funded tournaments require a prize pool amount (USDC in wei). Set prize_pool_wei before creating.");
    }
  }

  const inviteToken = visibility === "INVITE_ONLY" ? crypto.randomBytes(24).toString("hex") : null;
  const allowedJson =
    visibility === "BOT_SELECTION" && allowedIds.length ? JSON.stringify(allowedIds) : null;
  const is_agent_only =
    visibility === "BOT_SELECTION" ? true : Boolean(rawAgentOnly);

  const payload = {
    creator_id,
    name: String(name).trim(),
    status: "REGISTRATION_OPEN",
    prize_source: prize_source || "NO_POOL",
    format: fmt,
    max_players: max,
    min_players: min,
    entry_fee_wei: prize_source === "ENTRY_FEE_POOL" ? Number(entry_fee_wei) || 0 : 0,
    prize_pool_wei: prize_source === "CREATOR_FUNDED" ? (prize_pool_wei != null ? String(prize_pool_wei) : null) : null,
    prize_distribution: prize_source === "NO_POOL" ? null : prize_distribution || null,
    registration_deadline: registration_deadline || null,
    chain: normalizedChain,
    visibility,
    invite_token: inviteToken,
    allowed_agent_ids: allowedJson,
    is_agent_only,
  };

  const tournament = await Tournament.create(payload);

  if (!isEscrowConfigured(normalizedChain)) {
    await Tournament.delete(tournament.id);
    throw new Error(
      "Tournament escrow not configured for this chain (set TOURNAMENT_ESCROW_ADDRESS_* env). Tournament was not created."
    );
  }

  try {
    const creator = await User.findById(creator_id);
    const creatorAddress =
      (creator?.address && String(creator.address).trim()) ||
      (creator?.linked_wallet_address && String(creator.linked_wallet_address).trim()) ||
      "0x0000000000000000000000000000000000000000";
    const result = await createTournamentOnChain(
      tournament.id,
      tournament.entry_fee_wei ?? 0,
      creatorAddress,
      normalizedChain
    );
    if (result == null) {
      await Tournament.delete(tournament.id);
      throw new Error("On-chain tournament creation did not complete (escrow returned null). Tournament was not created.");
    }
    const onChainTxHash = result.hash ?? null;
    logger.info({ tournamentId: tournament.id, chain: normalizedChain, hash: onChainTxHash }, "Escrow createTournament succeeded");
    return {
      ...tournament,
      created_on_chain: true,
      on_chain_error: null,
      on_chain_tx_hash: onChainTxHash,
    };
  } catch (err) {
    await Tournament.delete(tournament.id);
    const msg = err?.message || String(err);
    logger.error(
      { err: msg, tournamentId: tournament.id, chain: normalizedChain },
      "Escrow createTournament failed; tournament rolled back from DB"
    );
    throw new Error(`Tournament creation failed on-chain: ${msg}. Tournament was not created.`);
  }
}

/**
 * Register a player for a tournament (off-chain only).
 * Human events: one entry per user (and linked-wallet dedupe).
 * Invited-bot / agents-only: one entry per user_agent_id; same human may have multiple agents in the same event.
 * @param {{ invite_token?: string, user_agent_id?: number }} meta
 */
export async function registerPlayer(tournamentId, { userId, address, chain }, paymentTxHash = null, meta = {}) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "REGISTRATION_OPEN") throw new Error("Registration is closed");

  const vis = String(tournament.visibility || "OPEN").toUpperCase();
  if (vis === "INVITE_ONLY") {
    const need = String(tournament.invite_token || "").trim();
    const got = String(meta.invite_token || "").trim();
    if (!need || got !== need) throw new Error("Valid tournament invite is required to register");
  }
  const agentOnlyEvent = Boolean(tournament.is_agent_only);
  if (agentOnlyEvent && vis !== "BOT_SELECTION") {
    const aid = Number(meta.user_agent_id);
    if (!Number.isInteger(aid) || aid <= 0) {
      throw new Error("This is an agents-only tournament: choose which of your agents represents you when registering.");
    }
  }

  if (vis === "BOT_SELECTION") {
    const aid = Number(meta.user_agent_id);
    if (!Number.isInteger(aid) || aid <= 0) throw new Error("user_agent_id is required for this tournament");
    let allowed = tournament.allowed_agent_ids;
    if (typeof allowed === "string") {
      try {
        allowed = JSON.parse(allowed);
      } catch {
        allowed = [];
      }
    }
    const ok = Array.isArray(allowed) && allowed.map(Number).includes(aid);
    if (!ok) throw new Error("This agent is not on the invitation list for this tournament");
  }

  const normalizedChain = User.normalizeChain(chain || tournament.chain);

  let user;
  if (userId) {
    user = await User.findById(userId);
    if (!user) throw new Error("User not found");
  } else if (address) {
    user = await User.resolveUserByAddress(address, normalizedChain);
    // Wallet-only or guest without prior User: create minimal user when we have proof
    // (paymentTxHash = paid on-chain; or free tournament = backend will call registerForTournamentFor)
    const isFree = Number(tournament.entry_fee_wei) === 0;
    if (!user && (paymentTxHash || isFree)) {
      try {
        const addr = String(address).trim();
        user = await User.create({ address: addr, username: addr, chain: normalizedChain });
        logger.info({ address: addr, chain: normalizedChain }, "Created minimal user for tournament registration");
      } catch (createErr) {
        logger.error({ err: createErr?.message, address }, "Tournament register: create user failed");
        throw new Error("User not found for this address on this chain");
      }
    }
    if (!user) throw new Error("User not found for this address on this chain");
  } else {
    throw new Error("userId or address required");
  }

  const userChainNorm = User.normalizeChain(user.chain);
  const tournamentChainNorm = User.normalizeChain(tournament.chain);
  if (userChainNorm !== tournamentChainNorm) {
    // User may have an account on the tournament's chain with the same address (e.g. Polygon-only app)
    const userOnTournamentChain =
      (await User.findByAddress(user.address, tournamentChainNorm)) ||
      (await User.findByLinkedWallet(user.address, tournamentChainNorm));
    if (userOnTournamentChain) {
      user = userOnTournamentChain;
    } else {
      throw new Error(`You need an account on ${tournament.chain} to join this tournament`);
    }
  }

  const regAgentIdForDup = Number(meta.user_agent_id);
  const allowMultiEntriesSameUser =
    (vis === "BOT_SELECTION" || agentOnlyEvent) &&
    Number.isInteger(regAgentIdForDup) &&
    regAgentIdForDup > 0;

  if (allowMultiEntriesSameUser) {
    if (await TournamentEntry.hasAgentEntry(tournamentId, regAgentIdForDup)) {
      throw new Error("This agent is already registered for this tournament");
    }
  } else {
    const already = await TournamentEntry.hasEntry(tournamentId, { userId: user.id, address: user.address });
    if (already) throw new Error("Already registered for this tournament");
    if (user.linked_wallet_address) {
      const byLinked = await TournamentEntry.findByTournamentAndAddress(tournamentId, user.linked_wallet_address);
      if (byLinked) throw new Error("This wallet is already registered");
    }
  }

  const count = await TournamentEntry.countByTournament(tournamentId);
  if (count >= tournament.max_players) throw new Error("Tournament is full");

  if (tournament.prize_source === "ENTRY_FEE_POOL" && Number(tournament.entry_fee_wei) > 0 && !paymentTxHash) {
    throw new Error("Entry fee payment required");
  }

  let txHash = paymentTxHash;

  // When no tx hash (e.g. guest) and free tournament, backend calls contract on behalf of the player
  if (!txHash && Number(tournament.entry_fee_wei) === 0 && user?.address && isEscrowConfigured(tournamentChainNorm)) {
    try {
      const result = await registerForTournamentFor(Number(tournamentId), user.address, tournamentChainNorm);
      if (result?.hash) txHash = result.hash;
    } catch (err) {
      logger.error({ err: err?.message, tournamentId, address: user.address }, "Escrow registerForTournamentFor failed");
      throw new Error("Failed to register on-chain. Please try again.");
    }
  }

  const entry = await TournamentEntry.create({
    tournament_id: tournamentId,
    user_id: user.id,
    address: user.address,
    chain: user.chain,
    seed_order: count + 1,
    payment_tx_hash: txHash || null,
    status: "CONFIRMED",
  });

  const regAgentId = Number(meta.user_agent_id);
  if (Number.isInteger(regAgentId) && regAgentId > 0) {
    const agent = await UserAgent.findByIdAndUser(regAgentId, user.id);
    if (!agent) throw new Error("You do not own this agent");
    await db("tournament_entry_agents").insert({
      tournament_entry_id: entry.id,
      user_agent_id: regAgentId,
      agent_name: agent.name || null,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    awardActivityXpByAgentId(regAgentId, ACTIVITY_XP.TOURNAMENT_JOINED, "tournament_joined").catch(() => {});
  }

  return entry;
}

const START_WINDOW_MINUTES = 5;

/**
 * Close registration and generate bracket. Pads to power of 2 with BYEs.
 * @param {string} tournamentId
 * @param {{ first_round_start_at?: string | Date }} options - Optional. first_round_start_at in ISO or Date; round 1 = +1 day, etc.
 */
export async function generateBracket(tournamentId, options = {}) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "REGISTRATION_OPEN") throw new Error("Registration already closed");

  const entries = await TournamentEntry.findByTournament(tournamentId);
  const n = entries.length;
  if (n < tournament.min_players) throw new Error(`Need at least ${tournament.min_players} players`);

  // Dispatch based on tournament format
  const format = tournament.format || "SINGLE_ELIMINATION";
  const result = await bracketEngine.generateBracketByFormat(tournamentId, format, entries, {
    ...options,
    isAgentOnly: Boolean(tournament.is_agent_only),
  });

  logger.info({ tournamentId, format, ...result }, "Generated tournament bracket");
  return result;
}

/**
 * Create on-chain game + DB game for one match (2+ players).
 * - 2 players: existing 1v1 flow.
 * - 3–4 players: one shared game with number_of_players = N.
 */
async function createMatchGame(tournamentId, matchId) {
  const match = await TournamentMatch.findById(matchId);
  if (!match || match.tournament_id !== Number(tournamentId)) return null;
  if (match.status === "BYE" || match.status === "COMPLETED") return null;
  if (match.game_id) return match;

  const tournament = await Tournament.findById(tournamentId);
  const entryIds = getMatchEntryIds(match);
  const entries = await Promise.all(entryIds.map((id) => TournamentEntry.findById(id)));
  const cleaned = entries.filter(Boolean);
  if (cleaned.length < 2 || cleaned.length !== entryIds.length) return null;
  await assertNoCrossTournamentConflict(tournamentId, cleaned);
  if (cleaned.length === 2) {
    return createTwoPlayerMatchGame(tournament, match, cleaned[0], cleaned[1], tournamentId, matchId);
  }
  return createMultiplayerMatchGame(tournament, match, cleaned, tournamentId, matchId);
}

/**
 * Create on-chain game + DB game for a 1v1 match.
 * - If both players have password_hash: backend creates game on contract and joins both.
 * - Otherwise: create lobby game (DB only). Players go to lobby and create/join via wallet.
 */
async function createTwoPlayerMatchGame(tournament, match, entryA, entryB, tournamentId, matchId) {
  const chain = User.normalizeChain(tournament.chain);

  const userA = await User.findById(entryA.user_id);
  const userB = await User.findById(entryB.user_id);
  const canBackendJoin = userA?.password_hash && userB?.password_hash && isContractConfigured(chain);

  const vis = String(tournament.visibility || "").toUpperCase();
  const useAutonomousAgents =
    vis === "BOT_SELECTION" || Boolean(Number(tournament.is_agent_only ?? 0));
  if (useAutonomousAgents) {
    const entryRows = await db("tournament_entry_agents")
      .whereIn("tournament_entry_id", [entryA.id, entryB.id])
      .select("tournament_entry_id", "user_agent_id", "agent_name");
    const byEntry = new Map(entryRows.map((r) => [Number(r.tournament_entry_id), r]));
    const ra = byEntry.get(Number(entryA.id));
    const rb = byEntry.get(Number(entryB.id));
    if (ra?.user_agent_id && rb?.user_agent_id) {
      const tCode = `T${tournamentId}-R${match.round_index}-M${match.match_index}`.toUpperCase();
      const game = await createTwoPlayerAgentArenaGame({
        forcedCode: tCode,
        gameType: "TOURNAMENT_AGENT_VS_AGENT",
        analyticsSource: "tournament_autonomous",
        creatorUserId: entryA.user_id,
        challengerUserAgentId: Number(ra.user_agent_id),
        opponentUserAgentId: Number(rb.user_agent_id),
        challengerName: ra.agent_name || "Slot A",
        opponentName: rb.agent_name || "Slot B",
        chain: tournament.chain,
        settings: {
          duration: AGENT_TOURNAMENT_MATCH_DURATION_MIN,
          starting_cash: DEFAULT_STARTING_CASH,
        },
      });
      await TournamentMatch.update(matchId, {
        game_id: game.id,
        game_code: tCode,
        contract_game_id: null,
        status: "IN_PROGRESS",
        spectator_token: match.spectator_token || newSpectatorToken(),
      });
      return { match: await TournamentMatch.findById(matchId), game };
    }
  }

  const code = `T${tournamentId}-R${match.round_index}-M${match.match_index}`.toUpperCase();

  // Resolve preferred symbols from "Start now" requests so initiator can choose their token.
  const startRequests = await db("tournament_match_start_requests").where({ match_id: matchId }).select("entry_id", "preferred_symbol");
  const prefByEntry = Object.fromEntries(
    (startRequests || []).map((r) => [r.entry_id, r.preferred_symbol])
  );

  // When the organizer clicks "Create game" (startRound), there are no start_requests — create a lobby
  // so both players (including the game creator) join and choose their symbols in the waiting room.
  if (canBackendJoin && startRequests.length === 0) {
    return createLobbyGame(tournament, match, userA, userB, tournamentId, matchId, entryA, entryB);
  }

  let symbolA = TOURNAMENT_SYMBOLS.includes(prefByEntry[entryA.id]) ? prefByEntry[entryA.id] : TOURNAMENT_SYMBOLS[0];
  let symbolB = TOURNAMENT_SYMBOLS.includes(prefByEntry[entryB.id]) ? prefByEntry[entryB.id] : TOURNAMENT_SYMBOLS[1];
  if (symbolA === symbolB) {
    symbolB = TOURNAMENT_SYMBOLS.find((s) => s !== symbolA) || TOURNAMENT_SYMBOLS[1];
  }

  // If contract not configured, create DB-only lobby (players create/join via wallet).
  if (!isContractConfigured(chain)) {
    return createLobbyGame(tournament, match, userA, userB, tournamentId, matchId, entryA, entryB);
  }

  // Create game on-chain whenever any player has password_hash (backend can create). Prefer both join if both have it; else use whoever has password_hash as creator.
  if (!canBackendJoin && userA?.password_hash) {
    return createTournamentGameOnChainLobby(
      tournament,
      match,
      userA,
      userB,
      tournamentId,
      matchId,
      code,
      symbolA,
      symbolB,
      entryA,
      entryB
    );
  }
  if (!canBackendJoin && userB?.password_hash) {
    return createTournamentGameOnChainLobbyCreatorB(
      tournament,
      match,
      userA,
      userB,
      tournamentId,
      matchId,
      code,
      symbolA,
      symbolB,
      entryA,
      entryB
    );
  }
  if (!canBackendJoin) {
    return createLobbyGame(tournament, match, userA, userB, tournamentId, matchId, entryA, entryB);
  }

  const authA = await resolveTournamentOnChainPlayer(userA, chain);
  const authB = await resolveTournamentOnChainPlayer(userB, chain);

  let result;
  try {
    result = await createGameByBackend(
      authA.address,
      authA.password_hash,
      authA.username,
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
      authB.address,
      authB.password_hash,
      contractGameId,
      authB.username,
      symbolB,
      code,
      chain
    );
  } catch (err) {
    logger.error({ err: err?.message, tournamentId, matchId }, "Tournament joinGameByBackend failed");
    throw err;
  }

  // Tournament: game stays PENDING until all players click "Start now" within 30s on the board.
  const now = new Date();
  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: userA.id,
    next_player_id: userA.id,
    number_of_players: 2,
    status: "PENDING",
    is_minipay: false,
    is_ai: false,
    chain: tournament.chain,
    contract_game_id: String(contractGameId),
    ready_window_opens_at: now,
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
    address: authA.address,
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
    address: authB.address,
    balance: DEFAULT_STARTING_CASH,
    position: 0,
    turn_order: 2,
    symbol: symbolB,
    chance_jail_card: false,
    community_chest_jail_card: false,
  });

  await bindTournamentEntryAgentsToGame(game.id, [entryA, entryB]);

  await TournamentMatch.update(matchId, {
    game_id: game.id,
    contract_game_id: String(contractGameId),
    status: "IN_PROGRESS",
    spectator_token: match.spectator_token || newSpectatorToken(),
  });

  return { match, game };
}

/**
 * Create tournament game on-chain with creator only; second player joins via lobby (game-waiting).
 */
async function createTournamentGameOnChainLobby(
  tournament,
  match,
  userA,
  userB,
  tournamentId,
  matchId,
  code,
  symbolA,
  symbolB,
  entryA,
  entryB
) {
  const chain = User.normalizeChain(tournament.chain);
  const authA = await resolveTournamentOnChainPlayer(userA, chain);
  let result;
  try {
    result = await createGameByBackend(
      authA.address,
      authA.password_hash,
      authA.username,
      "PRIVATE",
      symbolA,
      2,
      code,
      DEFAULT_STARTING_CASH,
      0n,
      chain
    );
  } catch (err) {
    logger.error({ err: err?.message, tournamentId, matchId }, "Tournament createGameByBackend (creator only) failed");
    throw err;
  }
  const contractGameId = result?.gameId;
  if (!contractGameId) throw new Error("Contract did not return game ID");

  const creatorId = userA?.id ?? match.slot_a_entry_id;
  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: creatorId,
    next_player_id: creatorId,
    number_of_players: 2,
    status: "PENDING",
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
    address: authA.address,
    balance: DEFAULT_STARTING_CASH,
    position: 0,
    turn_order: 1,
    symbol: symbolA,
    chance_jail_card: false,
    community_chest_jail_card: false,
  });

  await bindTournamentEntryAgentsToGame(game.id, [entryA, entryB]);
  await TournamentMatch.update(matchId, {
    game_id: game.id,
    contract_game_id: String(contractGameId),
    status: "AWAITING_PLAYERS",
    spectator_token: match.spectator_token || newSpectatorToken(),
  });
  logger.info(
    { tournamentId, matchId, code, message: "Tournament game created on-chain; second player joins via game-waiting" },
    "Tournament lobby (on-chain)"
  );
  return { match: await TournamentMatch.findById(matchId), game };
}

/**
 * Create tournament game on-chain with slot B (userB) as creator; slot A joins via lobby.
 */
async function createTournamentGameOnChainLobbyCreatorB(
  tournament,
  match,
  userA,
  userB,
  tournamentId,
  matchId,
  code,
  symbolA,
  symbolB,
  entryA,
  entryB
) {
  const chain = User.normalizeChain(tournament.chain);
  const authB = await resolveTournamentOnChainPlayer(userB, chain);
  let result;
  try {
    result = await createGameByBackend(
      authB.address,
      authB.password_hash,
      authB.username,
      "PRIVATE",
      symbolB,
      2,
      code,
      DEFAULT_STARTING_CASH,
      0n,
      chain
    );
  } catch (err) {
    logger.error({ err: err?.message, tournamentId, matchId }, "Tournament createGameByBackend (creator B only) failed");
    throw err;
  }
  const contractGameId = result?.gameId;
  if (!contractGameId) throw new Error("Contract did not return game ID");

  const creatorId = userB?.id ?? match.slot_b_entry_id;
  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: creatorId,
    next_player_id: creatorId,
    number_of_players: 2,
    status: "PENDING",
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
    user_id: userB.id,
    address: authB.address,
    balance: DEFAULT_STARTING_CASH,
    position: 0,
    turn_order: 1,
    symbol: symbolB,
    chance_jail_card: false,
    community_chest_jail_card: false,
  });

  // Turn order 1 = userB (entryB), turn order 2 = userA (entryA) once joined
  await bindTournamentEntryAgentsToGame(game.id, [entryB, entryA]);
  await TournamentMatch.update(matchId, {
    game_id: game.id,
    contract_game_id: String(contractGameId),
    status: "AWAITING_PLAYERS",
    spectator_token: match.spectator_token || newSpectatorToken(),
  });
  logger.info(
    { tournamentId, matchId, code, message: "Tournament game created on-chain (creator B); slot A joins via game-waiting" },
    "Tournament lobby on-chain (creator B)"
  );
  return { match: await TournamentMatch.findById(matchId), game };
}

/**
 * Create lobby game (DB only, no contract). Players go to game-waiting and create/join via wallet.
 */
async function createLobbyGame(tournament, match, userA, userB, tournamentId, matchId, entryA, entryB) {
  const code = `T${tournamentId}-R${match.round_index}-M${match.match_index}`.toUpperCase();
  const creatorId = userA?.id ?? match.slot_a_entry_id;
  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: creatorId,
    next_player_id: creatorId,
    number_of_players: 2,
    status: "PENDING",
    is_minipay: false,
    is_ai: false,
    chain: tournament.chain,
    contract_game_id: null,
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
  await bindTournamentEntryAgentsToGame(game.id, [entryA, entryB]);
  await TournamentMatch.update(matchId, {
    game_id: game.id,
    status: "AWAITING_PLAYERS",
    spectator_token: match.spectator_token || newSpectatorToken(),
  });
  logger.info(
    { tournamentId, matchId, code, message: "Lobby game created; players join via game-waiting" },
    "Tournament lobby game"
  );
  return { match: await TournamentMatch.findById(matchId), game };
}

function pickUniqueTournamentSymbols(orderedEntries, prefByEntryId) {
  const used = new Set();
  const out = [];
  for (let i = 0; i < orderedEntries.length; i++) {
    const eid = orderedEntries[i].id;
    const pref = prefByEntryId[eid];
    const prefOk = pref && TOURNAMENT_SYMBOLS.includes(String(pref).toLowerCase()) ? String(pref).toLowerCase() : null;
    if (prefOk && !used.has(prefOk)) {
      used.add(prefOk);
      out.push(prefOk);
      continue;
    }
    const sym = TOURNAMENT_SYMBOLS.find((s) => !used.has(s)) || TOURNAMENT_SYMBOLS[i % TOURNAMENT_SYMBOLS.length];
    used.add(sym);
    out.push(sym);
  }
  return out;
}

async function bindTournamentEntryAgentsToGame(gameId, orderedEntries) {
  try {
    const ids = orderedEntries.map((e) => e.id);
    const entryAgentRows = await db("tournament_entry_agents")
      .whereIn("tournament_entry_id", ids)
      .select("tournament_entry_id", "user_agent_id", "agent_name");
    const byEntryId = new Map(entryAgentRows.map((r) => [Number(r.tournament_entry_id), r]));
    let slot = 1;
    for (const entry of orderedEntries) {
      const row = byEntryId.get(Number(entry.id));
      if (row?.user_agent_id) {
        await agentRegistry.registerAgent({
          gameId,
          slot,
          agentId: String(row.user_agent_id),
          user_agent_id: Number(row.user_agent_id),
          chainId: 42220,
          name: row.agent_name || "Agent",
        });
        awardActivityXpByAgentId(Number(row.user_agent_id), ACTIVITY_XP.GAME_CREATED, "game_created").catch(() => {});
      }
      slot += 1;
    }
  } catch (err) {
    logger.warn({ err: err?.message, gameId }, "tournament entry agent binding failed (multi)");
  }
}

/**
 * 3–4 player tournament table: shared contract game when all accounts allow backend join; else lobby.
 */
async function createMultiplayerMatchGame(tournament, match, orderedEntries, tournamentId, matchId) {
  const N = orderedEntries.length;
  if (N < 3 || N > 4) {
    logger.warn({ tournamentId, matchId, N }, "createMultiplayerMatchGame: only 3–4 supported on one table");
    return null;
  }
  const chain = User.normalizeChain(tournament.chain);
  const users = await Promise.all(orderedEntries.map((e) => User.findById(e.user_id)));
  if (users.some((u) => !u)) return null;

  const vis = String(tournament.visibility || "").toUpperCase();
  const useAutonomousAgents = vis === "BOT_SELECTION" || Boolean(Number(tournament.is_agent_only ?? 0));
  if (useAutonomousAgents) {
    const entryAgentRows = await db("tournament_entry_agents")
      .whereIn("tournament_entry_id", orderedEntries.map((e) => e.id))
      .select("tournament_entry_id", "user_agent_id", "agent_name");
    const byEntryId = new Map(entryAgentRows.map((r) => [Number(r.tournament_entry_id), r]));
    const orderedAgents = orderedEntries.map((e) => byEntryId.get(Number(e.id))).filter(Boolean);
    if (orderedAgents.length === N && orderedAgents.every((a) => a?.user_agent_id)) {
      try {
        const code = `T${tournamentId}-R${match.round_index}-M${match.match_index}`.toUpperCase();
        const game = await createMultiPlayerAgentArenaGame({
          forcedCode: code,
          orderedAgents: orderedAgents.map((a) => ({ user_agent_id: a.user_agent_id, agent_name: a.agent_name })),
          creatorUserId: users[0]?.id ?? orderedEntries[0]?.user_id,
          chain: tournament.chain,
          settings: { duration: AGENT_TOURNAMENT_MATCH_DURATION_MIN, starting_cash: DEFAULT_STARTING_CASH },
        });
        const specTok = match.spectator_token || newSpectatorToken();
        await TournamentMatch.update(matchId, {
          game_id: game.id,
          game_code: code,
          contract_game_id: null,
          status: "IN_PROGRESS",
          spectator_token: specTok,
        });
        logger.info({ tournamentId, matchId, code, N }, "Tournament multi agent arena game created");
        return { match: await TournamentMatch.findById(matchId), game };
      } catch (err) {
        logger.error({ err: err?.message, tournamentId, matchId }, "createMultiPlayerAgentArenaGame failed");
        throw err;
      }
    }
  }

  const code = `T${tournamentId}-R${match.round_index}-M${match.match_index}`.toUpperCase();
  const startRequests = await db("tournament_match_start_requests").where({ match_id: matchId }).select("entry_id", "preferred_symbol");
  const prefByEntry = Object.fromEntries((startRequests || []).map((r) => [r.entry_id, r.preferred_symbol]));
  const symbols = pickUniqueTournamentSymbols(orderedEntries, prefByEntry);

  const canBackendJoin = users.every((u) => u?.password_hash) && isContractConfigured(chain);

  if (canBackendJoin && startRequests.length === 0) {
    const creatorId = users[0]?.id ?? orderedEntries[0]?.id;
    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: creatorId,
      next_player_id: creatorId,
      number_of_players: N,
      status: "PENDING",
      is_minipay: false,
      is_ai: false,
      chain: tournament.chain,
      contract_game_id: null,
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
    await bindTournamentEntryAgentsToGame(game.id, orderedEntries);
    const specTok = match.spectator_token || newSpectatorToken();
    await TournamentMatch.update(matchId, {
      game_id: game.id,
      status: "AWAITING_PLAYERS",
      spectator_token: specTok,
    });
    logger.info({ tournamentId, matchId, code, N }, "Tournament multi lobby (DB); players join via game-waiting");
    return { match: await TournamentMatch.findById(matchId), game };
  }

  if (!isContractConfigured(chain)) {
    const creatorId = users[0]?.id ?? orderedEntries[0]?.id;
    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: creatorId,
      next_player_id: creatorId,
      number_of_players: N,
      status: "PENDING",
      is_minipay: false,
      is_ai: false,
      chain: tournament.chain,
      contract_game_id: null,
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
    await bindTournamentEntryAgentsToGame(game.id, orderedEntries);
    const specTok = match.spectator_token || newSpectatorToken();
    await TournamentMatch.update(matchId, {
      game_id: game.id,
      status: "AWAITING_PLAYERS",
      spectator_token: specTok,
    });
    return { match: await TournamentMatch.findById(matchId), game };
  }

  if (!canBackendJoin) {
    const firstPwd = users.findIndex((u) => u?.password_hash);
    if (firstPwd >= 0) {
      const u0 = users[firstPwd];
      const auth0 = await resolveTournamentOnChainPlayer(u0, chain);
      let result;
      try {
        result = await createGameByBackend(
          auth0.address,
          auth0.password_hash,
          auth0.username,
          "PRIVATE",
          symbols[firstPwd],
          N,
          code,
          DEFAULT_STARTING_CASH,
          0n,
          chain
        );
      } catch (err) {
        logger.error({ err: err?.message, tournamentId, matchId }, "Tournament createGameByBackend (multi partial) failed");
        throw err;
      }
      const contractGameId = result?.gameId;
      if (!contractGameId) throw new Error("Contract did not return game ID");
      const game = await Game.create({
        code,
        mode: "PRIVATE",
        creator_id: u0.id,
        next_player_id: u0.id,
        number_of_players: N,
        status: "PENDING",
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
        user_id: u0.id,
        address: auth0.address,
        balance: DEFAULT_STARTING_CASH,
        position: 0,
        turn_order: 1,
        symbol: symbols[firstPwd],
        chance_jail_card: false,
        community_chest_jail_card: false,
      });
      for (let i = 0; i < N; i++) {
        if (i === firstPwd) continue;
        const u = users[i];
        if (!u?.password_hash) continue;
        try {
          const authI = await resolveTournamentOnChainPlayer(u, chain);
          await joinGameByBackend(
            authI.address,
            authI.password_hash,
            contractGameId,
            authI.username,
            symbols[i],
            code,
            chain
          );
          await GamePlayer.create({
            game_id: game.id,
            user_id: u.id,
            address: authI.address,
            balance: DEFAULT_STARTING_CASH,
            position: 0,
            turn_order: i + 1,
            symbol: symbols[i],
            chance_jail_card: false,
            community_chest_jail_card: false,
          });
        } catch (err) {
          logger.warn({ err: err?.message, tournamentId, matchId, userId: u.id }, "Tournament multi join skipped");
        }
      }
      await bindTournamentEntryAgentsToGame(game.id, orderedEntries);
      const specTok = match.spectator_token || newSpectatorToken();
      await TournamentMatch.update(matchId, {
        game_id: game.id,
        contract_game_id: String(contractGameId),
        status: "AWAITING_PLAYERS",
        spectator_token: specTok,
      });
      return { match: await TournamentMatch.findById(matchId), game };
    }
    const creatorId = users[0]?.id ?? orderedEntries[0]?.id;
    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: creatorId,
      next_player_id: creatorId,
      number_of_players: N,
      status: "PENDING",
      is_minipay: false,
      is_ai: false,
      chain: tournament.chain,
      contract_game_id: null,
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
    await bindTournamentEntryAgentsToGame(game.id, orderedEntries);
    const specTok = match.spectator_token || newSpectatorToken();
    await TournamentMatch.update(matchId, {
      game_id: game.id,
      status: "AWAITING_PLAYERS",
      spectator_token: specTok,
    });
    return { match: await TournamentMatch.findById(matchId), game };
  }

  const auths = await Promise.all(users.map((u) => resolveTournamentOnChainPlayer(u, chain)));

  let result;
  try {
    result = await createGameByBackend(
      auths[0].address,
      auths[0].password_hash,
      auths[0].username,
      "PRIVATE",
      symbols[0],
      N,
      code,
      DEFAULT_STARTING_CASH,
      0n,
      chain
    );
  } catch (err) {
    logger.error({ err: err?.message, tournamentId, matchId }, "Tournament createGameByBackend (multi) failed");
    throw err;
  }
  const contractGameId = result?.gameId;
  if (!contractGameId) throw new Error("Contract did not return game ID");

  for (let i = 1; i < N; i++) {
    try {
      await joinGameByBackend(
        auths[i].address,
        auths[i].password_hash,
        contractGameId,
        auths[i].username,
        symbols[i],
        code,
        chain
      );
    } catch (err) {
      logger.error({ err: err?.message, tournamentId, matchId }, "Tournament joinGameByBackend (multi) failed");
      throw err;
    }
  }

  const now = new Date();
  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: users[0].id,
    next_player_id: users[0].id,
    number_of_players: N,
    status: "PENDING",
    is_minipay: false,
    is_ai: false,
    chain: tournament.chain,
    contract_game_id: String(contractGameId),
    ready_window_opens_at: now,
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
  for (let i = 0; i < N; i++) {
    await GamePlayer.create({
      game_id: game.id,
      user_id: users[i].id,
      address: auths[i].address,
      balance: DEFAULT_STARTING_CASH,
      position: 0,
      turn_order: i + 1,
      symbol: symbols[i],
      chance_jail_card: false,
      community_chest_jail_card: false,
    });
  }

  await bindTournamentEntryAgentsToGame(game.id, orderedEntries);
  const specTok = match.spectator_token || newSpectatorToken();
  await TournamentMatch.update(matchId, {
    game_id: game.id,
    contract_game_id: String(contractGameId),
    status: "IN_PROGRESS",
    spectator_token: specTok,
  });

  return { match: await TournamentMatch.findById(matchId), game };
}

/**
 * Creator convenience: create game for a single match and return redirect URL.
 * Used when "Create game" is clicked on a specific bracket match.
 */
export async function createMatchGameForCreator(tournamentId, matchId, creatorUserId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (Number(tournament.creator_id) !== Number(creatorUserId)) {
    throw new Error("Only the tournament creator can create games for matches");
  }
  const match = await TournamentMatch.findById(matchId);
  if (!match || match.tournament_id !== Number(tournamentId)) throw new Error("Match not found");
  if (match.status === "BYE") throw new Error("Cannot create game for BYE match");
  if (match.status === "COMPLETED") throw new Error("Match already completed");

  const vis = String(tournament.visibility || "").toUpperCase();
  const isAgentMatch = vis === "BOT_SELECTION" || Boolean(Number(tournament.is_agent_only ?? 0));

  if (match.game_id) {
    const game = await Game.findById(match.game_id);
    let url = tournamentBoardRedirectUrl(game?.code);
    if (isAgentMatch && url) url += (url.includes("?") ? "&" : "?") + "spectate=1";
    return { code: game?.code, redirect_url: url, already_exists: true, spectate: isAgentMatch };
  }

  const result = await createMatchGame(tournamentId, matchId);
  if (!result?.game) throw new Error("Failed to create game");
  const round = await TournamentRound.findByTournamentAndIndex(tournamentId, match.round_index);
  if (round) await TournamentRound.update(round.id, { status: "IN_PROGRESS", started_at: db.fn.now() });
  if (tournament.status === "BRACKET_LOCKED") await Tournament.update(tournamentId, { status: "IN_PROGRESS" });

  let url = tournamentBoardRedirectUrl(result.game.code);
  if (isAgentMatch && url) url += (url.includes("?") ? "&" : "?") + "spectate=1";
  return {
    code: result.game.code,
    redirect_url: url,
    spectate: isAgentMatch,
  };
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
    }
  }

  const matchesAfterBye = await TournamentMatch.findByTournamentAndRound(tournamentId, Number(roundIndex));
  const matchIdsToStart = matchesAfterBye
    .filter((m) => m.status !== "BYE" && m.status !== "COMPLETED" && !m.game_id)
    .filter((m) => getMatchEntryIds(m).length >= 2)
    .map((m) => m.id);

  const settled = await Promise.allSettled(matchIdsToStart.map((matchId) => createMatchGame(tournamentId, matchId)));
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      logger.error({ err: r.reason?.message, matchId: matchIdsToStart[i] }, "startRound createMatchGame failed");
    }
  });

  const round = await TournamentRound.findByTournamentAndIndex(tournamentId, roundIndex);
  if (round) await TournamentRound.update(round.id, { status: "IN_PROGRESS", started_at: db.fn.now() });

  if (tournament.status === "BRACKET_LOCKED") await Tournament.update(tournamentId, { status: "IN_PROGRESS" });

  return { started: matches.length };
}

async function maybeCompleteGroupEliminationTournament(tournamentId, winnerEntry) {
  const t = await Tournament.findById(tournamentId);
  if (!t) return;
  await Tournament.update(tournamentId, { status: "COMPLETED" });
  try {
    const winnerAgentRow = await db("tournament_entry_agents")
      .where({ tournament_entry_id: winnerEntry.id })
      .select("user_agent_id")
      .first();
    const winnerAgentId = Number(winnerAgentRow?.user_agent_id || 0);
    if (winnerAgentId) {
      awardActivityXpByAgentId(winnerAgentId, ACTIVITY_XP.TOURNAMENT_CHAMPION, "tournament_champion").catch(() => {});
    }
  } catch (err) {
    logger.warn({ err: err?.message, tournamentId }, "Tournament champion XP award failed");
  }
  if (t.prize_source !== "NO_POOL" && (Number(t.prize_pool_wei) > 0 || Number(t.entry_fee_wei) > 0)) {
    try {
      const { executePayouts } = await import("./tournamentPayoutService.js");
      await executePayouts(tournamentId);
    } catch (err) {
      logger.error({ err: err?.message, tournamentId }, "Tournament executePayouts failed");
    }
  }
}

async function handleGroupEliminationAfterMatchResolved(match, _winnerEntry) {
  const roundMatches = await TournamentMatch.findByTournamentAndRound(match.tournament_id, match.round_index);
  const allDone = roundMatches.every((m) => m.status === "COMPLETED" || m.status === "BYE");
  if (!allDone) {
    return { tournamentCompleted: false };
  }

  const roundRow = await TournamentRound.findByTournamentAndIndex(match.tournament_id, match.round_index);
  if (roundRow) await TournamentRound.update(roundRow.id, { status: "COMPLETED", completed_at: db.fn.now() });

  const advancerIds = new Set();
  for (const m of roundMatches) {
    if (m.status === "COMPLETED" || m.status === "BYE") {
      for (const id of parseAdvancingEntryIdsFromMatchRow(m)) {
        advancerIds.add(id);
      }
    }
  }
  const winners = [...advancerIds];
  if (winners.length === 1) {
    const champion = await TournamentEntry.findById(winners[0]);
    if (champion) await maybeCompleteGroupEliminationTournament(match.tournament_id, champion);
    return { tournamentCompleted: true };
  }

  const winnerEntries = await Promise.all(winners.map((id) => TournamentEntry.findById(id)));
  const nextRoundIndex = match.round_index + 1;
  const t = await Tournament.findById(match.tournament_id);
  await bracketEngine.fillGroupEliminationRound(
    match.tournament_id,
    nextRoundIndex,
    winnerEntries.filter(Boolean),
    { scheduled_start_at: null, isAgentOnly: Boolean(t?.is_agent_only) }
  );
  return { tournamentCompleted: false };
}

/**
 * Set each tournament_round to COMPLETED when every match in that round is COMPLETED or BYE.
 * Improves lobby accuracy after each result (round badges / “next round” clarity).
 */
async function markSingleEliminationRoundsCompletedIfAllMatchesDone(tournamentId) {
  const rounds = await TournamentRound.findByTournament(tournamentId);
  const matches = await TournamentMatch.findByTournament(tournamentId);
  if (!rounds?.length || !matches?.length) return;
  for (const r of rounds) {
    const rm = matches.filter((m) => Number(m.round_index) === Number(r.round_index));
    if (!rm.length) continue;
    const allDone = rm.every((m) => m.status === "COMPLETED" || m.status === "BYE");
    if (allDone && String(r.status) !== "COMPLETED") {
      await TournamentRound.update(r.id, { status: "COMPLETED", completed_at: db.fn.now() });
    }
  }
}

/**
 * Called when a game finishes. Updates match winner, advances bracket, optionally creates next round game.
 */
export async function onGameFinished(gameId) {
  const match = await TournamentMatch.findByGameId(gameId);
  if (!match) return null;

  const game = await Game.findById(gameId);
  if (!game || game.status !== "FINISHED") return null;

  const stake = await db("arena_match_stakes").where({ game_id: gameId }).first();
  const tournamentRowEarly = await Tournament.findById(match.tournament_id);
  if (stake && match.status === "COMPLETED" && tournamentRowEarly?.status === "COMPLETED") {
    const nPayRow = await db("tournament_payouts").where({ tournament_id: match.tournament_id }).count("* as c").first();
    const nPay = Number(nPayRow?.c ?? 0);
    if (match.winner_entry_id == null) {
      if (nPay === 0) {
        try {
          const { executeDrawRefunds } = await import("./tournamentPayoutService.js");
          await executeDrawRefunds(match.tournament_id);
          await db("arena_match_stakes").where({ id: stake.id }).update({
            status: "PAID_OUT",
            paid_out_at: db.fn.now(),
            updated_at: db.fn.now(),
          });
        } catch (err) {
          logger.error(
            { err: err?.message, gameId, tournamentId: match.tournament_id },
            "onGameFinished: retry executeDrawRefunds for staked arena draw"
          );
        }
      }
      logger.info({ gameId, matchId: match.id }, "onGameFinished: staked arena draw — skipping net-worth winner bracket update");
      return { matchId: match.id, winnerEntryId: null, tournamentCompleted: true, stakedArenaDraw: true };
    }
    if (match.winner_entry_id != null && nPay > 0) {
      logger.info({ gameId, matchId: match.id }, "onGameFinished: staked arena already settled (winner); skipping duplicate");
      return {
        matchId: match.id,
        winnerEntryId: match.winner_entry_id,
        tournamentCompleted: true,
        stakedArenaSettled: true,
      };
    }
  }

  const entries = await TournamentEntry.findByTournament(match.tournament_id, { withUser: true });
  const formatEarly = tournamentRowEarly?.format || "SINGLE_ELIMINATION";
  const winnerUserId = game.winner_id;
  const gt = String(game.game_type || "");
  let winnerEntry = null;
  let advancingEntryIdsForDb = null;

  if (String(formatEarly).toUpperCase() === "GROUP_ELIMINATION") {
    const comp = await computeGroupEliminationAdvancingAndWinner(game, match, entries);
    if (comp) {
      winnerEntry = comp.winnerEntry;
      advancingEntryIdsForDb = comp.advancingEntryIds;
    }
  }

  if (!winnerEntry) {
    const nParts = getMatchEntryIds(match).length;
    if (String(formatEarly).toUpperCase() === "GROUP_ELIMINATION" && nParts >= 3) {
      logger.error(
        { gameId, tournamentId: match.tournament_id, matchId: match.id },
        "GROUP_ELIMINATION: could not resolve winner/advancers from placements"
      );
      return null;
    }

    if (gt === "TOURNAMENT_AGENT_VS_AGENT") {
      const wgp = await db("game_players")
        .where({ game_id: gameId, user_id: winnerUserId })
        .select("turn_order")
        .first();
      const ord = Number(wgp?.turn_order || 0);
      const winEntryId = ord === 1 ? match.slot_a_entry_id : ord === 2 ? match.slot_b_entry_id : null;
      if (!winEntryId) {
        logger.warn(
          { gameId, winnerUserId, ord, matchId: match.id },
          "Tournament agent game: could not map winning seat to bracket entry"
        );
        return null;
      }
      winnerEntry = entries.find((e) => Number(e.id) === Number(winEntryId)) || (await TournamentEntry.findById(winEntryId));
    } else {
      winnerEntry = entries.find((e) => e.user_id === winnerUserId);
    }
  }

  if (!winnerEntry) {
    logger.warn({ gameId, winnerUserId, tournamentId: match.tournament_id, gameType: gt }, "Tournament: winner not in entries");
    return null;
  }

  const entryIdsXp = getMatchEntryIds(match);

  let finishStandingsRows = null;
  try {
    finishStandingsRows = await buildFinishStandingsForMatch(game, match, entries, winnerEntry);
  } catch (err) {
    logger.warn(
      { err: err?.message, gameId, matchId: match.id },
      "buildFinishStandingsForMatch failed; bracket will derive standings if possible"
    );
  }

  const matchUpdate = { winner_entry_id: winnerEntry.id, status: "COMPLETED" };
  if (game?.code != null && String(game.code).trim()) {
    matchUpdate.game_code = String(game.code).trim();
  }
  if (finishStandingsRows?.length) {
    matchUpdate.finish_standings = finishStandingsRows;
  }
  if (advancingEntryIdsForDb != null && advancingEntryIdsForDb.length > 0) {
    matchUpdate.advancing_entry_ids = advancingEntryIdsForDb;
  }
  await TournamentMatch.update(match.id, matchUpdate);

  try {
    const entryAgentRows = await db("tournament_entry_agents")
      .whereIn("tournament_entry_id", entryIdsXp.length ? entryIdsXp : [match.slot_a_entry_id, match.slot_b_entry_id].filter(Boolean))
      .select("tournament_entry_id", "user_agent_id");
    const byEntry = new Map(entryAgentRows.map((r) => [Number(r.tournament_entry_id), Number(r.user_agent_id)]));
    const xpEntryIds = entryIdsXp.length ? entryIdsXp : [match.slot_a_entry_id, match.slot_b_entry_id].filter(Boolean);
    for (const eid of xpEntryIds) {
      const aid = byEntry.get(Number(eid));
      if (aid && Number(eid) !== Number(winnerEntry.id)) {
        awardActivityXpByAgentId(aid, ACTIVITY_XP.TOURNAMENT_MATCH_PLAYED, "tournament_match_played").catch(() => {});
      }
    }
    const winnerAgentId = byEntry.get(Number(winnerEntry.id));
    if (winnerAgentId) {
      awardActivityXpByAgentId(winnerAgentId, ACTIVITY_XP.TOURNAMENT_MATCH_WON, "tournament_match_won").catch(() => {});
    }
  } catch (err) {
    logger.warn({ err: err?.message, gameId }, "Tournament XP awards failed");
  }

  const tournament = await Tournament.findById(match.tournament_id);
  const format = tournament?.format || "SINGLE_ELIMINATION";

  if (format === "GROUP_ELIMINATION") {
    const grp = await handleGroupEliminationAfterMatchResolved(match, winnerEntry);
    return { matchId: match.id, winnerEntryId: winnerEntry.id, tournamentCompleted: !!grp?.tournamentCompleted };
  }

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
      const nextRound = await TournamentRound.findByTournamentAndIndex(match.tournament_id, refreshed.round_index);
      const scheduledAtMs = nextRound?.scheduled_start_at
        ? new Date(nextRound.scheduled_start_at).getTime()
        : null;
      const scheduleBlocksAutoCreate =
        scheduledAtMs != null &&
        !Number.isNaN(scheduledAtMs) &&
        Date.now() < scheduledAtMs;
      if (
        refreshed.slot_a_entry_id &&
        refreshed.slot_b_entry_id &&
        refreshed.status === "PENDING" &&
        !refreshed.game_id &&
        !scheduleBlocksAutoCreate
      ) {
        try {
          await createMatchGame(match.tournament_id, refreshed.id);
        } catch (err) {
          logger.error({ err: err?.message, matchId: refreshed.id }, "onGameFinished createMatchGame failed");
        }
      }
    }
  }

  try {
    await markSingleEliminationRoundsCompletedIfAllMatchesDone(match.tournament_id);
  } catch (err) {
    logger.warn({ err: err?.message, tournamentId: match.tournament_id }, "markSingleEliminationRoundsCompletedIfAllMatchesDone failed");
  }

  const allMatches = await TournamentMatch.findByTournament(match.tournament_id);
  const finalMatch = allMatches.find((m) => m.round_index >= 0 && m.match_index === 0 && m.round_index === Math.max(...allMatches.map((x) => x.round_index)));
  const finalCompleted = finalMatch && (await TournamentMatch.findById(finalMatch.id))?.status === "COMPLETED";
  if (finalCompleted) {
    await Tournament.update(match.tournament_id, { status: "COMPLETED" });
    try {
      const winnerAgentRow = await db("tournament_entry_agents")
        .where({ tournament_entry_id: winnerEntry.id })
        .select("user_agent_id")
        .first();
      const winnerAgentId = Number(winnerAgentRow?.user_agent_id || 0);
      if (winnerAgentId) {
        awardActivityXpByAgentId(winnerAgentId, ACTIVITY_XP.TOURNAMENT_CHAMPION, "tournament_champion").catch(() => {});
      }
    } catch (err) {
      logger.warn({ err: err?.message, gameId }, "Tournament champion XP award failed");
    }
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
 * Small GROUP_ELIMINATION events (≤4 entrants) are often a single multi-player table.
 * Final standings must follow game placements (1st–4th), not only slot_a/slot_b winner+loser.
 * @returns {Promise<number[]|null>} entry ids in finish order (best first)
 */
async function trySinglePodPlacementOrderFromGame(tournament, entries, matches) {
  if (!tournament || !entries?.length || !matches?.length) return null;
  if (String(tournament.format || "").toUpperCase() !== "GROUP_ELIMINATION") return null;
  const nEnt = entries.length;
  if (nEnt < 2 || nEnt > 4) return null;

  const completedGameMatches = matches.filter(
    (m) => String(m.status || "").toUpperCase() === "COMPLETED" && m.game_id != null
  );
  if (completedGameMatches.length !== 1) return null;

  const m = completedGameMatches[0];
  let participantIds = parseParticipantEntryIds(m);
  if (!participantIds.length) participantIds = getMatchEntryIds(m);
  participantIds = [...new Set(participantIds.map(Number))].filter((id) => Number.isInteger(id) && id > 0);
  const entryIdSet = new Set(entries.map((e) => Number(e.id)));
  if (participantIds.length !== nEnt) return null;
  if (!participantIds.every((id) => entryIdSet.has(id))) return null;

  const game = await Game.findById(m.game_id);
  if (!game) return null;

  let placementsObj = {};
  if (game.placements != null) {
    try {
      placementsObj = typeof game.placements === "string" ? JSON.parse(game.placements) : game.placements;
    } catch {
      placementsObj = {};
    }
  }

  const entryById = new Map(entries.map((e) => [Number(e.id), e]));
  const placementForUser = (uid) => {
    if (uid == null) return 999;
    const u = Number(uid);
    if (Number.isFinite(u) && Object.prototype.hasOwnProperty.call(placementsObj, u)) return Number(placementsObj[u]);
    if (Object.prototype.hasOwnProperty.call(placementsObj, String(u))) return Number(placementsObj[String(u)]);
    return 999;
  };

  const gtUpper = String(game.game_type || "").toUpperCase();
  const entrySeatUid =
    gtUpper === "TOURNAMENT_AGENT_VS_AGENT"
      ? await mapTournamentEntryIdsToSeatUserIds(game.id, participantIds, participantIds, true)
      : new Map();
  const uidForPlacement = (eid) => {
    const seat = entrySeatUid.get(Number(eid));
    if (seat != null) return seat;
    const entry = entryById.get(Number(eid));
    return entry?.user_id != null ? Number(entry.user_id) : null;
  };

  const buildRanked = () =>
    participantIds
      .map((eid) => ({
        eid: Number(eid),
        pos: placementForUser(uidForPlacement(eid)),
      }))
      .sort((a, b) => a.pos - b.pos);

  let ranked = buildRanked();
  let hasGood = ranked.length === nEnt && ranked[0].pos < 900;

  if (!hasGood) {
    const nw = await computeNetWorthResultForGameId(game.id);
    if (nw?.net_worths?.length) {
      const allowedUids = new Set(
        participantIds
          .map((eid) => entryById.get(Number(eid))?.user_id)
          .filter((uid) => uid != null)
          .map((uid) => Number(uid))
      );
      const subset = nw.net_worths.filter((row) => allowedUids.has(Number(row.user_id)));
      const source = subset.length >= nEnt ? subset : nw.net_worths.length >= nEnt ? nw.net_worths : null;
      if (source) {
        placementsObj = placementsFromNetWorths(source);
        ranked = buildRanked();
        hasGood = ranked.length === nEnt && ranked[0].pos < 900;
      }
    }
  }

  if (hasGood) return ranked.map((r) => r.eid);

  const w = m.winner_entry_id != null ? Number(m.winner_entry_id) : null;
  if (w && entryIdSet.has(w)) {
    const rest = participantIds.filter((id) => Number(id) !== w);
    return [w, ...rest];
  }
  return null;
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
    const lost = matches.find((m) => {
      const inMatch =
        parseParticipantEntryIds(m).includes(e.id) || m.slot_a_entry_id === e.id || m.slot_b_entry_id === e.id;
      return inMatch && m.winner_entry_id !== e.id && m.status === "COMPLETED";
    });
    entryIdToRoundEliminated[e.id] = lost != null ? lost.round_index : null;
  }

  const placementOrder = [];
  let usedPodStandings = false;
  if (tournament.status === "COMPLETED" && phase === "final") {
    const podOrder = await trySinglePodPlacementOrderFromGame(tournament, entries, matches);
    if (podOrder != null && podOrder.length >= 2) {
      placementOrder.push(...podOrder);
      usedPodStandings = true;
    } else {
      const finalMatch = matches.filter((m) => m.round_index === rounds[rounds.length - 1])[0];
      if (finalMatch?.winner_entry_id) placementOrder.push(finalMatch.winner_entry_id);
      if (finalMatch) {
        const loserId =
          finalMatch.slot_a_entry_id === finalMatch.winner_entry_id
            ? finalMatch.slot_b_entry_id
            : finalMatch.slot_a_entry_id;
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
  }

  let payoutByEntryId = {};
  if (tournament.status === "COMPLETED" && phase === "final") {
    try {
      const { computePayouts } = await import("./tournamentPayoutService.js");
      const payouts = await computePayouts(tournamentId);
      payoutByEntryId = Object.fromEntries((payouts || []).map((p) => [p.entry_id, String(p.amount_wei)]));
    } catch (err) {
      logger.warn({ err: err?.message, tournamentId }, "getLeaderboard computePayouts failed");
    }
  }

  const rows = entries.map((e) => {
    const idx = placementOrder.indexOf(Number(e.id));
    const placement =
      tournament.status === "COMPLETED" && phase === "final" && idx >= 0 ? idx + 1 : null;
    const displayName = (e.agent_name && String(e.agent_name).trim()) || e.username || e.user_address;
    const elimRound = usedPodStandings ? null : entryIdToRoundEliminated[e.id];
    return {
      entry_id: e.id,
      user_id: e.user_id,
      username: displayName,
      agent_name: e.agent_name ?? null,
      address: e.address,
      match_wins: entryIdToWins[e.id] || 0,
      round_eliminated: elimRound,
      eliminated_in_round: elimRound ?? null,
      placement,
      rank: placement ?? null,
      is_winner: placement === 1,
      payout_wei: payoutByEntryId[e.id] ?? null,
    };
  });

  if (tournament.status === "COMPLETED" && phase === "final") {
    rows.sort((a, b) => (a.placement || 999) - (b.placement || 999));
    rows.forEach((r, i) => {
      r.rank = r.placement ?? i + 1;
    });
  } else {
    rows.sort((a, b) => (b.match_wins || 0) - (a.match_wins || 0));
    rows.forEach((r, i) => {
      r.rank = i + 1;
    });
  }

  return { tournament_id: tournamentId, status: tournament.status, phase, entries: rows };
}

/**
 * Resolve forfeit when 5-min window has closed: 1 request = that entry wins; 0 = both forfeit (no winner).
 */
async function resolveForfeitForMatch(matchId) {
  const match = await TournamentMatch.findById(matchId);
  if (!match || match.game_id || match.status === "COMPLETED" || match.status === "BYE") return null;

  const round = await TournamentRound.findByTournamentAndIndex(match.tournament_id, match.round_index);
  if (!round?.scheduled_start_at) return null;
  const scheduledAt = new Date(round.scheduled_start_at);
  const windowEnd = new Date(scheduledAt.getTime() + START_WINDOW_MINUTES * 60 * 1000);
  if (new Date() <= windowEnd) return null;

  const rows = await db("tournament_match_start_requests")
    .where({ match_id: matchId })
    .orderBy("requested_at", "asc");
  const requestedInWindow = rows.filter((r) => {
    const t = new Date(r.requested_at);
    return t >= scheduledAt && t <= windowEnd;
  });
  const uniqueEntryIds = [...new Set(requestedInWindow.map((r) => r.entry_id))];

  if (uniqueEntryIds.length === 1) {
    const winnerEntryId = uniqueEntryIds[0];
    await TournamentMatch.update(matchId, { winner_entry_id: winnerEntryId, status: "COMPLETED" });
    logger.info({ matchId, winnerEntryId }, "Tournament match forfeit: one player on time");
    const matchAfter = await TournamentMatch.findById(matchId);
    const t = await Tournament.findById(matchAfter.tournament_id);
    const fmt = t?.format || "SINGLE_ELIMINATION";
    const winnerEntry = await TournamentEntry.findById(winnerEntryId);
    if (fmt === "GROUP_ELIMINATION" && winnerEntry) {
      await handleGroupEliminationAfterMatchResolved(matchAfter, winnerEntry);
    } else {
      const nextRoundMatches = await TournamentMatch.findByTournamentAndRound(matchAfter.tournament_id, matchAfter.round_index + 1);
      for (const next of nextRoundMatches || []) {
        if (next.slot_a_prev_match_id === matchId) await TournamentMatch.update(next.id, { slot_a_entry_id: winnerEntryId });
        if (next.slot_b_prev_match_id === matchId) await TournamentMatch.update(next.id, { slot_b_entry_id: winnerEntryId });
      }
    }
    return { forfeit_win: true, winner_entry_id: winnerEntryId };
  }
  if (uniqueEntryIds.length === 0) {
    await TournamentMatch.update(matchId, { status: "COMPLETED" });
    logger.info({ matchId }, "Tournament match: no players on time, match closed");
    return { forfeit_win: false };
  }
  return null;
}

/**
 * Request to start a match ("Start now"). Only valid when current time is within round's 5-min window.
 * If 2+ players have requested in window, creates game and returns redirect. If 1 after window closes, resolves forfeit.
 * @returns {{ game_id, code, redirect_url } | { waiting: true } | { forfeit_win: true } | { forfeit_win: false } | { error: string }}
 */
export async function requestMatchStart(tournamentId, matchId, userId, preferredSymbol = null) {
  const match = await TournamentMatch.findById(matchId);
  if (!match || match.tournament_id !== Number(tournamentId)) throw new Error("Match not found");
  if (match.status === "BYE" || match.status === "COMPLETED") throw new Error("Match not available");
  if (match.game_id) {
    const game = await Game.findById(match.game_id);
    const code = game?.code;
    return {
      game_id: match.game_id,
      code,
      redirect_url: tournamentBoardRedirectUrl(code),
    };
  }

  const entryIds = getMatchEntryIds(match);
  const numericEntryIds = entryIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const userEntries = await db("tournament_entries")
    .where({ tournament_id: Number(tournamentId), user_id: Number(userId) })
    .select("id");
  const entryRow = (userEntries || []).find((e) => numericEntryIds.includes(Number(e.id)));
  const entry = entryRow ? await TournamentEntry.findById(entryRow.id) : null;
  if (!entry || !numericEntryIds.includes(Number(entry.id))) throw new Error("You are not in this match");

  const round = await TournamentRound.findByTournamentAndIndex(tournamentId, match.round_index);
  if (!round) throw new Error("Round not found");
  const scheduledAt = round.scheduled_start_at ? new Date(round.scheduled_start_at) : null;
  const windowEnd = scheduledAt ? new Date(scheduledAt.getTime() + START_WINDOW_MINUTES * 60 * 1000) : null;
  const now = new Date();

  if (scheduledAt && now < scheduledAt) throw new Error("Start window has not opened yet");
  if (windowEnd && now > windowEnd) {
    const resolved = await resolveForfeitForMatch(matchId);
    if (resolved?.forfeit_win) return { forfeit_win: true };
    if (resolved && !resolved.forfeit_win) return { forfeit_win: false };
    throw new Error("Start window has closed");
  }

  const validSymbol =
    preferredSymbol && typeof preferredSymbol === "string" && TOURNAMENT_SYMBOLS.includes(preferredSymbol.toLowerCase())
      ? preferredSymbol.toLowerCase()
      : null;

  const existing = await db("tournament_match_start_requests")
    .where({ match_id: matchId, entry_id: entry.id })
    .first();
  const requestRow = {
    match_id: matchId,
    entry_id: entry.id,
    requested_at: now,
  };
  if (validSymbol != null) requestRow.preferred_symbol = validSymbol;

  if (existing) {
    const updatePayload = { requested_at: now, updated_at: db.fn.now() };
    if (validSymbol != null) updatePayload.preferred_symbol = validSymbol;
    await db("tournament_match_start_requests")
      .where({ match_id: matchId, entry_id: entry.id })
      .update(updatePayload);
  } else {
    await db("tournament_match_start_requests").insert(requestRow);
  }

  const requests = await db("tournament_match_start_requests").where({ match_id: matchId });
  const inWindow = scheduledAt && windowEnd
    ? requests.filter((r) => { const t = new Date(r.requested_at); return t >= scheduledAt && t <= windowEnd; })
    : requests;
  const uniqueInWindow = [...new Set(inWindow.map((r) => r.entry_id))];

  const requiredAck = entryIds.length >= 2 ? entryIds.length : 2;
  if (uniqueInWindow.length < requiredAck) {
    return { waiting: true };
  }

  try {
    await createMatchGame(tournamentId, matchId);
    const updated = await TournamentMatch.findById(matchId);
    const game = updated?.game_id ? await Game.findById(updated.game_id) : null;
    return {
      game_id: updated.game_id,
      code: game?.code,
      redirect_url: tournamentBoardRedirectUrl(game?.code),
    };
  } catch (err) {
    logger.error({ err: err?.message, matchId }, "requestMatchStart createMatchGame failed");
    throw err;
  }
}

/** Same “final” match as computePayouts: highest round_index, match_index 0 in that round. */
function pickFinalMatch(matches) {
  if (!matches?.length) return null;
  const rounds = [...new Set(matches.map((m) => Number(m.round_index)))].sort((a, b) => b - a);
  const ri = rounds[0];
  const inRound = matches
    .filter((m) => Number(m.round_index) === ri)
    .sort((a, b) => Number(a.match_index) - Number(b.match_index));
  return inRound.find((m) => Number(m.match_index) === 0) ?? inRound[0] ?? null;
}

async function maybeMarkArenaStakePaidOutAfterPayouts(gameId, tournamentId) {
  if (!gameId) return;
  const nRow = await db("tournament_payouts").where({ tournament_id: tournamentId }).count("* as c").first();
  if (Number(nRow?.c ?? 0) === 0) return;
  const stake = await db("arena_match_stakes").where("game_id", gameId).where("status", "COLLECTED").first();
  if (!stake) return;
  await db("arena_match_stakes").where("id", stake.id).update({
    status: "PAID_OUT",
    paid_out_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
}

/**
 * Admin: mark tournament completed, set final match winner (or draw refunds), run payouts.
 * Secured by SHOP_ADMIN_SECRET on the route — not invite-gated.
 * @param {number} tournamentId
 * @param {{ mode?: string, winner_entry_id?: number, winner_user_id?: number, payouts_only?: boolean }} opts
 */
export async function adminResolveTournament(tournamentId, opts = {}) {
  const id = Number(tournamentId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid tournament id");

  const modeRaw = opts.mode != null ? String(opts.mode) : "payout";
  const drawMode = modeRaw.toLowerCase() === "draw";
  const payoutsOnly = Boolean(opts.payouts_only);

  const tournament = await Tournament.findById(id);
  if (!tournament) throw new Error("Tournament not found");

  const { executePayouts, executeDrawRefunds } = await import("./tournamentPayoutService.js");

  if (payoutsOnly) {
    if (String(tournament.status || "") !== "COMPLETED") {
      throw new Error("Tournament is not completed; run full resolve first");
    }
    const payout = await executePayouts(id);
    return { payouts_only: true, payout };
  }

  if (String(tournament.status || "") === "COMPLETED") {
    const payout = await executePayouts(id);
    return { already_completed: true, payout };
  }

  const matches = await TournamentMatch.findByTournament(id);
  if (!matches?.length) throw new Error("No bracket matches");

  const entries = await TournamentEntry.findByTournament(id);
  const incomplete = matches.filter((m) => !["COMPLETED", "BYE"].includes(String(m.status || "")));
  if (incomplete.length > 1) {
    throw new Error("Multiple incomplete matches; cannot admin-resolve in one step");
  }

  const finalMatch = pickFinalMatch(matches);
  const targetMatch = incomplete.length === 1 ? incomplete[0] : finalMatch;
  if (!targetMatch) throw new Error("No match to resolve");

  if (drawMode) {
    if (String(tournament.prize_source || "") !== "ENTRY_FEE_POOL") {
      throw new Error("Draw refunds only apply to entry-fee pool tournaments");
    }
    await TournamentMatch.update(targetMatch.id, { status: "COMPLETED" });
    await Tournament.update(id, { status: "COMPLETED" });
    const drawResult = await executeDrawRefunds(id);
    await maybeMarkArenaStakePaidOutAfterPayouts(targetMatch.game_id, id);
    logger.info({ tournamentId: id, mode: "draw" }, "adminResolveTournament: draw");
    return { mode: "draw", draw: drawResult };
  }

  let winId =
    opts.winner_entry_id != null && opts.winner_entry_id !== ""
      ? Number(opts.winner_entry_id)
      : null;
  if (!winId && opts.winner_user_id != null && opts.winner_user_id !== "") {
    const e = entries.find((en) => Number(en.user_id) === Number(opts.winner_user_id));
    winId = e?.id != null ? Number(e.id) : null;
  }
  if (!winId && targetMatch.winner_entry_id != null) {
    winId = Number(targetMatch.winner_entry_id);
  }
  if (!winId && targetMatch.game_id) {
    const game = await Game.findById(targetMatch.game_id);
    if (game && String(game.status || "") === "FINISHED" && game.winner_id != null) {
      const e = entries.find((en) => Number(en.user_id) === Number(game.winner_id));
      winId = e?.id != null ? Number(e.id) : null;
    }
  }
  if (!winId) {
    throw new Error("Provide winner_entry_id or winner_user_id, or finish the linked game with a winner");
  }

  const slotIds = getMatchEntryIds(targetMatch).map(Number);
  if (slotIds.length >= 2 && !slotIds.includes(Number(winId))) {
    throw new Error("Winner entry is not a participant in the resolved match");
  }

  await TournamentMatch.update(targetMatch.id, {
    winner_entry_id: winId,
    status: "COMPLETED",
  });
  await Tournament.update(id, { status: "COMPLETED" });

  let payout = { done: 0, failed: 0, message: "No pool", skipped: true };
  if (String(tournament.prize_source || "") !== "NO_POOL") {
    payout = await executePayouts(id);
  }
  await maybeMarkArenaStakePaidOutAfterPayouts(targetMatch.game_id, id);
  logger.info({ tournamentId: id, winner_entry_id: winId }, "adminResolveTournament: payout");
  return { mode: "payout", winner_entry_id: winId, payout };
}
