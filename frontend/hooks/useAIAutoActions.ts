// hooks/useAIAutoActions.ts
import { useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { ApiResponse } from "@/types/api";

interface UseAIAutoActionsProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  currentPlayer: Player | null;
  isAITurn: boolean;
}

const COLOR_GROUPS: Record<string, number[]> = {
  brown: [1, 3],
  lightblue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkblue: [37, 39],
};

export const useAIAutoActions = ({
  game,
  properties,
  game_properties,
  me,
  currentPlayer,
  isAITurn,
}: UseAIAutoActionsProps) => {
  const isAI = currentPlayer?.username.toLowerCase().includes("ai") || false;

  // Helper: Does AI own full monopoly?
  const hasMonopoly = useCallback((color: string): boolean => {
    if (!currentPlayer) return false;
    const group = COLOR_GROUPS[color];
    if (!group) return false;

    return group.every(id =>
      game_properties.some(gp => gp.property_id === id && gp.address === currentPlayer.address)
    );
  }, [currentPlayer, game_properties]);

  // Helper: Can build on this property?
  const canBuildOn = useCallback((gp: GameProperty, prop: Property): boolean => {
    const color = prop.color;
    if (!color || !COLOR_GROUPS[color]) return false;
    return hasMonopoly(color) && !gp.mortgaged && (gp.development ?? 0) < 5;
  }, [hasMonopoly]);

  // 1. PRIORITY: Build houses aggressively on monopolies
  const aiBuildHouses = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 300) return;

    const buildable = game_properties
      .filter(gp => gp.address === currentPlayer.address && !gp.mortgaged)
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!,
      }))
      .filter(({ prop, gp }) => prop?.cost_of_house && canBuildOn(gp, prop));

    if (buildable.length === 0) return;

    // Prioritize best sets: orange/red > yellow > green > etc.
    const priorityOrder = ['orange', 'red', 'yellow', 'green', 'lightblue', 'pink', 'brown', 'darkblue'];
    buildable.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.prop.color || '');
      const bPriority = priorityOrder.indexOf(b.prop.color || '');
      return aPriority - bPriority;
    });

    const target = buildable[0];
    if (currentPlayer.balance < (target.prop.cost_of_house || 0)) return;

    try {
      await apiClient.post("/game-properties/development", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast.success(`AI ${currentPlayer.username} built on ${target.prop.name}! 🏠`);
    } catch (err) {
      console.error("Build failed", err);
    }
  }, [game.id, currentPlayer, game_properties, properties, canBuildOn]);

  // 2. Unmortgage valuable properties
  const aiUnmortgage = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 800) return;

    const mortgaged = game_properties
      .filter(gp => gp.address === currentPlayer.address && gp.mortgaged)
      .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id)! }))
      .filter(item => item.prop?.price);

    if (mortgaged.length === 0) return;

    mortgaged.sort((a, b) => (b.prop.rent_hotel || 0) - (a.prop.rent_hotel || 0));

    const target = mortgaged[0];
    const cost = Math.floor((target.prop.price / 2) * 1.1);
    if (currentPlayer.balance < cost) return;

    try {
      await apiClient.post("/game-properties/unmortgage", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast(`AI ${currentPlayer.username} unmortgaged ${target.prop.name}`);
    } catch (err) {
      console.error("Unmortgage failed", err);
    }
  }, [game.id, currentPlayer, game_properties, properties]);

  // 3. SMART TRADING: Only offer fair deals to complete monopolies
  const aiSendTradeOffer = useCallback(async () => {
    if (!currentPlayer || Math.random() > 0.3) return;

    const otherPlayers = game.players.filter(
      p => p.user_id !== currentPlayer.user_id && (p.balance ?? 0) > 200
    );
    if (otherPlayers.length === 0) return;

    const targetPlayer = me && Math.random() < 0.7
      ? me
      : otherPlayers[Math.floor(Math.random() * otherPlayers.length)];

    const aiOwnedProps = game_properties
      .filter(gp => gp.address === currentPlayer.address && !gp.mortgaged)
      .map(gp => properties.find(p => p.id === gp.property_id)!)
      .filter(Boolean);

    // Find color where AI is 1 property away from monopoly
    let bestColor: string | null = null;
    let missingId: number | null = null;

    for (const [color, ids] of Object.entries(COLOR_GROUPS)) {
      const owned = ids.filter(id => aiOwnedProps.some(p => p.id === id)).length;
      if (owned === ids.length - 1) {
        const missing = ids.find(id => !aiOwnedProps.some(p => p.id === id));
        if (missing !== undefined) {
          const ownedByTarget = game_properties.find(
            gp => gp.property_id === missing && gp.address === targetPlayer.address
          );
          if (ownedByTarget) {
            bestColor = color;
            missingId = missing;
            break;
          }
        }
      }
    }

    if (!bestColor || missingId === null) return;

    const desiredProp = properties.find(p => p.id === missingId)!;

    // Offer fair value: 100–130% of property price
    const targetValue = desiredProp.price || 0;
    const cashOffer = Math.round(targetValue * (1.0 + Math.random() * 0.3));

    // Or add properties to sweeten the deal
    const offerCandidates = aiOwnedProps
      .filter(p => p.color && !COLOR_GROUPS[p.color]?.includes(missingId))
      .sort((a, b) => (b.price || 0) - (a.price || 0));

    const offerProps = offerCandidates.slice(0, cashOffer < targetValue ? 2 : 1);

    const totalOfferValue = offerProps.reduce((sum, p) => sum + (p.price || 0), 0) + cashOffer;
    if (totalOfferValue < targetValue * 0.95) return; // Don't underpay

    const payload = {
      game_id: game.id,
      player_id: currentPlayer.user_id,
      target_player_id: targetPlayer.user_id,
      offer_properties: offerProps.map(p => p.id),
      offer_amount: cashOffer,
      requested_properties: [missingId],
      requested_amount: 0,
      status: "pending",
    };

    try {
      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success(
          `AI ${currentPlayer.username} offered a fair trade to ${targetPlayer.username} for ${desiredProp.name}!`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error("Trade send failed", err);
    }
  }, [game, properties, game_properties, currentPlayer, me]);

  // 4. Auto-handle incoming trades
  const aiHandlePendingTrades = useCallback(async () => {
    if (!currentPlayer) return;

    try {
      const res = await apiClient.get<ApiResponse>(
        `/game-trade-requests?game_id=${game.id}&target_player_id=${currentPlayer.user_id}&status=pending`
      );
      if (!res?.data?.success || !Array.isArray(res.data.data)) return;

      for (const trade of res.data.data) {
        const offerValue = (trade.offer_amount || 0) +
          (trade.offer_properties || []).reduce((sum: number, id: number) => {
            const p = properties.find(p => p.id === id);
            return sum + (p?.price || 0);
          }, 0);

        const requestValue = (trade.requested_amount || 0) +
          (trade.requested_properties || []).reduce((sum: number, id: number) => {
            const p = properties.find(p => p.id === id);
            return sum + (p?.price || 0);
          }, 0);

        const isGoodDeal = requestValue === 0 || offerValue >= requestValue * 0.9;

        const sender = game.players.find(p => p.user_id === trade.player_id)?.username || "Someone";

        if (isGoodDeal) {
          await apiClient.post(`/game-trade-requests/${trade.id}/accept`);
          toast.success(`AI ${currentPlayer.username} accepted great deal from ${sender}!`);
        } else {
          await apiClient.post(`/game-trade-requests/${trade.id}/decline`);
          toast(`AI ${currentPlayer.username} declined weak offer from ${sender}`);
        }
      }
    } catch (err) {
      console.error("Trade handling failed", err);
    }
  }, [game.id, currentPlayer, game.players, properties]);

  // Liquidation when in debt
  const aiLiquidate = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance >= 0) return;

    toast(`AI ${currentPlayer.username} is broke — liquidating!`);
    // Sell houses
    const improved = game_properties.filter(
      gp => gp.address === currentPlayer.address && (gp.development ?? 0) > 0
    );
    for (const gp of improved) {
      await apiClient.post("/game-properties/downgrade", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: gp.property_id,
      });
    }
    // Mortgage remaining
    const unmortgaged = game_properties.filter(
      gp => gp.address === currentPlayer.address && !gp.mortgaged && (gp.development ?? 0) === 0
    );
    for (const gp of unmortgaged) {
      await apiClient.post("/game-properties/mortgage", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: gp.property_id,
      });
    }
  }, [game.id, currentPlayer, game_properties]);

  // Main AI turn logic
  const runAITurnActions = useCallback(async () => {
    if (!isAITurn || !currentPlayer || !isAI) return;

    if (currentPlayer.balance < 0) {
      await aiLiquidate();
      return;
    }

    await aiHandlePendingTrades();
    await aiBuildHouses();     // Highest priority
    await aiUnmortgage();
    await aiSendTradeOffer();  // Only smart, fair offers
  }, [
    isAITurn,
    currentPlayer,
    isAI,
    aiLiquidate,
    aiHandlePendingTrades,
    aiBuildHouses,
    aiUnmortgage,
    aiSendTradeOffer,
  ]);

  useEffect(() => {
    if (isAITurn && currentPlayer && isAI) {
      const timer = setTimeout(runAITurnActions, 1200);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer?.user_id, runAITurnActions]);
};