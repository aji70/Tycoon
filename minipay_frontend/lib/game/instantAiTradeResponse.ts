/**
 * When a human client proposes or counters a trade, the "AI player" has no browser.
 * We simulate their response here using /agent-registry/decision when possible, else heuristics.
 */

import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import type { Game, Player, Property, GameProperty } from "@/types/game";
import type { ApiResponse } from "@/types/api";
import {
  isAIPlayer,
  calculateAiFavorability,
  getAiSlotFromPlayer,
  TRADE_ACCEPT_STRONG,
  TRADE_ACCEPT_FAIR,
  TRADE_COUNTER_THRESHOLD,
} from "@/utils/gameUtils";

function normArr(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(Number).filter((n) => !Number.isNaN(n));
  return [];
}

function normalizeTradeRow(trade: Record<string, unknown>) {
  return {
    id: Number(trade.id),
    game_id: Number(trade.game_id),
    player_id: trade.player_id as string | number,
    target_player_id: trade.target_player_id as string | number,
    offer_properties: normArr(trade.offer_properties),
    offer_amount: Number(trade.offer_amount ?? 0),
    requested_properties: normArr(trade.requested_properties),
    requested_amount: Number(trade.requested_amount ?? 0),
    status: trade.status as string | undefined,
  };
}

/** After POST create or PUT counter: if target is an AI seat, resolve accept / decline / counter immediately. */
export async function instantAiRespondWhenTargetIsAi(params: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  trade: Record<string, unknown>;
  refreshTrades: () => void;
}): Promise<void> {
  const { game, properties, game_properties, trade, refreshTrades } = params;
  const t = normalizeTradeRow(trade);
  const targetPlayer = game.players?.find((p) => p.user_id === Number(t.target_player_id));
  if (!targetPlayer || !isAIPlayer(targetPlayer)) return;

  const proposerId = typeof t.player_id === "string" ? Number(t.player_id) : t.player_id;
  const humanPlayer = game.players?.find((p) => p.user_id === proposerId);
  if (!humanPlayer) return;

  const sentTrade = {
    game_id: game.id,
    player_id: proposerId,
    target_player_id: targetPlayer.user_id,
    offer_properties: t.offer_properties,
    offer_amount: t.offer_amount,
    requested_properties: t.requested_properties,
    requested_amount: t.requested_amount,
    status: "pending" as const,
    id: t.id,
  };

  let decision: "accepted" | "declined" | "countered" = "declined";
  let remark = "";
  let counterCashAdjustment: number | null = null;

  try {
    const slot = getAiSlotFromPlayer(targetPlayer);
    if (slot != null) {
      try {
        const agentRes = await apiClient.post<{
          success?: boolean;
          data?: { action?: string; counterOffer?: { cashAdjustment?: number } };
          useBuiltIn?: boolean;
        }>("/agent-registry/decision", {
          gameId: game.id,
          slot,
          decisionType: "trade",
          context: {
            tradeOffer: sentTrade,
            myBalance: targetPlayer.balance ?? 0,
            myProperties: (game_properties ?? [])
              .filter((gp) => (gp.address ?? "").toLowerCase() === (targetPlayer.address ?? "").toLowerCase())
              .map((gp) => ({
                ...(properties ?? []).find((p) => p.id === gp.property_id),
                ...gp,
              })),
            opponents: (game.players ?? []).filter((p) => p.user_id !== targetPlayer.user_id),
          },
        });
        const action = agentRes?.data?.data?.action;
        const counterOffer = agentRes?.data?.data?.counterOffer;
        if (agentRes?.data?.success && typeof action === "string") {
          const actionLower = action.toLowerCase();
          if (actionLower === "accept") {
            decision = "accepted";
            remark =
              agentRes?.data?.useBuiltIn === false
                ? slot === 1
                  ? "Your agent accepted. 🤖"
                  : "Opponent agent accepted. 🤖"
                : "Accepted. 🤖";
          } else if (actionLower === "decline") {
            decision = "declined";
            remark =
              agentRes?.data?.useBuiltIn === false
                ? slot === 1
                  ? "Your agent declined."
                  : "Opponent agent declined."
                : "";
          } else if (actionLower === "counter") {
            decision = "countered";
            counterCashAdjustment = counterOffer?.cashAdjustment ?? 0;
            const adj = counterOffer?.cashAdjustment;
            const counterReason =
              adj != null && adj !== 0
                ? `Counter: ${adj > 0 ? `+$${adj} from you.` : `I'll add $${Math.abs(adj)}.`}`
                : "Counter offer.";
            remark =
              agentRes?.data?.useBuiltIn === false && slot === 1
                ? `Your agent countered. ${counterReason}`
                : counterReason;
          }
        }
      } catch {
        /* fall through to heuristics */
      }
    }

    if (remark === "") {
      const favorability = calculateAiFavorability(sentTrade as any, properties ?? []);
      if (favorability >= TRADE_ACCEPT_STRONG) {
        decision = "accepted";
        remark = "This is a fantastic deal! 🤖";
      } else if (favorability >= TRADE_ACCEPT_FAIR) {
        decision = Math.random() < 0.7 ? "accepted" : "declined";
        remark = decision === "accepted" ? "Fair enough, I'll take it." : "Not quite good enough.";
      } else if (favorability >= 0) {
        decision = Math.random() < 0.3 ? "accepted" : "declined";
        remark = decision === "accepted" ? "Okay, deal." : "Nah, too weak.";
      } else if (favorability >= TRADE_COUNTER_THRESHOLD && Math.random() < 0.4) {
        decision = "countered";
        counterCashAdjustment = counterCashAdjustment ?? 0;
        remark = "How about this instead?";
      } else {
        remark = "This deal is terrible for me! 😤";
      }
    }

    const aiBal = Number(targetPlayer.balance ?? 0);
    const humanBal = Number(humanPlayer.balance ?? 0);

    if (decision === "accepted") {
      await apiClient.post<ApiResponse>("/game-trade-requests/accept", { id: sentTrade.id });
      refreshTrades();
      toast.success(remark || "AI accepted your trade! 🎉");
      return;
    }

    if (decision === "countered") {
      const adj = counterCashAdjustment ?? 0;
      const counterOfferAmount = Math.max(0, (sentTrade.requested_amount ?? 0) - adj);
      const counterRequestedAmount = (sentTrade.offer_amount ?? 0) + adj;
      if (aiBal < counterOfferAmount) {
        await apiClient.post("/game-trade-requests/decline", { id: sentTrade.id });
        refreshTrades();
        toast(`AI couldn't match that counter (low balance). Trade declined.`);
        return;
      }
      if (humanBal < counterRequestedAmount) {
        await apiClient.post("/game-trade-requests/decline", { id: sentTrade.id });
        refreshTrades();
        toast(`AI counter needs $${counterRequestedAmount} from you, but you only have $${humanBal}. Trade declined.`);
        return;
      }
      try {
        // Backend aiCounter marks the original declined and inserts the new offer — do not decline first.
        await apiClient.post("/game-trade-requests/ai-counter", {
          original_trade_id: sentTrade.id,
          counter_offer_properties: sentTrade.requested_properties ?? [],
          counter_offer_amount: counterOfferAmount,
          counter_requested_properties: sentTrade.offer_properties ?? [],
          counter_requested_amount: counterRequestedAmount,
        });
        refreshTrades();
        toast(remark || "AI sent a counter.");
      } catch (e: unknown) {
        console.error("[instantAiRespondWhenTargetIsAi] AI counter failed:", e);
        try {
          await apiClient.post("/game-trade-requests/decline", { id: sentTrade.id });
        } catch {
          /* ignore */
        }
        refreshTrades();
        toast.error("AI counter failed; trade declined.");
      }
      return;
    }

    await apiClient.post("/game-trade-requests/decline", { id: sentTrade.id });
    refreshTrades();
    toast(remark || "AI declined the trade.");
  } catch (e) {
    console.error("[instantAiRespondWhenTargetIsAi]", e);
    try {
      await apiClient.post("/game-trade-requests/decline", { id: t.id });
      refreshTrades();
    } catch {
      /* ignore */
    }
    toast.error("Could not resolve AI trade response.");
  }
}
