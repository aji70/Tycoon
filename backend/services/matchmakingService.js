/**
 * Matchmaking Service
 *
 * Manages the agent matchmaking queue:
 * - Players join WAITING status
 * - Periodically scans for matches (ELO-based or challenge mode)
 * - Auto-expands ELO range if no match found within timeout
 * - Creates AGENT_VS_AGENT games via agentGameRunner
 */

import crypto from "crypto";
import db from "../config/database.js";
import logger from "../config/logger.js";
import { ACTIVITY_XP, awardActivityXpByAgentId } from "./eloService.js";

const QUEUE_POLL_INTERVAL_MS = 5000; // Check for matches every 5 sec
const INITIAL_ELO_RANGE = 150; // Start matching within ±150 ELO
const MAX_ELO_RANGE = 500; // Never expand beyond ±500
const RANGE_EXPANSION_INTERVAL_MS = 60000; // Expand range every 60s if no match
const QUEUE_EXPIRY_MS = 10 * 60 * 1000; // Expire entries after 10 minutes

let pollIntervalHandle = null;

/**
 * Join the matchmaking queue with an agent.
 *
 * @param {number} userAgentId - Agent to queue
 * @param {number} userId - Owner user ID
 * @param {number|null} preferredOpponentAgentId - Optional: challenge specific agent
 * @returns {Promise<{queueEntryId: number, expiresAt: Date}>}
 */
export async function joinQueue(userAgentId, userId, preferredOpponentAgentId = null) {
  const agent = await db("user_agents").where("id", userAgentId).first();
  if (!agent) throw new Error(`Agent ${userAgentId} not found`);
  if (agent.user_id !== userId) throw new Error("Agent does not belong to this user");

  // Check if already queued
  const existing = await db("matchmaking_queue")
    .where("user_agent_id", userAgentId)
    .whereIn("status", ["WAITING", "MATCHED"])
    .first();

  if (existing) throw new Error("Agent already in queue");

  const expiresAt = new Date(Date.now() + QUEUE_EXPIRY_MS);

  const [queueEntryId] = await db("matchmaking_queue").insert({
    user_agent_id: userAgentId,
    user_id: userId,
    elo_rating: agent.elo_rating,
    status: "WAITING",
    preferred_opponent_agent_id: preferredOpponentAgentId,
    expires_at: expiresAt,
  });

  logger.info(
    {
      queueEntryId,
      userAgentId,
      elo: agent.elo_rating,
      isChallenge: !!preferredOpponentAgentId,
    },
    "Agent joined matchmaking queue"
  );

  return { queueEntryId, expiresAt };
}

/**
 * Leave the matchmaking queue.
 */
export async function leaveQueue(userAgentId) {
  await db("matchmaking_queue")
    .where("user_agent_id", userAgentId)
    .whereIn("status", ["WAITING", "MATCHED"])
    .delete();

  logger.info({ userAgentId }, "Agent left matchmaking queue");
}

/**
 * Find a suitable match for a queue entry.
 * Returns another waiting agent within ELO range, or null if no match.
 */
async function findMatchForEntry(entry, eloRange) {
  const minElo = entry.elo_rating - eloRange;
  const maxElo = entry.elo_rating + eloRange;

  // If this is a challenge, find the specific opponent
  if (entry.preferred_opponent_agent_id) {
    const opponent = await db("matchmaking_queue")
      .where("user_agent_id", entry.preferred_opponent_agent_id)
      .where("status", "WAITING")
      .where("id", "<", entry.id) // Avoid matching the same entry
      .first();

    if (opponent && !opponent.preferred_opponent_agent_id) {
      // Opponent must not be waiting for someone else
      return opponent;
    }
    return null;
  }

  // Standard ELO-based matching: find closest ELO that hasn't been checked recently
  const opponent = await db("matchmaking_queue")
    .where("status", "WAITING")
    .whereBetween("elo_rating", [minElo, maxElo])
    .where("id", "<", entry.id) // Avoid double-matching
    .where("preferred_opponent_agent_id", null) // Don't match with someone in challenge mode
    .orderBy(db.raw("abs(elo_rating - ?)", [entry.elo_rating])) // Closest ELO first
    .first();

  return opponent;
}

/**
 * Main matchmaking loop: scan queue, find matches, create games.
 * Called periodically by startMatchmakingPoll().
 */
