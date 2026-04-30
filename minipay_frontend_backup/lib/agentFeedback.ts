/**
 * Fire-and-forget ERC-8004 reputation feedback for AI agent in-game actions.
 * Throttled: same (gameId, slot, actionType) at most once per COOLDOWN_MS, and at most MAX_PER_GAME per game.
 *
 * actionType:
 *   "buyProperty"  – AI bought a property
 *   "buildHouse"   – AI built a house
 *   "buildHotel"   – AI built a hotel (5th development)
 *   "proposeTrade" – AI created a trade offer
 *   "acceptTrade"  – AI accepted an incoming trade
 */

import { apiClient } from "@/lib/api";

const COOLDOWN_MS = 60_000; // same action type per game/slot at most once per minute
const MAX_PER_GAME = 15;    // max action-feedback requests per game (avoids spam in long games)

const lastSentByKey: Record<string, number> = {};
const countByGame: Record<number, number> = {};

export type AiActionType =
  | "buyProperty"
  | "buildHouse"
  | "buildHotel"
  | "proposeTrade"
  | "acceptTrade";

export function reportAiAction(
  gameId: number | undefined | null,
  slot: number,
  actionType: AiActionType
): void {
  if (!gameId) return;
  const key = `${gameId}-${slot}-${actionType}`;
  const now = Date.now();
  if ((lastSentByKey[key] ?? 0) + COOLDOWN_MS > now) return;
  const count = (countByGame[gameId] ?? 0);
  if (count >= MAX_PER_GAME) return;

  lastSentByKey[key] = now;
  countByGame[gameId] = count + 1;

  apiClient
    .post("/agent-registry/action-feedback", { gameId, slot, actionType })
    .catch(() => {});
}
