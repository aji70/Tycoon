"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { PlayerList } from "../mobile/PlayerList";
import { MyEmpire } from "../mobile/MyEmpire";
import { IncomingTrades } from "../mobile/IncomingTrades";
import { PropertyActionModal } from "./modals/PropertyActionModal";
import { AiTradePopup } from "./modals/AiTradePopup";
import { AiResponsePopup } from "./modals/AiResponsePopupMobile";
import { TradeModal } from "./modals/MobileTradeModal";
import { VictoryModal } from "./modals/VictoryModal";
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";

interface MobileGameLayoutProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}

export default function MobileGameLayout({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: MobileGameLayoutProps) {
  const { address } = useAccount();

  const [showEmpire, setShowEmpire] = useState(true);
  const [showTrades, setShowTrades] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [tradeModal, setTradeModal] = useState<{ open: boolean; target: Player | null }>({
    open: false,
    target: null,
  });
  const [counterModal, setCounterModal] = useState<{ open: boolean; trade: any | null }>({
    open: false,
    trade: null,
  });

  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);

  const [incomingTrades, setIncomingTrades] = useState<any[]>([]);
  const [aiTradePopup, setAiTradePopup] = useState<any | null>(null);
  const [aiResponsePopup, setAiResponsePopup] = useState<any | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);

  const processedAiTradeIds = useRef<Set<number>>(new Set());
  const isNext = !!me && game.next_player_id === me.user_id;
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
   const [endGameCandidate, setEndGameCandidate] = useState<{
      winner: Player | null;
      position: number;
      balance: bigint;
    }>({ winner: null, position: 0, balance: BigInt(0) });

  // Winner detection
  useEffect(() => {
    const active = game.players.filter((p) => p.balance > 0);
    setWinner(active.length === 1 ? active[0] : null);
  }, [game.players]);

    const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
    const onChainGameId = contractGame?.id;
   const { write: endGame, isPending: endGamePending, reset: endGameReset } = useEndAiGame(
      Number(onChainGameId),
      endGameCandidate.position,
      endGameCandidate.balance,
      !!endGameCandidate.winner
    );

  // Trade polling (simplified – move to hook later if needed)
  const fetchTrades = useCallback(async () => {
    if (!me || !game?.id) return;
    try {
      const [outRes, inRes] = await Promise.all([
        apiClient.get<ApiResponse>(`/game-trade-requests/my/${game.id}/player/${me.user_id}`),
        apiClient.get<ApiResponse>(`/game-trade-requests/incoming/${game.id}/player/${me.user_id}`),
      ]);
      setIncomingTrades(inRes.data?.data || []);

      const pendingAi = (inRes.data?.data || []).filter((t: any) => {
        if (t.status !== "pending" || processedAiTradeIds.current.has(t.id)) return false;
        const from = game.players.find((p: Player) => p.user_id === t.player_id);
        const name = (from?.username || "").toLowerCase();
        return name.includes("ai") || name.includes("bot") || name.includes("computer");
      });

      if (pendingAi.length > 0) {
        setAiTradePopup(pendingAi[0]);
        processedAiTradeIds.current.add(pendingAi[0].id);
      }
    } catch (err) {
      console.error("Trade fetch error", err);
    }
  }, [me, game?.id, game.players]);

  useEffect(() => {
    if (!me || !game?.id) return;
    fetchTrades();
    const id = setInterval(fetchTrades, 4000);
    return () => clearInterval(id);
  }, [fetchTrades]);

  useEffect(() => {
    processedAiTradeIds.current.clear();
  }, [game?.id]);

  const resetTradeFields = () => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  };

    const calculateAiFavorability = useCallback(
      (trade: any) => {
        const aiGetsValue =
          (trade.offer_amount || 0) +
          trade.offer_properties.reduce(
            (sum: number, id: number) =>
              sum + (properties.find((p) => p.id === id)?.price || 0),
            0
          );
  
        const aiGivesValue =
          (trade.requested_amount || 0) +
          trade.requested_properties.reduce(
            (sum: number, id: number) =>
              sum + (properties.find((p) => p.id === id)?.price || 0),
            0
          );
  
        if (aiGivesValue === 0) return 100;
        const ratio = ((aiGetsValue - aiGivesValue) / aiGivesValue) * 100;
        return Math.min(100, Math.max(-100, Math.round(ratio)));
      },
      [properties]
    );

  const toggleSelect = (id: number, arr: number[], setter: any) => {
    setter((prev: number[]) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const startTrade = (player: Player) => {
    if (!isNext) return toast.error("Not your turn!");
    setTradeModal({ open: true, target: player });
    resetTradeFields();
  };


     const handleMortgage = async (id: number) => {
        if (!isNext || !me) return;
        try {
          const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
            game_id: game.id,
            user_id: me.user_id,
            property_id: id,
          });
          if (res.data?.success) toast.success("Mortgaged");
          else toast.error(res.data?.message || "Cannot mortgage");
        } catch (err: any) {
          toast.error("Mortgage failed");
        }
      };
    
      const handleUnmortgage = async (id: number) => {
        if (!isNext || !me) return;
        try {
          const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
            game_id: game.id,
            user_id: me.user_id,
            property_id: id,
          });
          if (res.data?.success) toast.success("Unmortgaged");
          else toast.error(res.data?.message || "Cannot unmortgage");
        } catch (err: any) {
          toast.error("Unmortgage failed");
        }
      };

     const handleDevelopment = async (id: number) => {
    if (!isNext || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res.data?.success) toast.success("House built!");
      else toast.error(res.data?.message || "Cannot build");
    } catch (err: any) {
      toast.error("Build failed");
    }
  };

  const handleDowngrade = async (id: number) => {
    if (!isNext || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res.data?.success) toast.success("House sold");
      else toast.error(res.data?.message || "Cannot sell");
    } catch (err: any) {
      toast.error("Downgrade failed");
    }
  };

    const handleCreateTrade = async () => {
    if (!me || !tradeModal.target) return;

    const targetPlayer = tradeModal.target;
    const username = (targetPlayer.username || "").toLowerCase();
    const isAI = username.includes("ai") || username.includes("bot") || username.includes("computer");

    try {
      const payload = {
        game_id: game.id,
        player_id: me.user_id,
        target_player_id: targetPlayer.user_id,
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
      };

      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success("Trade sent successfully!");
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        fetchTrades();

        if (isAI) {
          const sentTrade = {
            ...payload,
            id: res.data?.data?.id || Date.now(),
          };

          const favorability = calculateAiFavorability(sentTrade);

          let decision: "accepted" | "declined" = "declined";
          let remark = "";

          if (favorability >= 30) {
            decision = "accepted";
            remark = "This is a fantastic deal! 🤖";
          } else if (favorability >= 10) {
            decision = Math.random() < 0.7 ? "accepted" : "declined";
            remark = decision === "accepted" ? "Fair enough, I'll take it." : "Not quite good enough.";
          } else if (favorability >= 0) {
            decision = Math.random() < 0.3 ? "accepted" : "declined";
            remark = decision === "accepted" ? "Okay, deal." : "Nah, too weak.";
          } else {
            remark = "This deal is terrible for me! 😤";
          }

          if (decision === "accepted") {
            try {
              await apiClient.post("/game-trade-requests/accept", { id: sentTrade.id });
              toast.success("AI accepted your trade instantly! 🎉");
              fetchTrades();
            } catch (err) {
              console.error("Auto-accept failed", err);
            }
          }

          setAiResponsePopup({
            trade: sentTrade,
            favorability,
            decision,
            remark,
          });
        }
      } else {
        toast.error(res?.data?.message || "Failed to send trade");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Trade failed");
    }
  };

  const handleTradeAction = async (id: number, action: "accepted" | "declined" | "counter") => {
    try {
      if (action === "counter") {
        const trade = incomingTrades.find((t) => t.id === id);
        if (trade) {
          setCounterModal({ open: true, trade });
          setOfferProperties(trade.requested_properties || []);
          setRequestProperties(trade.offer_properties || []);
          setOfferCash(trade.requested_amount || 0);
          setRequestCash(trade.offer_amount || 0);
        }
        return;
      }
      const endpoint = action === "accepted" ? "accept" : "decline";
      const res = await apiClient.post<ApiResponse>(`/game-trade-requests/${endpoint}`, { id });
      if (res.data?.success) {
        toast.success(`Trade ${action}!`);
        setAiTradePopup(null);
        fetchTrades();
      }
    } catch (err: any) {
      toast.error("Action failed");
    }
  };
  const submitCounterTrade = async () => {
      if (!counterModal.trade) return;
      try {
        const payload = {
          offer_properties: offerProperties,
          offer_amount: offerCash,
          requested_properties: requestProperties,
          requested_amount: requestCash,
        };
        const res = await apiClient.put<ApiResponse>(`/game-trade-requests/${counterModal.trade.id}`, payload);
        if (res.data?.success) {
          toast.success("Counter offer sent!");
          setCounterModal({ open: false, trade: null });
          resetTradeFields();
          fetchTrades();
        }
      } catch (err: any) {
        toast.error("Counter failed");
      }
    };

     const handleFinalizeAndLeave = async () => {
        setShowExitPrompt(false);
        setClaimError(null);
    
        const toastId = toast.loading(
          winner?.user_id === me?.user_id
            ? "Claiming your prize..."
            : "Finalizing game..."
        );
    
        try {
          if (endGame) {
            await endGame();
          }
    
          toast.success(
            winner?.user_id === me?.user_id
              ? "Prize claimed! 🎉"
              : "Game completed — thanks for playing!",
            { id: toastId, duration: 5000 }
          );
    
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        } catch (err: any) {
          toast.error(
            err?.message || "Something went wrong — try again later",
            { id: toastId, duration: 8000 }
          );
        } finally {
          if (endGameReset) endGameReset();
        }
      };
    
  return (
    <aside className="w-full h-full bg-gradient-to-b from-[#0a0e17] to-[#1a0033] overflow-y-auto relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600" />

            <VictoryModal
                winner={winner}
                me={me}
                onClaim={handleFinalizeAndLeave}
                claiming={endGamePending}
              />
      

      <div className="p-3 space-y-4">
        <PlayerList
          game={game}
          me={me}
          address={address}
          isNext={isNext}
          startTrade={startTrade}
        />

        <MyEmpire
          showEmpire={showEmpire}
          toggleEmpire={() => setShowEmpire((v) => !v)}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          isNext={isNext}
          setSelectedProperty={setSelectedProperty}
        />

        <IncomingTrades
          showTrades={showTrades}
          toggleTrades={() => setShowTrades((v) => !v)}
          incomingTrades={incomingTrades}
          properties={properties}
          game={game}
          handleTradeAction={handleTradeAction}
        />
      </div>

      <AnimatePresence>
        <PropertyActionModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onDevelop={handleDevelopment}
          onDowngrade={handleDowngrade}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />

        <AiTradePopup
          trade={aiTradePopup}
          properties={properties}
          onClose={() => setAiTradePopup(null)}
          onAccept={() => handleTradeAction(aiTradePopup?.id, "accepted")}
          onDecline={() => handleTradeAction(aiTradePopup?.id, "declined")}
          onCounter={() => handleTradeAction(aiTradePopup?.id, "counter")}
        />

        <AiResponsePopup
          popup={aiResponsePopup}
          properties={properties}
          onClose={() => setAiResponsePopup(null)}
        />

        <TradeModal
          open={tradeModal.open}
          title="CREATE TRADE"
          onClose={() => { setTradeModal({ open: false, target: null }); resetTradeFields(); }}
          onSubmit={handleCreateTrade}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          offerProperties={offerProperties}
          requestProperties={requestProperties}
          setOfferProperties={setOfferProperties}
          setRequestProperties={setRequestProperties}
          offerCash={offerCash}
          requestCash={requestCash}
          setOfferCash={setOfferCash}
          setRequestCash={setRequestCash}
          toggleSelect={toggleSelect}
          targetPlayerAddress={tradeModal.target?.address}
        />

        <TradeModal
          open={counterModal.open}
          title="COUNTER OFFER"
          onClose={() => { setCounterModal({ open: false, trade: null }); resetTradeFields(); }}
          onSubmit={submitCounterTrade}
          my_properties={my_properties}
        properties={properties}
        game_properties={game_properties}
        offerProperties={offerProperties}
        requestProperties={requestProperties}
        setOfferProperties={setOfferProperties}
        setRequestProperties={setRequestProperties}
        offerCash={offerCash}
        requestCash={requestCash}
        setOfferCash={setOfferCash}
        setRequestCash={setRequestCash}
        toggleSelect={toggleSelect}
          targetPlayerAddress={game.players.find(p => p.user_id === counterModal.trade?.target_player_id)?.address}
        />
      </AnimatePresence>
    </aside>
  );
}