async function pollForMatches() {
  try {
    // Clean expired entries
    await db("matchmaking_queue")
      .where("expires_at", "<", new Date())
      .delete();

    // Get all waiting entries, ordered by join time
    const waitingEntries = await db("matchmaking_queue")
      .where("status", "WAITING")
      .orderBy("created_at", "asc");

    if (waitingEntries.length === 0) return;

    // Try to match each entry
    for (const entry of waitingEntries) {
      // Calculate ELO range based on how long they've been waiting
      const waitTimeMs = Date.now() - new Date(entry.created_at).getTime();
      const expansions = Math.floor(waitTimeMs / RANGE_EXPANSION_INTERVAL_MS);
      const eloRange = Math.min(
        MAX_ELO_RANGE,
        INITIAL_ELO_RANGE + expansions * 50 // Expand by 50 every 60s
      );

      const opponent = await findMatchForEntry(entry, eloRange);
      if (!opponent) continue;

      // Found a match! Mark both as MATCHED and trigger game creation
      await db("matchmaking_queue").where("id", entry.id).update({ status: "MATCHED" });
      await db("matchmaking_queue").where("id", opponent.id).update({ status: "MATCHED" });

      // Create agent match record and game
      createMatchAndGame(entry, opponent);
    }
  } catch (err) {
    logger.error({ err: err?.message }, "Matchmaking poll failed");
  }
}

/**
 * Create a game and agent_arena_matches record for two matched agents.
 */
async function createMatchAndGame(queueEntryA, queueEntryB) {
  try {
    const agentA = await db("user_agents").where("id", queueEntryA.user_agent_id).first();
    const agentB = await db("user_agents").where("id", queueEntryB.user_agent_id).first();

    if (!agentA || !agentB) {
      logger.warn(
        { agentAId: queueEntryA.user_agent_id, agentBId: queueEntryB.user_agent_id },
        "One or both agents no longer exist"
      );
      return;
    }

    // Create agent_arena_matches entry
    const [matchId] = await db("agent_arena_matches").insert({
      match_type: "ARENA",
      agent_a_id: agentA.id,
      agent_b_id: agentB.id,
      agent_a_user_id: agentA.user_id,
      agent_b_user_id: agentB.user_id,
      status: "PENDING",
      elo_before_a: agentA.elo_rating,
      elo_before_b: agentB.elo_rating,
    });

    logger.info(
      {
        matchId,
        agentAId: agentA.id,
        agentBId: agentB.id,
        agentAElo: agentA.elo_rating,
        agentBElo: agentB.elo_rating,
      },
      "Agents matched in arena"
    );

    // Cleanup queue entries (will be finalized after game starts)
    // For now, just remove them from queue
    await db("matchmaking_queue").where("id", queueEntryA.id).delete();
    await db("matchmaking_queue").where("id", queueEntryB.id).delete();

    // NOTE: Game creation will be handled by external orchestrator
    // that watches agent_arena_matches.PENDING and calls agentGameRunner.createAgentGame
  } catch (err) {
    logger.error(
      {
        err: err?.message,
        queueEntryAId: queueEntryA.id,
        queueEntryBId: queueEntryB.id,
      },
      "Failed to create match and game"
    );
  }
}

/**
 * Start polling for matches. Call once on server startup.
 */
export function startMatchmakingPoll() {
  if (pollIntervalHandle) {
    logger.warn("Matchmaking poll already running");
    return;
  }

  logger.info("Starting matchmaking poll");
  pollIntervalHandle = setInterval(pollForMatches, QUEUE_POLL_INTERVAL_MS);
}

/**
 * Stop polling (e.g., on server shutdown).
 */
export function stopMatchmakingPoll() {
  if (pollIntervalHandle) {
    clearInterval(pollIntervalHandle);
    pollIntervalHandle = null;
    logger.info("Stopped matchmaking poll");
  }
}

/**
 * Get queue stats for monitoring.
 */
export async function getQueueStats() {
  const waiting = await db("matchmaking_queue").where("status", "WAITING").count("* as count").first();
  const matched = await db("matchmaking_queue").where("status", "MATCHED").count("* as count").first();

  return {
    waiting: waiting?.count || 0,
    matched: matched?.count || 0,
  };
}

/**
 * Create a direct agent vs agent challenge (immediate game creation, not queue-based).
 * Used when a user challenges another agent directly.
 *
 * @param {number} userAgentId - Your agent ID
 * @param {number} userId - Your user ID
 * @param {number} opponentAgentId - Opponent agent ID
 * @returns {Promise<{gameId: number, gameCode: string, boardType: string}>}
 */
