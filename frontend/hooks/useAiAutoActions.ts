// hooks/useAIAutoActions.ts
import { useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { isAIPlayer } from "@/utils/gameUtils";

interface UseAIAutoActionsProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null; // Human player to target for trades
  currentPlayer: Player | null;
  isAITurn: boolean;
}

export const useAIAutoActions = ({
  game,
  properties,
  game_properties,
  me,
  currentPlayer,
  isAITurn,
}: UseAIAutoActionsProps) => {
  // AI helpers (reused/extended from existing code)
  const aiDowngradeHouses = useCallback(async (needed: number) => {
    if (!currentPlayer) return 0;
    const improved = game_properties
      .filter((gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() && (gp.development ?? 0) > 0)
      .sort((a, b) => {
        const pa = properties.find((p) => p.id === a.property_id);
        const pb = properties.find((p) => p.id === b.property_id);
        return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0);
      });

    let raised = 0;
    for (const gp of improved) {
      if (raised >= needed) break;
      const prop = properties.find((p) => p.id === gp.property_id);
      if (!prop?.cost_of_house) continue;

      const sellValue = Math.floor(prop.cost_of_house / 2);
      const houses = gp.development ?? 0;

      for (let i = 0; i < houses && raised < needed; i++) {
        try {
          await apiClient.post("/game-properties/downgrade", {
            game_id: game.id,
            user_id: currentPlayer.user_id,
            property_id: gp.property_id,
          });
          raised += sellValue;
          toast(`🤖 ${currentPlayer.username} sold a house on ${prop.name} (+$${sellValue})`);
        } catch (err) {
          console.error("AI downgrade failed", err);
          break;
        }
      }
    }
    return raised;
  }, [game.id, game_properties, properties, currentPlayer]);

  const aiMortgageProperties = useCallback(async (needed: number) => {
    if (!currentPlayer) return 0;
    const unmortgaged = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          !gp.mortgaged &&
          (gp.development ?? 0) === 0
      )
      .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
      .filter(({ prop }) => prop?.price)
      .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0));

    let raised = 0;
    for (const { gp, prop } of unmortgaged) {
      if (raised >= needed || !prop) break;
      const mortgageValue = Math.floor(prop.price / 2);
      try {
        await apiClient.post("/game-properties/mortgage", {
          game_id: game.id,
          user_id: currentPlayer.user_id,
          property_id: gp.property_id,
        });
        raised += mortgageValue;
        toast(`🤖 ${currentPlayer.username} mortgaged ${prop.name} (+$${mortgageValue})`);
      } catch (err) {
        console.error("AI mortgage failed", err);
      }
    }
    return raised;
  }, [game.id, game_properties, properties, currentPlayer]);

  // NEW: Smart build - prioritizes monopolies, builds evenly, up to 4 houses
  const aiBuildHouses = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 100) return; // Min cash threshold

    // Simple monopoly check: group by color_group_id (assume properties have color_group_id)
    const aiProps = game_properties.filter(
      (gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase()
    );

    const colorGroups: Record<number, GameProperty[]> = {};
    aiProps.forEach((gp) => {
      const prop = properties.find((p) => p.id === gp.property_id);
      const groupId = prop?.color_group_id ?? 0;
      if (!colorGroups[groupId]) colorGroups[groupId] = [];
      colorGroups[groupId].push(gp);
    });

    // Find full monopolies (owns all in group - simplistic: assume 2-3 props per group)
    const monopolies = Object.values(colorGroups).filter((group) => group.length >= 2);

    if (monopolies.length === 0) return;

    // Pick lowest developed monopoly
    const targetGroup = monopolies.sort((a, b) => {
      const avgDevA = a.reduce((sum, gp) => sum + (gp.development ?? 0), 0) / a.length;
      const avgDevB = b.reduce((sum, gp) => sum + (gp.development ?? 0), 0) / b.length;
      return avgDevA - avgDevB;
    })[0];

    // Build 1 house on lowest developed prop in group
    const targetProp = targetGroup.sort((a, b) => (a.development ?? 0) - (b.development ?? 0))[0];
    const prop = properties.find((p) => p.id === targetProp.property_id);
    if (!prop?.cost_of_house || (targetProp.development ?? 0) >= 4) return;

    try {
      await apiClient.post("/game-properties/development", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: targetProp.property_id,
      });
      toast(`🤖 ${currentPlayer.username} built a house on ${prop.name}! 🏠`);
    } catch (err) {
      console.error("AI build failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer]);

  // NEW: Smart unmortgage - highest rent first, if very rich
  const aiUnmortgageProperties = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 1000) return; // Need surplus

    const mortgaged = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          gp.mortgaged &&
          (gp.development ?? 0) === 0
      )
      .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
      .filter(({ prop }) => prop?.price)
      .sort((a, b) => (b.prop?.rent_1 || 0) - (a.prop?.rent_1 || 0)); // Highest rent first

    const target = mortgaged[0];
    if (!target) return;

    const unmortgageCost = Math.floor((target.prop?.price || 0) / 2) * 1.1; // +10% interest
    if (currentPlayer.balance < unmortgageCost) return;

    try {
      await apiClient.post("/game-properties/unmortgage", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast(`🤖 ${currentPlayer.username} unmortgaged ${target.prop?.name}! 💰`);
    } catch (err) {
      console.error("AI unmortgage failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer]);

  // NEW: AI initiates trade to human
  const aiInitiateTrade = useCallback(async () => {
    if (!currentPlayer || !me || game.players.length < 2) return;

    // Simple strategy: Offer $300 + my cheapest prop for human's most expensive prop they own (that I don't)
    const aiPropsIds = game_properties
      .filter((gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase())
      .map((gp) => gp.property_id)
      .sort((a, b) => {
        const pa = properties.find((p) => p.id === a)?.price || 0;
        const pb = properties.find((p) => p.id === b)?.price || 0;
        return pa - pb;
      });

    const humanProps = game_properties.filter(
      (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
    );
    const humanExpensive = humanProps
      .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
      .filter(({ prop }) => prop)
      .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0))[0];

    if (!humanExpensive || aiPropsIds.length === 0) return;

    const payload = {
      game_id: game.id,
      player_id: currentPlayer.user_id,
      target_player_id: me.user_id,
      offer_properties: [aiPropsIds[0]], // My cheapest
      offer_amount: 300,
      requested_properties: [humanExpensive.gp.property_id],
      requested_amount: 0,
      status: "pending",
    };

    try {
      const res = await apiClient.post("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success(
          `🤖 ${currentPlayer.username} sent you a trade offer! Check Trade Section 📈`,
          { duration: 5000 }
        );
      }
    } catch (err) {
      console.error("AI trade init failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer, me]);

  // Main AI decision tree - runs on AI turn start (post-move)
  const performAIActions = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance >= 0) {
      // Proactive: unmortgage if rich, build, trade
      if (currentPlayer.balance > 1500) {
        await aiUnmortgageProperties();
      }
      await aiBuildHouses();
      if (Math.random() < 0.3) { // 30% chance to trade proactively
        await aiInitiateTrade();
      }
    } else {
      // Emergency liquidation
      toast(`🤖 ${currentPlayer.username} in debt! Liquidating...`);
      const fromHouses = await aiDowngradeHouses(Infinity);
      const fromMortgage = await aiMortgageProperties(Infinity);
      toast(`🤖 Raised $${fromHouses + fromMortgage}`);
    }
  }, [
    currentPlayer,
    aiDowngradeHouses,
    aiMortgageProperties,
    aiUnmortgageProperties,
    aiBuildHouses,
    aiInitiateTrade,
  ]);

  // Trigger on AI turn (deps ensure post-roll/position update)
  useEffect(() => {
    if (isAITurn && currentPlayer && isAIPlayer(currentPlayer)) {
      const timeoutId = setTimeout(() => {
        performAIActions();
      }, 1000); // Slight delay for state sync

      return () => clearTimeout(timeoutId);
    }
  }, [isAITurn, currentPlayer?.position, currentPlayer?.balance, performAIActions]);
};