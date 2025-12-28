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

  function findBestColorToComplete(
  aiProps: Property[],
  allProps: Property[],
  gameProps: GameProperty[],
  aiPlayer: Player
): number[] | null {
  const colorGroups = {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
  };

  let bestGroup: number[] | null = null;
  let mostOwned = 0;

  for (const group of Object.values(colorGroups)) {
    const ownedInGroup = group.filter(id => 
      aiProps.some(p => p.id === id)
    ).length;

    if (ownedInGroup > mostOwned && ownedInGroup < group.length) {
      mostOwned = ownedInGroup;
      bestGroup = group;
    }
  }

  // Prefer groups where AI has 2 out of 3
  if (mostOwned >= 2) return bestGroup;
  if (mostOwned === 1) return bestGroup; // fallback
  return null;
}

  // 5. AI Sends Trade Offer to Human
  const aiSendTradeOffer = useCallback(async () => {
  if (!currentPlayer || !me || Math.random() > 0.25) return; // reduce frequency a bit

  const aiOwned = game_properties
    .filter(gp => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() && !gp.mortgaged)
    .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id)! }))
    .filter(item => item.prop.price);

  const humanOwned = game_properties
    .filter(gp => gp.address?.toLowerCase() === me.address?.toLowerCase() && !gp.mortgaged)
    .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id)! }))
    .filter(item => item.prop.price);

  if (aiOwned.length < 1 || humanOwned.length < 1) return;

  // Goal: AI wants to complete a monopoly it’s close to
  const targetColor = findBestColorToComplete(aiOwned.map(o => o.prop), properties, game_properties, currentPlayer);

  if (!targetColor) return;

  const missingProps = targetColor.filter(id => 
    !aiOwned.some(o => o.prop.id === id)
  );

  if (missingProps.length === 0) return; // already has monopoly

  // Pick one missing property that human owns
  const desiredProp = humanOwned.find(h => missingProps.includes(h.prop.id));
  if (!desiredProp) return;

  // Offer 1–2 properties + cash to get that one key property
  // Choose decent (not cheapest) properties to offer
  const offerCandidates = aiOwned
    .filter(a => !targetColor.includes(a.prop.id)) // don't offer from same color
    .sort((a, b) => b.prop.price - a.prop.price); // better ones first

  const offerProps = offerCandidates.slice(0, Math.random() > 0.5 ? 2 : 1); // 1 or 2 props
  const baseCash = desiredProp.prop.price * 0.6; // offer ~60% of value in cash
  const cashOffer = Math.round(baseCash + Math.random() * 150);

  const totalOfferValue = offerProps.reduce((sum, o) => sum + o.prop.price, 0) + cashOffer;
  const targetValue = desiredProp.prop.price;

  // Only send if AI is offering at least 90% of value (slightly bad for human = tempting)
  if (totalOfferValue < targetValue * 0.9) return;

  const payload = {
    game_id: game.id,
    player_id: currentPlayer.user_id,
    target_player_id: me.user_id,
    offer_properties: offerProps.map(o => o.gp.property_id),
    offer_amount: cashOffer,
    requested_properties: [desiredProp.gp.property_id],
    requested_amount: 0,
    status: "pending",
  };

  try {
    await apiClient.post<ApiResponse>("/game-trade-requests", payload);
    toast.success(
      `AI ${currentPlayer.username} sent a trade offer for ${desiredProp.prop.name}!`,
      { duration: 6000 }
    );
  } catch (err) {
    console.error("Trade send failed", err);
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