export async function createDirectChallenge(userAgentId, userId, opponentAgentId) {
  const { createGameByBackend, joinGameByBackend } = await import("./tycoonContract.js");
  const { ensureUserHasContractPassword } = await import("../utils/ensureContractAuth.js");
  const agentRegistry = (await import("./agentRegistry.js")).default;
  const User = (await import("../models/User.js")).default;
  const Game = (await import("../models/Game.js")).default;
  const GamePlayer = (await import("../models/GamePlayer.js")).default;
  const GameSetting = (await import("../models/GameSetting.js")).default;
  const Chat = (await import("../models/Chat.js")).default;

  try {
    // Get both agents and their owners
    const userAgent = await db("user_agents").where("id", userAgentId).first();
    const opponentAgent = await db("user_agents").where("id", opponentAgentId).first();

    if (!userAgent || !opponentAgent) {
      throw new Error("One or both agents not found");
    }

    // Get user info for both players
    const userA = await User.findById(userId);
    const userB = await User.findById(opponentAgent.user_id);

    if (!userA || !userB) {
      throw new Error("One or both users not found");
    }

    const chain = User.normalizeChain(userA.chain || "base");

    // Ensure both users have contract passwords (generates if needed)
    const authA = await ensureUserHasContractPassword(db, userA.id, chain);
    const authB = await ensureUserHasContractPassword(db, userB.id, chain);

    if (!authA || !authB) {
      throw new Error("Failed to ensure contract authentication for players");
    }

    // Generate game code
    const code = `CHALLENGE_${Date.now()}`;
    const DEFAULT_STARTING_CASH = 1500;

    // Create game on-chain with User A (challenger)
    const result = await createGameByBackend(
      authA.address,
      authA.password_hash,
      authA.username,
      "PRIVATE",
      "car",
      2,
      code,
      DEFAULT_STARTING_CASH,
      0n,
      chain
    );

    const contractGameId = result?.gameId;
    if (!contractGameId) throw new Error("Contract did not return game ID");

    // Have User B (opponent) join the game
    await joinGameByBackend(
      authB.address,
      authB.password_hash,
      contractGameId,
      authB.username,
      "dog",
      code,
      chain
    );

    // Create game record in DB
    const now = new Date();
    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: userA.id,
      next_player_id: userA.id,
      number_of_players: 2,
      status: "IN_PROGRESS", // Auto-start since agents play automatically
      is_minipay: false,
      is_ai: false,
      chain,
      contract_game_id: String(contractGameId),
      // Required so 3D board treats this as agent battle: merge agent-bindings names into player list / UI
      game_type: "ONCHAIN_AGENT_VS_AGENT",
    });

    // Create game players
    await GamePlayer.create({
      game_id: game.id,
      user_id: userA.id,
      address: authA.address,
      balance: DEFAULT_STARTING_CASH,
      position: 0,
      turn_order: 1,
      symbol: "car",
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
      symbol: "dog",
      chance_jail_card: false,
      community_chest_jail_card: false,
    });

    // Create chat and game settings
    await Chat.create({ game_id: game.id, status: "open" });
    await GameSetting.create({
      game_id: game.id,
      auction: true,
      rent_in_prison: false,
      mortgage: true,
      even_build: true,
      randomize_play_order: false,
      starting_cash: DEFAULT_STARTING_CASH,
    });

    // Register agents to play for their users
    try {
      await agentRegistry.registerAgent({
        gameId: game.id,
        slot: 1,
        agentId: String(userAgentId),
        user_agent_id: userAgentId,
        chainId: 42220,
        name: userAgent.name || "Agent",
      });

      await agentRegistry.registerAgent({
        gameId: game.id,
        slot: 2,
        agentId: String(opponentAgentId),
        user_agent_id: opponentAgentId,
        chainId: 42220,
        name: opponentAgent.name || "Agent",
      });
    } catch (agentErr) {
      logger.warn({ err: agentErr?.message }, "Agent registration failed, game created but agents not bound");
    }
    awardActivityXpByAgentId(Number(userAgentId), ACTIVITY_XP.GAME_CREATED, "game_created").catch(() => {});
    awardActivityXpByAgentId(Number(opponentAgentId), ACTIVITY_XP.GAME_CREATED, "game_created").catch(() => {});

    return {
      gameId: game.id,
      gameCode: game.code,
      boardType: "3d_desktop",
    };
  } catch (err) {
    logger.error({ err: err?.message, userAgentId, opponentAgentId }, "Failed to create direct challenge");
    throw err;
  }
}

/** Must match TycoonLib.stringToPlayerSymbol (on-chain); emoji strings revert → "Logic: createGame failed". */
const ARENA_ONCHAIN_SLOT_SYMBOLS = [
  "car",
  "dog",
  "hat",
  "thimble",
  "wheelbarrow",
  "battleship",
  "boot",
  "iron",
];

function generateArenaJoinCode6() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const ARENA_HOUSE_CUT_PERCENT = 5;

