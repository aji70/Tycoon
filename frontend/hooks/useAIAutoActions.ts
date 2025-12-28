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

// High-value sets first (classic Monopoly jail landing strategy)
const BUILD_PRIORITY_COLORS = ["orange", "red", "yellow", "green", "lightblue", "pink", "darkblue", "brown"];

export const useAIAutoActions = ({
  game,
  properties,
  game_properties,
  me,
  currentPlayer,
  isAITurn,
}: UseAIAutoActionsProps) => {
  const isAI = currentPlayer && (currentPlayer.username.toLowerCase().includes("ai") || currentPlayer.address?.startsWith("0xAI"));

  // Does AI own full monopoly?
  const hasMonopoly = useCallback((color: string): boolean => {
    const group = COLOR_GROUPS[color];
    if (!group || !currentPlayer) return false;
    return group.every(id =>
      game_properties.some(gp => gp.property_id === id && gp.address === currentPlayer.address && !gp.mortgaged)
    );
  }, [currentPlayer, game_properties]);

  // Can safely build on this property?
  const canBuildOn = useCallback((gp: GameProperty, prop: Property): boolean => {
    return !!prop.color && hasMonopoly(prop.color) && !gp.mortgaged && (gp.development ?? 0) < 5;
  }, [hasMonopoly]);

  // 1. HIGHEST PRIORITY: Build houses if safe to do so
  const aiBuildHouses = useCallback(async () => {
    if (!currentPlayer || !isAI) return;

    const balance = currentPlayer.balance ?? 0;
    const houseCostThreshold = 400; // Keep at least this much as buffer
    const minSafeBalance = 600;

    if (balance < minSafeBalance) return;

    const buildable = game_properties
      .filter(gp => gp.address === currentPlayer.address)
      .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id)! }))
      .filter(({ gp, prop }) => prop?.cost_of_house && canBuildOn(gp, prop));

    if (buildable.length === 0) return;

    // Sort by priority color + even development
    buildable.sort((a, b) => {
      const aPriority = BUILD_PRIORITY_COLORS.indexOf(a.prop.color || "");
      const bPriority = BUILD_PRIORITY_COLORS.indexOf(b.prop.color || "");
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Even out houses in same group
      return (a.gp.development ?? 0) - (b.gp.development ?? 0);
    });

    const target = buildable[0];
    const houseCost = target.prop.cost_of_house!;

    if (balance - houseCost < houseCostThreshold) return; // Don't go below buffer

    try {
      await apiClient.post("/game-properties/development", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast.success(`${currentPlayer.username} built a house on ${target.prop.name}! 🏠`);
    } catch (err) {
      console.error("AI build failed", err);
    }
  }, [currentPlayer, game.id, game_properties, properties, canBuildOn, isAI]);

  // 2. SMART TRADING: Aggressively try to complete monopolies
  const aiSendTradeOffer = useCallback(async () => {
    if (!currentPlayer || !isAI || Math.random() > 0.45) return; // ~55% chance per turn

    const opponents = game.players.filter(p => p.user_id !== currentPlayer.user_id && (p.balance ?? 0) > 150);
    if (opponents.length === 0) return;

    const targetPlayer = opponents[Math.floor(Math.random() * opponents.length)];

    // Find best missing property to complete a set
    let bestMissingProp: Property | null = null;
    let bestColor = "";
    let currentOwnedInGroup = 0;

    for (const [color, ids] of Object.entries(COLOR_GROUPS)) {
      const owned = ids.filter(id =>
        game_properties.some(gp => gp.property_id === id && gp.address === currentPlayer.address)
      ).length;

      if (owned === ids.length - 1) {
        const missingId = ids.find(id => !game_properties.some(gp => gp.property_id === id && gp.address === currentPlayer.address));
        const missingProp = properties.find(p => p.id === missingId);
        const ownedByTarget = game_properties.find(gp => gp.property_id === missingId && gp.address === targetPlayer.address);

        if (missingProp && ownedByTarget) {
          const priority = BUILD_PRIORITY_COLORS.indexOf(color);
          if (!bestMissingProp || priority < BUILD_PRIORITY_COLORS.indexOf(bestColor)) {
            bestMissingProp = missingProp;
            bestColor = color;
            currentOwnedInGroup = owned;
          }
        }
      }
    }

    if (!bestMissingProp) return;

    const desiredPrice = bestMissingProp.price || 200;
    const cashOffer = Math.round(desiredPrice * (1.1 + Math.random() * 0.3)); // 110–140% value

    // Sweeten with extra cash or low-value property
    const extraCash = currentPlayer.balance > 1000 ? Math.round(Math.random() * 200) : 0;

    const payload = {
      game_id: game.id,
      player_id: currentPlayer.user_id,
      target_player_id: targetPlayer.user_id,
      offer_properties: [],
      offer_amount: cashOffer + extraCash,
      requested_properties: [bestMissingProp.id],
      requested_amount: 0,
      status: "pending",
    };

    try {
      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success(
          `${currentPlayer.username} offered $${cashOffer + extraCash} to ${targetPlayer.username} for ${bestMissingProp.name}! 🎯`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error("Trade offer failed", err);
    }
  }, [currentPlayer, game, properties, game_properties, isAI]);

  // 3. Accept good incoming trades
  const aiEvaluateIncomingTrades = useCallback(async () => {
    if (!currentPlayer || !isAI) return;

    try {
      const res = await apiClient.get<ApiResponse>(
        `/game-trade-requests?game_id=${game.id}&target_player_id=${currentPlayer.user_id}&status=pending`
      );

      const trades = res?.data?.data || [];
      for (const trade of trades) {
        const offeredValue = (trade.offer_amount || 0) +
          (trade.offer_properties || []).reduce((sum: number, id: number) =>
            sum + (properties.find(p => p.id === id)?.price || 0), 0);

        const requestedValue = (trade.requested_amount || 0) +
          (trade.requested_properties || []).reduce((sum: number, id: number) =>
            sum + (properties.find(p => p.id === id)?.price || 0), 0);

        // AI accepts if getting ≥95% value, or if it completes a monopoly
        const completesMonopoly = (trade.offer_properties || []).some((id: number) => {
          const prop = properties.find(p => p.id === id);
          if (!prop?.color) return false;
          const group = COLOR_GROUPS[prop.color];
          return group.length - 1 === group.filter(gid =>
            game_properties.some(gp => gp.property_id === gid && gp.address === currentPlayer.address)
          ).length;
        });

        const isFair = offeredValue >= requestedValue * 0.95 || completesMonopoly;

        const action = isFair ? "accept" : "decline";
        await apiClient.post(`/game-trade-requests/${trade.id}/${action}`);

        toast(`${currentPlayer.username} ${isFair ? "accepted ✅" : "declined ❌"} trade from ${game.players.find(p => p.user_id === trade.player_id)?.username}`);
      }
    } catch (err) {
      console.error("Trade evaluation failed", err);
    }
  }, [currentPlayer, game, properties, game_properties, isAI]);

  // Main AI decision loop
  const runAITurn = useCallback(async () => {
    if (!isAITurn || !currentPlayer || !isAI) return;

    // 1. Always check/accept good incoming trades first
    await aiEvaluateIncomingTrades();

    // 2. Build houses aggressively if safe
    await aiBuildHouses();

    // 3. Try to trade for missing monopoly pieces
    await aiSendTradeOffer();
  }, [isAITurn, currentPlayer, isAI, aiEvaluateIncomingTrades, aiBuildHouses, aiSendTradeOffer]);

  // Run on AI turn with slight delay for natural feel
  useEffect(() => {
    if (isAITurn && currentPlayer && isAI) {
      const timer = setTimeout(runAITurn, 1400);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer?.user_id, runAITurn]);
};