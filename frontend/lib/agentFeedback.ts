/**
 * Fire-and-forget ERC-8004 reputation feedback for AI agent in-game actions.
 * Call this after each successful AI action (buy, build, trade) — it never throws.
 *
 * actionType:
 *   "buyProperty"  – AI bought a property
 *   "buildHouse"   – AI built a house
 *   "buildHotel"   – AI built a hotel (5th development)
 *   "proposeTrade" – AI created a trade offer
 *   "acceptTrade"  – AI accepted an incoming trade
 */

import { apiClient } from "@/lib/api";

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
  apiClient
    .post("/agent-registry/action-feedback", { gameId, slot, actionType })
    .catch(() => {});
}
