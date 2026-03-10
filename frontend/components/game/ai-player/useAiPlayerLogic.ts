"use client";

import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Game, Player, Property, GameProperty } from "@/types/game";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAIGameAndClaim, useGetGameByCode } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useGameTrades } from "@/hooks/useGameTrades";
import {
  isAIPlayer,
  calculateAiFavorability,
  getAiSlotFromPlayer,
  TRADE_ACCEPT_STRONG,
  TRADE_ACCEPT_FAIR,
  TRADE_COUNTER_THRESHOLD,
} from "@/utils/gameUtils";

export interface UseAiPlayerLogicProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  currentPlayer: Player | null;
  isAITurn: boolean;
}

export function useAiPlayerLogic({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  isAITurn,
}: UseAiPlayerLogicProps) {
  const queryClient = useQueryClient();
  const [tradeModal, setTradeModal] = useState<{ open: boolean; target: Player | null }>({
    open: false,
    target: null,
  });
  const [counterModal, setCounterModal] = useState<{ open: boolean; trade: any | null }>({
    open: false,
    trade: null,
  });
  const [aiResponsePopup, setAiResponsePopup] = useState<any | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
    validWin?: boolean; // true if winner has >= 20 turns, false otherwise
  }>({ winner: null, position: 0, balance: BigInt(0), validWin: true });

  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState<number>(0);
  const [requestCash, setRequestCash] = useState<number>(0);

  const { data: contractGame } = useGetGameByCode(game?.code, { enabled: !!game?.code });
  const onChainGameId = contractGame?.id;
  const canClaimAIGameOnChain = !!(contractGame?.id && contractGame.id !== BigInt(0) && contractGame.ai);

  const endGameHook = useEndAIGameAndClaim(
    onChainGameId ?? BigInt(0),
    endGameCandidate.position,
    BigInt(endGameCandidate.balance),
    // Use validWin: if winner has < 20 turns, pass false to prevent spam, but still show them as winner
    endGameCandidate.winner ? (endGameCandidate.validWin !== false) : false
  );

  const {
    openTrades,
    tradeRequests,
    aiTradePopup,
    closeAiTradePopup,
    refreshTrades,
  } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

  const toggleEmpire = useCallback(() => {}, []); // no-op; caller manages showEmpire
  const toggleTrade = useCallback(() => {}, []); // no-op; caller manages showTrade
  const isNext = !!me && game.next_player_id === me.user_id;

  const resetTradeFields = useCallback(() => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  }, []);

  const toggleSelect = useCallback(
    (id: number, arr: number[], setter: React.Dispatch<React.SetStateAction<number[]>>) => {
      setter((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    },
    []
  );

  const startTrade = useCallback(
    (targetPlayer: Player) => {
      if (!isNext) {
        toast.error("Not your turn!");
        return;
      }
      if (!targetPlayer || targetPlayer.user_id == null) {
        toast.error("Invalid player");
        return;
      }
      // Clone to a plain object so modal/children don't hit reactive proxy or missing-field issues
      const target: Player = {
        ...targetPlayer,
        address: targetPlayer.address ?? "",
        username: targetPlayer.username ?? "Player",
        balance: targetPlayer.balance ?? 0,
        symbol: targetPlayer.symbol ?? "hat",
      };
      setTradeModal({ open: true, target });
      resetTradeFields();
    },
    [isNext, resetTradeFields]
  );

  /** Connected player first, then others by turn order */
  const sortedPlayers = useMemo(() => {
    const list = [...(game?.players ?? [])];
    return list.sort((a, b) => {
      if (me && a.user_id === me.user_id) return -1;
      if (me && b.user_id === me.user_id) return 1;
      return (a.turn_order ?? Infinity) - (b.turn_order ?? Infinity);
    });
  }, [game?.players, me?.user_id]);

  const handleCreateTrade = useCallback(async () => {
    if (!me || !tradeModal.target) return;

    const targetPlayer = tradeModal.target;
    const isAI = isAIPlayer(targetPlayer);

    try {
      const payload = {
        game_id: game.id,
        player_id: me.user_id,
        target_player_id: targetPlayer.user_id,
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "pending",
      };

      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        refreshTrades();

        // AI-only: auto-respond to trade; never run in multiplayer
        if (game.is_ai !== false && isAI) {
          const tradeId = res.data?.data?.id ?? Date.now();
          const sentTrade = {
            ...payload,
            id: typeof tradeId === "number" ? tradeId : Number(tradeId),
          };

          let favorability = 0;
          let decision: "accepted" | "declined" | "countered" = "declined";
          let remark = "";
          let counterCashAdjustment: number | null = null;

          try {
            favorability = calculateAiFavorability(sentTrade, properties ?? []);

            // Optional Celo agent: try agent-registry first; fallback to built-in logic
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
                    remark = agentRes?.data?.useBuiltIn === false ? "Celo agent accepted. 🤖" : remark;
                  } else if (actionLower === "decline") {
                    decision = "declined";
                    remark = agentRes?.data?.useBuiltIn === false ? "Celo agent declined." : remark;
                  } else if (actionLower === "counter") {
                    decision = "countered";
                    counterCashAdjustment = counterOffer?.cashAdjustment ?? 0;
                    remark = (counterOffer?.cashAdjustment != null && counterOffer.cashAdjustment !== 0)
                      ? `Not quite — I'm countering. ${counterOffer.cashAdjustment > 0 ? `I want $${counterOffer.cashAdjustment} more.` : `I'll add $${Math.abs(counterOffer.cashAdjustment)}.`}`
                      : "Not quite — here's my counter offer.";
                  }
                }
              } catch (err) {
                console.warn("[useAiPlayerLogic] Agent call failed, using built-in logic:", err);
              }
            }

            if (remark === "") {
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

            if (decision === "accepted") {
              await apiClient.post("/game-trade-requests/accept", { id: sentTrade.id });
              refreshTrades();
            } else if (decision === "countered") {
              const adj = counterCashAdjustment ?? 0;
              const counterOfferAmount = Math.max(0, (sentTrade.requested_amount ?? 0) - adj);
              const counterRequestedAmount = (sentTrade.offer_amount ?? 0) + adj;
              try {
                await apiClient.post("/game-trade-requests/decline", { id: sentTrade.id });
                await apiClient.post("/game-trade-requests/ai-counter", {
                  original_trade_id: sentTrade.id,
                  counter_offer_properties: sentTrade.requested_properties ?? [],
                  counter_offer_amount: counterOfferAmount,
                  counter_requested_properties: sentTrade.offer_properties ?? [],
                  counter_requested_amount: counterRequestedAmount,
                });
                refreshTrades();
              } catch (counterErr: any) {
                console.error("[useAiPlayerLogic] AI counter failed:", counterErr);
                decision = "declined";
                remark = "Counter failed; offer declined.";
              }
            }

            setAiResponsePopup({
              trade: sentTrade,
              favorability,
              decision,
              remark,
            });
          } catch (aiErr: any) {
            console.error("[useAiPlayerLogic] AI trade response error:", aiErr);
            toast.error("Trade sent, but AI response could not be shown.");
            setAiResponsePopup({
              trade: sentTrade,
              favorability: 0,
              decision: "declined",
              remark: "Something went wrong.",
            });
          }
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create trade");
    }
  }, [
    me,
    tradeModal.target,
    game.id,
    game.is_ai,
    game.players,
    game_properties,
    offerProperties,
    offerCash,
    requestProperties,
    requestCash,
    properties,
    resetTradeFields,
    refreshTrades,
  ]);

  const handleTradeAction = useCallback(
    async (id: number, action: "accepted" | "declined" | "counter" | "delete") => {
      if (action === "counter") {
        const trade = tradeRequests.find((t) => t.id === id);
        if (trade) {
          setCounterModal({ open: true, trade });
          setOfferProperties(trade.requested_properties || []);
          setRequestProperties(trade.offer_properties || []);
          setOfferCash(trade.requested_amount || 0);
          setRequestCash(trade.offer_amount || 0);
        }
        return;
      }

      if (action === "delete") {
        try {
          await apiClient.post<ApiResponse>("/game-trade-requests/decline", { id });
          await apiClient.delete(`/game-trade-requests/${id}`);
          closeAiTradePopup();
          refreshTrades();
        } catch (error) {
          toast.error("Failed to delete trade");
        }
        return;
      }

      try {
        const res = await apiClient.post<ApiResponse>(
          `/game-trade-requests/${action === "accepted" ? "accept" : "decline"}`,
          { id }
        );
        if (res?.data?.success) {
          closeAiTradePopup();
          refreshTrades();
          // Refetch game and properties so balance updates show immediately in modals/sidebar
          if (game?.code) queryClient.invalidateQueries({ queryKey: ["game", game.code] });
          if (game?.id) queryClient.invalidateQueries({ queryKey: ["game_properties", game.id] });
        }
      } catch (error) {
        toast.error("Failed to update trade");
      }
    },
    [tradeRequests, closeAiTradePopup, refreshTrades, game?.code, game?.id, queryClient]
  );

  const submitCounterTrade = useCallback(async () => {
    if (!counterModal.trade) return;
    try {
      const payload = {
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "counter",
      };
      const res = await apiClient.put<ApiResponse>(
        `/game-trade-requests/${counterModal.trade.id}`,
        payload
      );
      if (res?.data?.success) {
        setCounterModal({ open: false, trade: null });
        resetTradeFields();
        refreshTrades();
      }
    } catch (error) {
      toast.error("Failed to send counter trade");
    }
  }, [
    counterModal.trade,
    offerProperties,
    offerCash,
    requestProperties,
    requestCash,
    resetTradeFields,
    refreshTrades,
  ]);

  const handleDevelopment = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/development", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) {
          toast.success("Property developed successfully");
          if (game?.code) queryClient.invalidateQueries({ queryKey: ["game", game.code] });
          if (game?.id) queryClient.invalidateQueries({ queryKey: ["game_properties", game.id] });
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to develop property");
      }
    },
    [isNext, me, game.id, game?.code, queryClient]
  );

  const handleDowngrade = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) {
          toast.success("Property downgraded successfully");
          if (game?.code) queryClient.invalidateQueries({ queryKey: ["game", game.code] });
          if (game?.id) queryClient.invalidateQueries({ queryKey: ["game_properties", game.id] });
        } else toast.error(res.data?.message ?? "Failed to downgrade property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to downgrade property");
      }
    },
    [isNext, me, game.id, game?.code, queryClient]
  );

  const handleMortgage = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) {
          toast.success("Property mortgaged successfully");
          if (game?.code) queryClient.invalidateQueries({ queryKey: ["game", game.code] });
          if (game?.id) queryClient.invalidateQueries({ queryKey: ["game_properties", game.id] });
        } else toast.error(res.data?.message ?? "Failed to mortgage property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to mortgage property");
      }
    },
    [isNext, me, game.id, game?.code, queryClient]
  );

  const handleUnmortgage = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) {
          toast.success("Property unmortgaged successfully");
          if (game?.code) queryClient.invalidateQueries({ queryKey: ["game", game.code] });
          if (game?.id) queryClient.invalidateQueries({ queryKey: ["game_properties", game.id] });
        } else toast.error(res.data?.message ?? "Failed to unmortgage property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to unmortgage property");
      }
    },
    [isNext, me, game.id, game?.code, queryClient]
  );

  const handlePropertyTransfer = useCallback(
    async (propertyId: number, newPlayerId: number, _player_address: string) => {
      if (!propertyId || !newPlayerId) {
        toast("Cannot transfer: missing property or player");
        return;
      }

      try {
        const response = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
          game_id: game.id,
          player_id: newPlayerId,
        });

        if (response.data?.success) {
          toast.success("Property transferred successfully! 🎉");
        } else {
          throw new Error(response.data?.message || "Transfer failed");
        }
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          error.message ||
          "Failed to transfer property";
        toast.error(message);
        console.error("Property transfer failed:", error);
      }
    },
    [game.id]
  );

  const handleDeleteGameProperty = useCallback(
    async (id: number) => {
      if (!id) return;
      try {
        const res = await apiClient.delete<ApiResponse>(`/game-properties/${id}`, {
          data: { game_id: game.id },
        });
        if (res?.data?.success) toast.success("Property returned to bank successfully");
        else toast.error(res.data?.message ?? "Failed to return property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to return property");
      }
    },
    [game.id]
  );

  const getGamePlayerId = useCallback(
    (walletAddress: string | undefined): number | null => {
      if (!walletAddress) return null;
      const ownedProp = game_properties.find(
        (gp) => gp.address?.toLowerCase() === walletAddress.toLowerCase()
      );
      return ownedProp?.player_id ?? null;
    },
    [game_properties]
  );

  const handleClaimProperty = useCallback(
    async (propertyId: number, player: Player) => {
      const gamePlayerId = getGamePlayerId(player.address);

      if (!gamePlayerId) {
        toast.error("Cannot claim: unable to determine your game player ID");
        return;
      }

      const toastId = toast.loading(`Claiming property #${propertyId}...`);

      try {
        const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
          game_id: game.id,
          player_id: gamePlayerId,
        });

        if (res.data?.success) {
          toast.success(
            `You now own ${res.data.data?.property_name || `#${propertyId}`}!`,
            { id: toastId }
          );
        } else {
          throw new Error(res.data?.message || "Claim unsuccessful");
        }
      } catch (err: any) {
        console.error("Claim failed:", err);
        toast.error(getContractErrorMessage(err, "Failed to claim property"), { id: toastId });
      }
    },
    [game.id, getGamePlayerId]
  );

  const aiSellHouses = useCallback(
    async (needed: number) => {
      const improved = game_properties
        .filter(
          (gp) =>
            gp.address === currentPlayer?.address && (gp.development ?? 0) > 0
        )
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
              user_id: currentPlayer!.user_id,
              property_id: gp.property_id,
            });
            raised += sellValue;
            toast(`AI sold a house on ${prop.name} (raised $${raised})`);
          } catch (err) {
            console.error("AI failed to sell house", err);
            break;
          }
        }
      }
      return raised;
    },
    [game_properties, currentPlayer, properties, game.id]
  );

  const aiMortgageProperties = useCallback(
    async (needed: number) => {
      const unmortgaged = game_properties
        .filter(
          (gp) =>
            gp.address === currentPlayer?.address &&
            !gp.mortgaged &&
            gp.development === 0
        )
        .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
        .filter(({ prop }) => prop?.price)
        .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0));

      let raised = 0;
      for (const { gp, prop } of unmortgaged) {
        if (raised >= needed || !prop) continue;
        const mortgageValue = Math.floor(prop.price / 2);
        try {
          await apiClient.post("/game-properties/mortgage", {
            game_id: game.id,
            user_id: currentPlayer!.user_id,
            property_id: gp.property_id,
          });
          raised += mortgageValue;
          toast(`AI mortgaged ${prop.name} (raised $${raised})`);
        } catch (err) {
          console.error("AI failed to mortgage", err);
        }
      }
      return raised;
    },
    [game_properties, currentPlayer, properties, game.id]
  );

  return {
    // State
    tradeModal,
    setTradeModal,
    counterModal,
    setCounterModal,
    aiResponsePopup,
    setAiResponsePopup,
    selectedProperty,
    setSelectedProperty,
    winner,
    setWinner,
    endGameCandidate,
    setEndGameCandidate,
    offerProperties,
    setOfferProperties,
    requestProperties,
    setRequestProperties,
    offerCash,
    setOfferCash,
    requestCash,
    setRequestCash,
    // Contract / end game
    endGameHook,
    onChainGameId,
    canClaimAIGameOnChain,
    // Trades
    openTrades,
    tradeRequests,
    aiTradePopup,
    closeAiTradePopup,
    refreshTrades,
    resetTradeFields,
    toggleSelect,
    startTrade,
    sortedPlayers,
    isNext,
    toggleEmpire,
    toggleTrade,
    // Handlers
    handleCreateTrade,
    handleTradeAction,
    submitCounterTrade,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    handlePropertyTransfer,
    handleDeleteGameProperty,
    getGamePlayerId,
    handleClaimProperty,
    aiSellHouses,
    aiMortgageProperties,
  };
}
