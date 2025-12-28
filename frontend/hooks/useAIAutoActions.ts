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
  me: Player | null;           // Human player (for targeting trades)
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
  // Helper: is this an AI player?
  const isAI = currentPlayer?.username.toLowerCase().includes("ai") || false;

  // 1. AI Sell Houses (when in debt)
  const aiSellHouses = useCallback(async (needed = Infinity) => {
    if (!currentPlayer) return 0;

    const improved = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          (gp.development ?? 0) > 0
      )
      .sort((a, b) => {
        const pa = properties.find((p) => p.id === a.property_id);
        const pb = properties.find((p) => p.id === b.property_id);
        return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0); // sell most valuable rent first
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
          toast(`AI ${currentPlayer.username} sold a house on ${prop.name} (+$${sellValue})`);
        } catch (err) {
          console.error("AI failed to downgrade", err);
          break;
        }
      }
    }
    return raised;
  }, [game.id, game_properties, properties, currentPlayer]);

  // 2. AI Mortgage Properties (when in debt)
  const aiMortgage = useCallback(async (needed = Infinity) => {
    if (!currentPlayer) return 0;

    const unmortgaged = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          !gp.mortgaged &&
          (gp.development ?? 0) === 0
      )
      .map((gp) => ({
        gp,
        prop: properties.find((p) => p.id === gp.property_id),
      }))
      .filter((item) => item.prop?.price)
      .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0)); // highest value first

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
        toast(`AI ${currentPlayer.username} mortgaged ${prop.name} (+$${mortgageValue})`);
      } catch (err) {
        console.error("AI failed to mortgage", err);
      }
    }
    return raised;
  }, [game.id, game_properties, properties, currentPlayer]);

  // 3. AI Build Houses (proactive when rich)
  const aiBuildHouses = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 800) return;

    // Find properties AI owns with development < 4 (no hotel yet)
    const buildable = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          !gp.mortgaged &&
          (gp.development ?? 0) < 4
      )
      .map((gp) => ({
        gp,
        prop: properties.find((p) => p.id === gp.property_id),
      }))
      .filter((item) => item.prop?.cost_of_house && item.prop.price > 0);

    if (buildable.length === 0) return;

    // Simple strategy: build on cheapest house cost first (greedy even build)
    const target = buildable.sort((a, b) => (a.prop?.cost_of_house || 0) - (b.prop?.cost_of_house || 0))[0];
    if (!target.prop) return;

    try {
      await apiClient.post("/game-properties/development", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast(`AI ${currentPlayer.username} built a house on ${target.prop.name}!`);
    } catch (err) {
      console.error("AI build failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer]);

  // 4. AI Unmortgage (when very rich)
  const aiUnmortgage = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 1200) return;

    const mortgaged = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          gp.mortgaged
      )
      .map((gp) => ({
        gp,
        prop: properties.find((p) => p.id === gp.property_id),
      }))
      .filter((item) => item.prop?.price);

    if (mortgaged.length === 0) return;

    // Unmortgage highest base rent first
    const target = mortgaged.sort((a, b) => (b.prop?.rent_site_only || 0) - (a.prop?.rent_site_only || 0))[0];
    if (!target.prop) return;

    const cost = Math.floor((target.prop.price / 2) * 1.1); // +10% interest
    if (currentPlayer.balance < cost) return;

    try {
      await apiClient.post("/game-properties/unmortgage", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast(`AI ${currentPlayer.username} redeemed ${target.prop.name} from mortgage!`);
    } catch (err) {
      console.error("AI unmortgage failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer]);

  // 5. AI Sends Trade Offer to Human
  const aiSendTradeOffer = useCallback(async () => {
    if (!currentPlayer || !me || Math.random() > 0.35) return; // ~35% chance per turn

    // AI offers: one of its properties + some cash for one of human's good properties
    const aiOwned = game_properties.filter(
      (gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase()
    );
    const humanOwned = game_properties.filter(
      (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
    );

    if (aiOwned.length === 0 || humanOwned.length === 0) return;

    // Pick AI's cheapest property to offer
    const aiOfferProp = aiOwned
      .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
      .sort((a, b) => (a.prop?.price || 0) - (b.prop?.price || 0))[0];

    // Pick human's most expensive property to request
    const humanTarget = humanOwned
      .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
      .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0))[0];

    if (!aiOfferProp || !humanTarget) return;

    const payload = {
      game_id: game.id,
      player_id: currentPlayer.user_id,
      target_player_id: me.user_id,
      offer_properties: [aiOfferProp.gp.property_id],
      offer_amount: 200 + Math.floor(Math.random() * 200), // $200–400
      requested_properties: [humanTarget.gp.property_id],
      requested_amount: 0,
      status: "pending",
    };

    try {
      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success(
          `AI ${currentPlayer.username} sent you a trade offer! Check the Trade section.`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error("AI failed to send trade", err);
    }
  }, [game.id, game_properties, properties, currentPlayer, me]);

  // Main AI Turn Logic
  const runAITurnActions = useCallback(async () => {
    if (!isAITurn || !currentPlayer || !isAI) return;

    // If in debt → liquidate
    if (currentPlayer.balance < 0) {
      toast(`AI ${currentPlayer.username} is in debt! Liquidating assets...`);
      await aiSellHouses(Infinity);
      await aiMortgage(Infinity);
      return;
    }

    // Otherwise → play smart
    await aiUnmortgage();
    await aiBuildHouses();
    await aiSendTradeOffer();
  }, [
    isAITurn,
    currentPlayer,
    isAI,
    aiSellHouses,
    aiMortgage,
    aiUnmortgage,
    aiBuildHouses,
    aiSendTradeOffer,
  ]);

  // Trigger after turn starts (small delay for state sync)
  useEffect(() => {
    if (isAITurn && currentPlayer && isAI) {
      const timer = setTimeout(runAITurnActions, 1200);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer?.user_id, runAITurnActions]);
};