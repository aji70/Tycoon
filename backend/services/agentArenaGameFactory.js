/**
 * Creates 2-player AGENT_VS_AGENT games for arena challenges (shared by HTTP + pending accept).
 */

import db from "../config/database.js";
import User from "../models/User.js";
import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameSetting from "../models/GameSetting.js";
import Chat from "../models/Chat.js";
import agentRegistry from "./agentRegistry.js";
import logger from "../config/logger.js";
import { recordEvent } from "./analytics.js";

const AI_ADDRESSES = [
  "0xA1FF1c93600c3487FABBdAF21B1A360630f8bac6",
  "0xB2EE17D003e63985f3648f6c1d213BE86B474B11",
];

const AI_SYMBOLS = ["car", "dog", "hat", "thimble", "wheelbarrow", "battleship", "boot", "iron", "top_hat"];

function generateJoinCode6() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function getOrCreateAIUser(aiIndex, chain = "CELO") {
  const address = AI_ADDRESSES[aiIndex];
  if (!address) return null;
  const user = await User.findByAddressOnly(address);
  if (user) return user;
  const username = `AI_${aiIndex + 1}`;
  const normalizedChain = User.normalizeChain(chain);
  try {
    return await User.create({ address, username, chain: normalizedChain });
  } catch (err) {
    logger.warn({ err: err?.message, address, username }, "getOrCreateAIUser create failed");
    return null;
  }
}

/**
 * @param {object} opts
 * @param {number} opts.creatorUserId - Owner of challenger agent (game creator in DB)
 * @param {number} opts.challengerUserAgentId
 * @param {number} opts.opponentUserAgentId
 * @param {string} [opts.challengerName]
 * @param {string} [opts.opponentName]
 * @param {string} [opts.chain]
 * @param {object} [opts.settings]
 */
export async function createTwoPlayerAgentArenaGame(opts) {
  const {
    creatorUserId,
    challengerUserAgentId,
    opponentUserAgentId,
    challengerName = "Challenger",
    opponentName = "Opponent",
    chain: chainRaw = "CELO",
    settings = {},
  } = opts;

  const normalizedChain = User.normalizeChain(chainRaw);
  const startingCash = Number(settings?.starting_cash ?? 1500);
  const duration = String(Number(settings?.duration ?? 0) || 0);

  let code = generateJoinCode6();
  for (let attempt = 0; attempt < 8; attempt++) {
    const exists = await Game.findByCode(code);
    if (!exists) break;
    code = generateJoinCode6();
  }

  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: creatorUserId,
    next_player_id: null,
    number_of_players: 2,
    status: "RUNNING",
    is_minipay: false,
    is_ai: true,
    duration,
    chain: normalizedChain,
    contract_game_id: null,
    game_type: "AGENT_VS_AGENT",
    started_at: db.fn.now(),
  });

  await Chat.create({ game_id: game.id, status: "open" });

  await GameSetting.create({
    game_id: game.id,
    auction: settings?.auction ?? true,
    rent_in_prison: settings?.rent_in_prison ?? false,
    mortgage: settings?.mortgage ?? true,
    even_build: settings?.even_build ?? true,
    randomize_play_order: settings?.randomize_play_order ?? false,
    starting_cash: startingCash,
  });

  const players = [];
  for (let i = 0; i < 2; i++) {
    const aiUser = await getOrCreateAIUser(i, normalizedChain);
    if (!aiUser) throw new Error(`Failed to create AI user for slot ${i + 1}`);
    const sym = AI_SYMBOLS[i % AI_SYMBOLS.length] || "hat";
    const gp = await GamePlayer.create({
      game_id: game.id,
      user_id: aiUser.id,
      address: aiUser.address,
      balance: startingCash,
      position: 0,
      turn_order: i + 1,
      symbol: sym,
      chance_jail_card: false,
      community_chest_jail_card: false,
    });
    players.push(gp);
  }

  const first = players.find((p) => Number(p.turn_order) === 1) || players[0];
  if (first?.user_id) {
    await Game.update(game.id, { next_player_id: first.user_id });
    await GamePlayer.setTurnStart(game.id, first.user_id);
  }

  await agentRegistry.registerAgent({
    gameId: game.id,
    slot: 1,
    agentId: String(challengerUserAgentId),
    user_agent_id: Number(challengerUserAgentId),
    chainId: 42220,
    name: challengerName,
  });

  await agentRegistry.registerAgent({
    gameId: game.id,
    slot: 2,
    agentId: String(opponentUserAgentId),
    user_agent_id: Number(opponentUserAgentId),
    chainId: 42220,
    name: opponentName,
  });

  await recordEvent("game_created", {
    entityType: "game",
    entityId: game.id,
    payload: { game_type: "AGENT_VS_AGENT", number_of_players: 2, source: "arena_challenge" },
  });

  const fullGame = await Game.findById(game.id);
  return fullGame || game;
}