/**
 * Arena: one on-chain game with challenger + up to 7 opponents (2–8 seats). No invites.
 *
 * @param {number} challengerAgentId
 * @param {number} userId - Must own challengerAgentId
 * @param {number[]} opponentAgentIds - 1–7 distinct agent ids (not the challenger)
 * @param {number} [stakeAmountUsdc] - Optional stake in USDC (e.g. 0.1). All participants must be able to afford (max per match + daily cap).
 * @returns {Promise<{ gameId: number, gameCode: string, boardType: string }>}
 */
export async function createMultiAgentOnchainArenaGame(challengerAgentId, userId, opponentAgentIds, stakeAmountUsdc) {
  const { createGameByBackend, joinGameByBackend } = await import("./tycoonContract.js");
  const { ensureUserHasContractPassword } = await import("../utils/ensureContractAuth.js");
  const { getChainConfig } = await import("../config/chains.js");
  const agentRegistry = (await import("./agentRegistry.js")).default;
  const User = (await import("../models/User.js")).default;
  const Game = (await import("../models/Game.js")).default;
  const GamePlayer = (await import("../models/GamePlayer.js")).default;
  const GameSetting = (await import("../models/GameSetting.js")).default;
  const Chat = (await import("../models/Chat.js")).default;

  const cid = Number(challengerAgentId);
  const uid = Number(userId);
  if (!cid || !uid) throw new Error("Invalid challenger or user");

  const rawOpponents = Array.isArray(opponentAgentIds) ? opponentAgentIds.map(Number).filter((n) => n > 0) : [];
  const uniqueOpponentIds = [...new Set(rawOpponents)].filter((id) => id !== cid);
  if (uniqueOpponentIds.length === 0) throw new Error("Select at least one opponent agent");
  if (uniqueOpponentIds.length > 7) throw new Error("At most 7 opponents (8 players total)");

  try {
    const challengerAgent = await db("user_agents").where("id", cid).first();
    if (!challengerAgent) throw new Error("Your agent was not found");
    if (Number(challengerAgent.user_id) !== uid) throw new Error("You do not own this agent");

    const opponentAgents = [];
    for (const oid of uniqueOpponentIds) {
      const row = await db("user_agents").where("id", oid).first();
      if (!row) throw new Error(`Opponent agent ${oid} not found`);
      opponentAgents.push(row);
    }

    const rosterAgents = [challengerAgent, ...opponentAgents];
    const userIds = rosterAgents.map((a) => Number(a.user_id));
    if (new Set(userIds).size !== userIds.length) {
      throw new Error("Each seat must be a different player (no duplicate owners)");
    }

    const challengerUser = await User.findById(uid);
    if (!challengerUser) throw new Error("User not found");

    const chain = User.normalizeChain(challengerUser.chain || "base");
    const chainCfg = getChainConfig(chain);
    const chainId = chainCfg.chainId || 42220;

    const rosterUsers = [];
    for (const id of userIds) {
      const u = await User.findById(id);
      if (!u) throw new Error("Player user not found");
      const uc = User.normalizeChain(u.chain || "base");
      if (uc !== chain) throw new Error("All players must use the same chain as the challenger");
      rosterUsers.push(u);
    }

    const stakeNum = stakeAmountUsdc != null ? Number(stakeAmountUsdc) : 0;
    const stakeUnits = stakeNum > 0 ? BigInt(Math.floor(stakeNum * 1e6)) : 0n;

    if (stakeUnits > 0n) {
      if (rosterAgents.length !== 2) {
        throw new Error("Staked arena matches support only 2 players. Use stake 0 for free multi-player matches.");
      }
      for (let i = 0; i < rosterAgents.length; i++) {
        const agent = rosterAgents[i];
        const perm = await db("agent_tournament_permissions")
          .where({ user_agent_id: agent.id })
          .first();
        if (!perm?.enabled) {
          throw new Error(
            `Agent "${agent.name}" (or an opponent) has not enabled tournament spending. All participants must approve spending in My agents → Full manager → Tournaments.`
          );
        }
        if (perm.chain && User.normalizeChain(perm.chain) !== chain) {
          throw new Error(`Agent "${agent.name}" is restricted to chain ${perm.chain}; match uses ${chain}.`);
        }
        const maxUnits = BigInt(perm.max_entry_fee_usdc ?? "0");
        if (stakeUnits > maxUnits) {
          throw new Error(
            `Stake $${stakeNum} exceeds "${agent.name}" max per match ($${(Number(maxUnits) / 1e6).toFixed(2)}). Lower the stake or pick different opponents.`
          );
        }
        if (perm.daily_cap_usdc) {
          const cap = BigInt(perm.daily_cap_usdc);
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const rows = await db("agent_tournament_spend_log")
            .where({ user_id: agent.user_id, user_agent_id: agent.id })
            .andWhere("created_at", ">=", start)
            .andWhere({ chain })
            .select("amount_usdc");
          let spent = 0n;
          for (const r of rows || []) {
            try { spent += BigInt(r.amount_usdc ?? "0"); } catch {}
          }
          if (spent + stakeUnits > cap) {
            throw new Error(
              `"${agent.name}" would exceed daily spend cap with this stake. Try again tomorrow or lower the stake.`
            );
          }
        }
      }
    }

    const auths = [];
    for (const u of rosterUsers) {
      const auth = await ensureUserHasContractPassword(db, u.id, chain);
      if (!auth) throw new Error("Failed to ensure contract authentication for a player");
      auths.push(auth);
    }

    let arenaStakeTournamentId = null;
    let arenaStakeMatchId = null;

    if (stakeUnits > 0n) {
      const Tournament = (await import("../models/Tournament.js")).default;
      const TournamentEntry = (await import("../models/TournamentEntry.js")).default;
      const TournamentMatch = (await import("../models/TournamentMatch.js")).default;
      const { createTournamentOnChain } = await import("./tournamentEscrow.js");
      const { signWithdrawalAuthUsdc, withdrawFromSmartWalletUsdc } = await import("./tycoonContract.js");

      const cfg = getChainConfig(chain);
      const escrow = cfg.tournamentEscrowAddress;
      const usdc = cfg.usdcAddress ?? process.env.CELO_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
      if (!escrow || !usdc) {
        throw new Error("Tournament escrow or USDC not configured for this chain. Staked matches are unavailable.");
      }

      const tournament = await Tournament.create({
        creator_id: rosterUsers[0].id,
        name: "Arena stake",
        status: "IN_PROGRESS",
        prize_source: "ENTRY_FEE_POOL",
        max_players: 2,
        min_players: 2,
        entry_fee_wei: String(stakeUnits),
        chain,
        prize_distribution: { 1: 95 },
      });
      arenaStakeTournamentId = tournament.id;

      await createTournamentOnChain(tournament.id, stakeUnits, auths[0].address, chain);

      const entries = [];
      for (let i = 0; i < 2; i++) {
        const u = rosterUsers[i];
        const smartWallet = u.smart_wallet_address && String(u.smart_wallet_address).trim();
        if (!smartWallet) {
          throw new Error(
            `Player ${i + 1} has no smart wallet. Both players need a smart wallet (Profile) for staked matches.`
          );
        }
        const nonce = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
        const sig = await signWithdrawalAuthUsdc(smartWallet, usdc, escrow, stakeUnits, nonce, chain);
        const receipt = await withdrawFromSmartWalletUsdc(smartWallet, escrow, stakeUnits, nonce, sig, chain);
        const paymentTxHash = receipt?.hash ?? null;

        await db("agent_tournament_spend_log").insert({
          user_id: u.id,
          user_agent_id: rosterAgents[i].id,
          tournament_id: tournament.id,
          chain,
          amount_usdc: stakeUnits.toString(),
          tx_hash: paymentTxHash,
          status: paymentTxHash ? "SUBMITTED" : "FAILED",
          error: paymentTxHash ? null : "No tx hash returned",
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });

        const entry = await TournamentEntry.create({
          tournament_id: tournament.id,
          user_id: u.id,
          address: u.address || auths[i].address,
          chain: u.chain || chain,
          seed_order: i + 1,
          payment_tx_hash: paymentTxHash,
          status: "CONFIRMED",
        });
        entries.push(entry);

        const agent = rosterAgents[i];
        await db("tournament_entry_agents").insert({
          tournament_entry_id: entry.id,
          user_agent_id: agent.id,
          agent_name: agent.name || null,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
      }

      const tMatch = await TournamentMatch.create({
        tournament_id: tournament.id,
        round_index: 0,
        match_index: 0,
        slot_a_type: "ENTRY",
        slot_a_entry_id: entries[0].id,
        slot_b_type: "ENTRY",
        slot_b_entry_id: entries[1].id,
        game_id: null,
        status: "PENDING",
      });
      arenaStakeMatchId = tMatch.id;
    }

    let code = generateArenaJoinCode6();
    for (let attempt = 0; attempt < 24; attempt++) {
      const exists = await Game.findByCode(code);
      if (!exists) break;
      code = generateArenaJoinCode6();
    }

    const n = rosterAgents.length;
    const DEFAULT_STARTING_CASH = 1500;
    const symbols = ARENA_ONCHAIN_SLOT_SYMBOLS.slice(0, n);

    const createResult = await createGameByBackend(
      auths[0].address,
      auths[0].password_hash,
      auths[0].username,
      "PRIVATE",
      symbols[0],
      n,
      code,
      DEFAULT_STARTING_CASH,
      0n,
      chain
    );

    const contractGameId = createResult?.gameId;
    if (!contractGameId) throw new Error("Contract did not return game ID");

    for (let i = 1; i < n; i++) {
      await joinGameByBackend(
        auths[i].address,
        auths[i].password_hash,
        contractGameId,
        auths[i].username,
        symbols[i],
        code,
        chain
      );
    }

    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: rosterUsers[0].id,
      next_player_id: rosterUsers[0].id,
      number_of_players: n,
      status: "RUNNING",
      is_minipay: false,
      is_ai: false,
      duration: "30",
      chain,
      contract_game_id: String(contractGameId),
      game_type: "ONCHAIN_AGENT_VS_AGENT",
      started_at: db.fn.now(),
    });

    if (arenaStakeTournamentId != null && arenaStakeMatchId != null) {
      await db("tournament_matches").where("id", arenaStakeMatchId).update({
        game_id: game.id,
        contract_game_id: String(contractGameId),
        status: "IN_PROGRESS",
        updated_at: db.fn.now(),
      });
      const stakeNum = stakeAmountUsdc != null ? Number(stakeAmountUsdc) : 0;
      await db("arena_match_stakes").insert({
        game_id: game.id,
        tournament_id: arenaStakeTournamentId,
        stake_amount_usdc: String(stakeNum),
        chain,
        status: "COLLECTED",
        collected_at: db.fn.now(),
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    }

    for (let i = 0; i < n; i++) {
      await GamePlayer.create({
        game_id: game.id,
        user_id: rosterUsers[i].id,
        address: auths[i].address,
        balance: DEFAULT_STARTING_CASH,
        position: 0,
        turn_order: i + 1,
        symbol: symbols[i],
        chance_jail_card: false,
        community_chest_jail_card: false,
      });
    }

    await Chat.create({ game_id: game.id, status: "open" });
    await GameSetting.create({
      game_id: game.id,
      auction: true,
      rent_in_prison: false,
      mortgage: true,
      even_build: true,
      randomize_play_order: false,
      starting_cash: DEFAULT_STARTING_CASH,
    });

    try {
      for (let i = 0; i < n; i++) {
        await agentRegistry.registerAgent({
          gameId: game.id,
          slot: i + 1,
          agentId: String(rosterAgents[i].id),
          user_agent_id: rosterAgents[i].id,
          chainId,
          name: rosterAgents[i].name || "Agent",
        });
      }
    } catch (agentErr) {
      logger.warn({ err: agentErr?.message }, "Agent registration failed; game created but agents may not be bound");
    }
    for (const a of rosterAgents) {
      awardActivityXpByAgentId(Number(a.id), ACTIVITY_XP.GAME_CREATED, "game_created").catch(() => {});
    }

    return {
      gameId: game.id,
      gameCode: game.code,
      boardType: "3d_desktop",
    };
  } catch (err) {
    logger.error({ err: err?.message, challengerAgentId, userId }, "createMultiAgentOnchainArenaGame failed");
    throw err;
  }
}

/**
 * Human plays seat 1 on-chain; opponent agent auto-plays seat 2. Optional equal USDC stake from both smart wallets.
 *
 * @param {number} userId - Logged-in user (human challenger)
 * @param {number} opponentAgentId - Another user's agent
 * @param {number} [stakeAmountUsdc]
 */
export async function createHumanVsAgentOnchainArenaGame(userId, opponentAgentId, stakeAmountUsdc) {
  const { createGameByBackend, joinGameByBackend } = await import("./tycoonContract.js");
  const { ensureUserHasContractPassword } = await import("../utils/ensureContractAuth.js");
  const { getChainConfig } = await import("../config/chains.js");
  const agentRegistry = (await import("./agentRegistry.js")).default;
  const User = (await import("../models/User.js")).default;
  const Game = (await import("../models/Game.js")).default;
  const GamePlayer = (await import("../models/GamePlayer.js")).default;
  const GameSetting = (await import("../models/GameSetting.js")).default;
  const Chat = (await import("../models/Chat.js")).default;

  const uid = Number(userId);
  const oid = Number(opponentAgentId);
  if (!uid || !oid) throw new Error("Invalid user or opponent agent");

  try {
    const opponentAgent = await db("user_agents").where("id", oid).first();
    if (!opponentAgent) throw new Error("Opponent agent not found");
    if (Number(opponentAgent.user_id) === uid) {
      throw new Error("Pick another player's agent — you play yourself here, not your own bot.");
    }

    const humanUser = await User.findById(uid);
    const opponentOwner = await User.findById(opponentAgent.user_id);
    if (!humanUser || !opponentOwner) throw new Error("User not found");

    const chain = User.normalizeChain(humanUser.chain || "base");
    const chainCfg = getChainConfig(chain);
    const chainId = chainCfg.chainId || 42220;

    const uc = User.normalizeChain(opponentOwner.chain || "base");
    if (uc !== chain) throw new Error(`Opponent must be on the same chain as you (${chain}).`);

    const stakeNum = stakeAmountUsdc != null ? Number(stakeAmountUsdc) : 0;
    const stakeUnits = stakeNum > 0 ? BigInt(Math.floor(stakeNum * 1e6)) : 0n;

    if (stakeUnits > 0n) {
      const perm = await db("agent_tournament_permissions").where({ user_agent_id: opponentAgent.id }).first();
      if (!perm?.enabled) {
        throw new Error(
          `Opponent agent "${opponentAgent.name}" has not enabled tournament spending. They must approve in My agents → Tournaments.`
        );
      }
      if (perm.chain && User.normalizeChain(perm.chain) !== chain) {
        throw new Error(`That agent is restricted to chain ${perm.chain}; your match uses ${chain}.`);
      }
      const maxUnits = BigInt(perm.max_entry_fee_usdc ?? "0");
      if (stakeUnits > maxUnits) {
        throw new Error(
          `Stake $${stakeNum} exceeds opponent max per match ($${(Number(maxUnits) / 1e6).toFixed(2)}).`
        );
      }
      if (perm.daily_cap_usdc) {
        const cap = BigInt(perm.daily_cap_usdc);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const rows = await db("agent_tournament_spend_log")
          .where({ user_id: opponentOwner.id, user_agent_id: opponentAgent.id })
          .andWhere("created_at", ">=", start)
          .andWhere({ chain })
          .select("amount_usdc");
        let spent = 0n;
        for (const r of rows || []) {
          try {
            spent += BigInt(r.amount_usdc ?? "0");
          } catch {}
        }
        if (spent + stakeUnits > cap) {
          throw new Error("Opponent would exceed their daily spend cap with this stake.");
        }
      }
    }

    const auths = [];
    for (const u of [humanUser, opponentOwner]) {
      const auth = await ensureUserHasContractPassword(db, u.id, chain);
      if (!auth) throw new Error("Failed to ensure contract authentication for a player");
      auths.push(auth);
    }

    let arenaStakeTournamentId = null;
    let arenaStakeMatchId = null;

    if (stakeUnits > 0n) {
      const Tournament = (await import("../models/Tournament.js")).default;
      const TournamentEntry = (await import("../models/TournamentEntry.js")).default;
      const TournamentMatch = (await import("../models/TournamentMatch.js")).default;
      const { createTournamentOnChain } = await import("./tournamentEscrow.js");
      const { signWithdrawalAuthUsdc, withdrawFromSmartWalletUsdc } = await import("./tycoonContract.js");

      const cfg = getChainConfig(chain);
      const escrow = cfg.tournamentEscrowAddress;
      const usdc = cfg.usdcAddress ?? process.env.CELO_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
      if (!escrow || !usdc) {
        throw new Error("Tournament escrow or USDC not configured for this chain. Staked matches are unavailable.");
      }

      const tournament = await Tournament.create({
        creator_id: humanUser.id,
        name: "Arena stake (human vs agent)",
        status: "IN_PROGRESS",
        prize_source: "ENTRY_FEE_POOL",
        max_players: 2,
        min_players: 2,
        entry_fee_wei: String(stakeUnits),
        chain,
        prize_distribution: { 1: 95 },
      });
      arenaStakeTournamentId = tournament.id;

      await createTournamentOnChain(tournament.id, stakeUnits, auths[0].address, chain);

      const entries = [];

      for (let i = 0; i < 2; i++) {
        const u = i === 0 ? humanUser : opponentOwner;
        const smartWallet = u.smart_wallet_address && String(u.smart_wallet_address).trim();
        if (!smartWallet) {
          throw new Error(
            i === 0
              ? "You need a smart wallet (Profile) to stake from your account."
              : "Opponent has no smart wallet; they cannot stake this match."
          );
        }
        const nonce = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
        const sig = await signWithdrawalAuthUsdc(smartWallet, usdc, escrow, stakeUnits, nonce, chain);
        const receipt = await withdrawFromSmartWalletUsdc(smartWallet, escrow, stakeUnits, nonce, sig, chain);
        const paymentTxHash = receipt?.hash ?? null;

        await db("agent_tournament_spend_log").insert({
          user_id: u.id,
          user_agent_id: i === 0 ? null : opponentAgent.id,
          tournament_id: tournament.id,
          chain,
          amount_usdc: stakeUnits.toString(),
          tx_hash: paymentTxHash,
          status: paymentTxHash ? "SUBMITTED" : "FAILED",
          error: paymentTxHash ? null : "No tx hash returned",
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });

        const entry = await TournamentEntry.create({
          tournament_id: tournament.id,
          user_id: u.id,
          address: u.address || auths[i].address,
          chain: u.chain || chain,
          seed_order: i + 1,
          payment_tx_hash: paymentTxHash,
          status: "CONFIRMED",
        });
        entries.push(entry);

        if (i === 1) {
          await db("tournament_entry_agents").insert({
            tournament_entry_id: entry.id,
            user_agent_id: opponentAgent.id,
            agent_name: opponentAgent.name || null,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          });
        }
      }

      const tMatch = await TournamentMatch.create({
        tournament_id: tournament.id,
        round_index: 0,
        match_index: 0,
        slot_a_type: "ENTRY",
        slot_a_entry_id: entries[0].id,
        slot_b_type: "ENTRY",
        slot_b_entry_id: entries[1].id,
        game_id: null,
        status: "PENDING",
      });
      arenaStakeMatchId = tMatch.id;
    }

    let code = generateArenaJoinCode6();
    for (let attempt = 0; attempt < 24; attempt++) {
      const exists = await Game.findByCode(code);
      if (!exists) break;
      code = generateArenaJoinCode6();
    }

    const n = 2;
    const DEFAULT_STARTING_CASH = 1500;
    const symbols = ARENA_ONCHAIN_SLOT_SYMBOLS.slice(0, n);

    const createResult = await createGameByBackend(
      auths[0].address,
      auths[0].password_hash,
      auths[0].username,
      "PRIVATE",
      symbols[0],
      n,
      code,
      DEFAULT_STARTING_CASH,
      0n,
      chain
    );

    const contractGameId = createResult?.gameId;
    if (!contractGameId) throw new Error("Contract did not return game ID");

    await joinGameByBackend(
      auths[1].address,
      auths[1].password_hash,
      contractGameId,
      auths[1].username,
      symbols[1],
      code,
      chain
    );

    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: humanUser.id,
      next_player_id: humanUser.id,
      number_of_players: n,
      status: "RUNNING",
      is_minipay: false,
      is_ai: false,
      duration: "30",
      chain,
      contract_game_id: String(contractGameId),
      game_type: "ONCHAIN_HUMAN_VS_AGENT",
      started_at: db.fn.now(),
    });

    if (arenaStakeTournamentId != null && arenaStakeMatchId != null) {
      await db("tournament_matches").where("id", arenaStakeMatchId).update({
        game_id: game.id,
        contract_game_id: String(contractGameId),
        status: "IN_PROGRESS",
        updated_at: db.fn.now(),
      });
      await db("arena_match_stakes").insert({
        game_id: game.id,
        tournament_id: arenaStakeTournamentId,
        stake_amount_usdc: String(stakeNum),
        chain,
        status: "COLLECTED",
        collected_at: db.fn.now(),
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    }

    const rosterUsers = [humanUser, opponentOwner];
    for (let i = 0; i < n; i++) {
      await GamePlayer.create({
        game_id: game.id,
        user_id: rosterUsers[i].id,
        address: auths[i].address,
        balance: DEFAULT_STARTING_CASH,
        position: 0,
        turn_order: i + 1,
        symbol: symbols[i],
        chance_jail_card: false,
        community_chest_jail_card: false,
      });
    }

    await Chat.create({ game_id: game.id, status: "open" });
    await GameSetting.create({
      game_id: game.id,
      auction: true,
      rent_in_prison: false,
      mortgage: true,
      even_build: true,
      randomize_play_order: false,
      starting_cash: DEFAULT_STARTING_CASH,
    });

    try {
      await agentRegistry.registerAgent({
        gameId: game.id,
        slot: 2,
        agentId: String(opponentAgent.id),
        user_agent_id: opponentAgent.id,
        chainId,
        name: opponentAgent.name || "Agent",
      });
    } catch (agentErr) {
      logger.warn({ err: agentErr?.message }, "Opponent agent registration failed");
    }

    awardActivityXpByAgentId(Number(opponentAgent.id), ACTIVITY_XP.GAME_CREATED, "game_created").catch(() => {});

    return {
      gameId: game.id,
      gameCode: game.code,
      boardType: "3d_desktop",
    };
  } catch (err) {
    logger.error({ err: err?.message, userId, opponentAgentId }, "createHumanVsAgentOnchainArenaGame failed");
    throw err;
  }
}
