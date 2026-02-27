/**
 * Helpers to emit game state updates over Socket.io so clients can refetch instead of polling.
 */
import Game from "../models/Game.js";
import logger from "../config/logger.js";

/**
 * Emit game-update to a game room so all clients in that room refetch game state.
 * @param {object} io - Socket.io Server instance
 * @param {string} gameCode - Game room code
 */
export function emitGameUpdate(io, gameCode) {
  if (!io || !gameCode) return;
  try {
    io.to(gameCode).emit("game-update", { gameCode });
  } catch (err) {
    logger.warn({ err, gameCode }, "emitGameUpdate failed");
  }
}

/**
 * Emit game-update by game id (loads game to get code, then emits).
 * Use when you only have game_id (e.g. in gamePlayerController).
 * @param {object} io - Socket.io Server instance
 * @param {number} gameId - Game id
 */
export async function emitGameUpdateByGameId(io, gameId) {
  if (!io || !gameId) return;
  try {
    const game = await Game.findById(gameId);
    if (game?.code) emitGameUpdate(io, game.code);
  } catch (err) {
    logger.warn({ err, gameId }, "emitGameUpdateByGameId failed");
  }
}
