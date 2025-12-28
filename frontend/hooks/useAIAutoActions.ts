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
  onActionsComplete?: () => void; // NEW: Callback to signal AI finished pre-roll actions
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

// Priority order: highest ROI + jail landing frequency
const BUILD_PRIORITY_COLORS = ["orange", "red", "yellow", "green", "lightblue", "pink", "darkblue", "brown"];

export const useAIAutoActions = ({
  game,
  properties,
  game_properties,
  me,
  currentPlayer,
  isAITurn,
  onActionsComplete,
}: UseAIAutoActionsProps) => {
  const isAI = currentPlayer && (
    currentPlayer.username.toLowerCase().includes("ai_") ||
    currentPlayer.address?.startsWith("0xAI") ||
    currentPlayer.address?.startsWith("0xai") 
  );

  // Does AI own full, unmortgaged monopoly?
  const hasMonopoly = useCallback((color: string): boolean => {
    const group = COLOR_GROUPS[color];
    if (!group || !currentPlayer) return false;

    return group.every(id =>
      game_properties.some(
        gp => gp.property_id === id &&
              gp.address === currentPlayer.address &&
              !gp.mortgaged
      )
    );
  }, [currentPlayer, game_properties]);

  // Can safely build on this property?
  const canBuildOn = useCallback((gp: GameProperty, prop: Property): boolean => {
    return !!prop.color &&
           hasMonopoly(prop.color) &&
           !gp.mortgaged &&
           (gp.development ?? 0) < 5;
  }, [hasMonopoly]);

  // 1. BUILD HOUSES — Aggressive but safe
  const aiBuildHouses = useCallback(async () => {
    if (!currentPlayer || !isAI) return;

    const balance = currentPlayer.balance ?? 0;
    if (balance < 300) return; // Too broke

    const buildable = game_properties
      .filter(gp => gp.address === currentPlayer.address)
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!
      }))
      .filter(({ gp, prop }) => prop?.cost_of_house && canBuildOn(gp, prop));

    if (buildable.length === 0) return;

    // Sort: highest priority color first, then even out houses in group
    buildable.sort((a, b) => {
      const aPriority = BUILD_PRIORITY_COLORS.indexOf(a.prop.color || "");
      const bPriority = BUILD_PRIORITY_COLORS.indexOf(b.prop.color || "");
      if (aPriority !== bPriority) return aPriority - bPriority;

      return (a.gp.development ?? 0) - (b.gp.development ?? 0); // Even development
    });

    const target = buildable[0];
    const houseCost = target.prop.cost_of_house!;

    // Only build if we keep at least $150–250 buffer (randomized for variety)
    const buffer = 150 + Math.floor(Math.random() * 100);
    if (balance - houseCost < buffer) return;

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

  // 2. SEND TRADE OFFERS — Aggressively complete monopolies
  const aiSendTradeOffer = useCallback(async () => {
    if (!currentPlayer || !isAI || Math.random() > 0.6) return; // ~40% chance per turn

    const opponents = game.players.filter(
      p => p.user_id !== currentPlayer.user_id && (p.balance ?? 0) > 100
    );
    if (opponents.length === 0) return;

    const targetPlayer = opponents[Math.floor(Math.random() * opponents.length)];

    // Find the best property to complete a monopoly
    let bestMissingProp: Property | null = null;
    let highestPriority = 999;

    for (const [color, ids] of Object.entries(COLOR_GROUPS)) {
      const owned = ids.filter(id =>
        game_properties.some(gp => gp.property_id === id && gp.address === currentPlayer.address)
      ).length;

      if (owned === ids.length - 1) { // Missing exactly one
        const missingId = ids.find(id =>
          !game_properties.some(gp => gp.property_id === id && gp.address === currentPlayer.address)
        )!;
        const missingProp = properties.find(p => p.id === missingId);
        const ownedByTarget = game_properties.find(
          gp => gp.property_id === missingId && gp.address === targetPlayer.address
        );

        if (missingProp && ownedByTarget) {
          const priority = BUILD_PRIORITY_COLORS.indexOf(color);
          if (priority < highestPriority) {
            bestMissingProp = missingProp;
            highestPriority = priority;
          }
        }
      }
    }

    if (!bestMissingProp) return;

    const basePrice = bestMissingProp.price || 200;
    const cashOffer = Math.round(basePrice * (1.2 + Math.random() * 0.4)); // 120–160% of value

    // Sweeten deal if AI is rich
    const extraCash = currentPlayer.balance > 800 ? Math.round(Math.random() * 150) : 0;

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
          `${currentPlayer.username} offered $${cashOffer + extraCash} for ${bestMissingProp.name} from ${targetPlayer.username}! 🎯`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error("AI trade offer failed", err);
    }
  }, [currentPlayer, game, properties, game_properties, isAI]);

  // 3. EVALUATE & RESPOND TO INCOMING TRADES
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

        // Does this complete a monopoly for AI?
        const completesMonopoly = (trade.offer_properties || []).some((id: number) => {
          const prop = properties.find(p => p.id === id);
          if (!prop?.color) return false;
          const group = COLOR_GROUPS[prop.color];
          if (!group) return false;

          const currentlyOwned = group.filter(gid =>
            game_properties.some(gp => gp.property_id === gid && gp.address === currentPlayer.address)
          ).length;

          return currentlyOwned === group.length - 1;
        });

        const valueRatio = offeredValue / (requestedValue || 1);
        const isGoodDeal = valueRatio >= 1.0 || completesMonopoly;
        const isFairDeal = valueRatio >= 0.85 || completesMonopoly;

        const acceptChance = completesMonopoly ? 0.95 :
                             isGoodDeal ? 0.9 :
                             isFairDeal ? 0.6 : 0.1;

        const shouldAccept = Math.random() < acceptChance;

        const action = shouldAccept ? "accept" : "decline";

        await apiClient.post(`/game-trade-requests/${trade.id}/${action}`);

        const fromPlayer = game.players.find(p => p.user_id === trade.player_id)?.username || "Someone";

        toast.success(
          `${currentPlayer.username} ${shouldAccept ? "accepted ✅" : "declined ❌"} trade from ${fromPlayer}`
        );
      }
    } catch (err) {
      console.error("AI trade evaluation failed", err);
    }
  }, [currentPlayer, game, properties, game_properties, isAI]);

  // Main AI decision loop — runs BEFORE rolling
  const runAITurn = useCallback(async () => {
    if (!isAITurn || !currentPlayer || !isAI) return;

    await aiEvaluateIncomingTrades();
    await new Promise(r => setTimeout(r, 600));

    await aiBuildHouses();
    await new Promise(r => setTimeout(r, 500));

    await aiSendTradeOffer();

    // SIGNAL: All pre-roll actions are complete
    onActionsComplete?.();
  }, [
    isAITurn,
    currentPlayer,
    isAI,
    aiEvaluateIncomingTrades,
    aiBuildHouses,
    aiSendTradeOffer,
    onActionsComplete
  ]);

  // Run actions IMMEDIATELY when it's AI's turn
  useEffect(() => {
    if (isAITurn && currentPlayer && isAI) {
      runAITurn();
    }
  }, [isAITurn, currentPlayer?.user_id, runAITurn]);
};