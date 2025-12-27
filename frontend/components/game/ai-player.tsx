"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";
import { PlayerList } from "./player-list";
import { MyEmpire } from "./my-empire";
import { TradeSection } from "./trade-section";
import { PropertyActionModal } from "./modals/property-action";
import { AiTradePopup } from "./modals/ai-trade";
import { AiResponsePopup } from "./modals/ai-response";
import { VictoryModal } from "./modals/victory";
import { TradeModal } from "./modals/trade";

import { isAIPlayer, calculateAiFavorability } from "@/utils/gameUtils";

interface GamePlayersProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  currentPlayer: Player | null;
  roll: { die1: number; die2: number; total: number } | null;
  isAITurn: boolean;
}

export default function GamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  isAITurn,
}: GamePlayersProps) {
  const { address } = useAccount();

  const [showEmpire, setShowEmpire] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [tradeRequests, setTradeRequests] = useState<any[]>([]);
  const [tradeModal, setTradeModal] = useState<{ open: boolean; target: Player | null }>({
    open: false,
    target: null,
  });
  const [counterModal, setCounterModal] = useState<{ open: boolean; trade: any | null }>({
    open: false,
    trade: null,
  });
  const [aiTradePopup, setAiTradePopup] = useState<any | null>(null);
  const [aiResponsePopup, setAiResponsePopup] = useState<any | null>(null);

  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState<number>(0);
  const [requestCash, setRequestCash] = useState<number>(0);

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const [winner, setWinner] = useState<Player | null>(null);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

  const processedAiTradeIds = useRef<Set<number>>(new Set());

  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const onChainGameId = contractGame?.id;
  const { write: endGame, isPending: endGamePending, reset: endGameReset } = useEndAiGame(
    Number(onChainGameId),
    endGameCandidate.position,
    endGameCandidate.balance,
    !!endGameCandidate.winner
  );

  const toggleEmpire = useCallback(() => setShowEmpire((p) => !p), []);
  const toggleTrade = useCallback(() => setShowTrade((p) => !p), []);
  const isNext = !!me && game.next_player_id === me.user_id;
  const [claimError, setClaimError] = useState<string | null>(null);

  const resetTradeFields = () => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  };

  const toggleSelect = (id: number, arr: number[], setter: React.Dispatch<React.SetStateAction<number[]>>) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startTrade = (targetPlayer: Player) => {
    if (!isNext) {
      toast.error("Not your turn!");
      return;
    }
    setTradeModal({ open: true, target: targetPlayer });
    resetTradeFields();
  };

  const sortedPlayers = useMemo(
    () =>
      [...(game?.players ?? [])].sort(
        (a, b) => (a.turn_order ?? Infinity) - (b.turn_order ?? Infinity)
      ),
    [game?.players]
  );

  const fetchTrades = useCallback(async () => {
    if (!me || !game?.id) return;
    try {
      const [_initiated, _incoming] = await Promise.all([
        apiClient.get<ApiResponse>(`/game-trade-requests/my/${game.id}/player/${me.user_id}`),
        apiClient.get<ApiResponse>(`/game-trade-requests/incoming/${game.id}/player/${me.user_id}`),
      ]);
      const initiated = _initiated.data?.data || [];
      const incoming = _incoming.data?.data || [];
      setOpenTrades(initiated);
      setTradeRequests(incoming);

      const pendingAiTrades = incoming.filter((t: any) => {
        if (t.status !== "pending") return false;
        if (processedAiTradeIds.current.has(t.id)) return false;

        const fromPlayer = game.players.find((p: Player) => p.user_id === t.player_id);
        return fromPlayer && isAIPlayer(fromPlayer);
      });

      if (pendingAiTrades.length > 0) {
        const trade = pendingAiTrades[0];
        setAiTradePopup(trade);
        processedAiTradeIds.current.add(trade.id);
      }
    } catch (err) {
      console.error("Error loading trades:", err);
      toast.error("Failed to load trades");
    }
  }, [me, game?.id, game.players]);

  useEffect(() => {
    if (!me || !game?.id) return;
    const interval = setInterval(fetchTrades, 5000);
    fetchTrades();
    return () => clearInterval(interval);
  }, [fetchTrades]);

  useEffect(() => {
    processedAiTradeIds.current.clear();
  }, [game?.id]);

  const handleCreateTrade = async () => {
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
        toast.success("Trade sent successfully!");
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        fetchTrades();

        if (isAI) {
          const sentTrade = {
            ...payload,
            id: res.data?.data?.id || Date.now(),
          };

          const favorability = calculateAiFavorability(sentTrade, properties);

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
            await apiClient.post("/game-trade-requests/accept", { id: sentTrade.id });
            toast.success("AI accepted your trade instantly! 🎉");
            fetchTrades();
          }

          setAiResponsePopup({
            trade: sentTrade,
            favorability,
            decision,
            remark,
          });
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create trade");
    }
  };

  const handleTradeAction = async (id: number, action: "accepted" | "declined" | "counter") => {
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

    try {
      const res = await apiClient.post<ApiResponse>(
        `/game-trade-requests/${action === "accepted" ? "accept" : "decline"}`,
        { id }
      );
      if (res?.data?.success) {
        toast.success(`Trade ${action}`);
        setAiTradePopup(null);
        fetchTrades();
      }
    } catch (error) {
      toast.error("Failed to update trade");
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
        status: "counter",
      };
      const res = await apiClient.put<ApiResponse>(`/game-trade-requests/${counterModal.trade.id}`, payload);
      if (res?.data?.success) {
        toast.success("Counter offer sent");
        setCounterModal({ open: false, trade: null });
        resetTradeFields();
        fetchTrades();
      }
    } catch (error) {
      toast.error("Failed to send counter trade");
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
      if (res?.data?.success) toast.success("Property developed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to develop property");
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
      if (res?.data?.success) toast.success("Property downgraded successfully");
      else toast.error(res.data?.message ?? "Failed to downgrade property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to downgrade property");
    }
  };

  const handleMortgage = async (id: number) => {
    if (!isNext || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property mortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to mortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mortgage property");
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
      if (res?.data?.success) toast.success("Property unmortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to unmortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to unmortgage property");
    }
  };

  // AI liquidation logic
  const aiSellHouses = async (needed: number) => {
    const improved = game_properties
      .filter(gp => gp.address === currentPlayer?.address && (gp.development ?? 0) > 0)
      .sort((a, b) => {
        const pa = properties.find(p => p.id === a.property_id);
        const pb = properties.find(p => p.id === b.property_id);
        return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0);
      });

    let raised = 0;
    for (const gp of improved) {
      if (raised >= needed) break;
      const prop = properties.find(p => p.id === gp.property_id);
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
  };

  const aiMortgageProperties = async (needed: number) => {
    const unmortgaged = game_properties
      .filter(gp => gp.address === currentPlayer?.address && !gp.mortgaged && gp.development === 0)
      .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id) }))
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
  };

  // useEffect(() => {
  //   if (!isAITurn || !currentPlayer) return;

  //   const liquidateIfNeeded = async () => {
  //     const balance = currentPlayer.balance;
  //     if (balance >= 200) return;

  //     toast(`${currentPlayer.username} is broke ($${balance}) — liquidating assets!`);

  //     const needed = Math.max(600, 200 - balance);

  //     let raised = 0;
  //     raised += await aiSellHouses(needed);
  //     raised += await aiMortgageProperties(needed - raised);

  //     // ── Changed part: use /leave instead of /bankrupt ──
  //     if (currentPlayer.balance < 0 && isAIPlayer(currentPlayer)) {
  //       toast(`${currentPlayer.username} is bankrupt! Removing AI from the game...`);
  //       try {
  //        await apiClient.post("/game-players/leave", {
  //                 address: currentPlayer.address,
  //                 code: game.code,
  //               });
  //         toast.success(`${currentPlayer.username} has left the game due to bankruptcy!`);
  //       } catch (err) {
  //         console.error("Failed to remove AI via /leave:", err);
  //         toast.error("AI bankruptcy removal failed — game may need manual intervention");
  //       }
  //     }
  //   };

  //   console.log("AI Turn detected, checking for liquidation...", game);
  //   const timer = setTimeout(liquidateIfNeeded, 3000);
  //   return () => clearTimeout(timer);
  // }, [isAITurn, currentPlayer, game_properties, properties, game.id, game]);

useEffect(() => {
  if (!isAITurn || !currentPlayer) return;

  const handleAITurnBankruptcy = async () => {
    if (currentPlayer.balance >= 0) return;

    toast(`${currentPlayer.username} is bankrupt ($${currentPlayer.balance}) — processing...`);

    try {
      // 1. Find which property the AI is currently standing on
      const landedProperty = game_properties.find(
        gp => gp.id === currentPlayer.position
      );

      // 2. Get the owner of that property
      let creditorAddress: string | null = null;
      if (landedProperty && landedProperty.address && landedProperty.address !== "bank") {
        creditorAddress = landedProperty.address;
      }

      // 3. Find the actual player object of the creditor
      const creditorPlayer = creditorAddress
        ? game.players.find(p => p.address === creditorAddress)
        : null;

      const bankruptedByHuman =
        !!creditorPlayer &&
        !isAIPlayer(creditorPlayer) &&
        creditorPlayer.address !== currentPlayer.address;

      // ── CASE 1: Bankrupted by a HUMAN player → transfer all AI properties to them ──
      if (bankruptedByHuman) {
        toast(
          `${currentPlayer.username} was bankrupted by ${creditorPlayer!.username}! → Transferring empire...`
        );

        // Get all properties owned by the bankrupt AI
        const aiProperties = game_properties.filter(
          gp => gp.address === currentPlayer.address
        );

        let successCount = 0;

        for (const prop of aiProperties) {
          try {
            await apiClient.post<ApiResponse>("/properties/update", {
              propertyId: prop.property_id,   // ← important: use property_id, not id
            });
            successCount++;
          } catch (transferErr) {
            console.error(`Transfer failed for property ${prop.property_id}:`, transferErr);
          }
        }

        toast.success(
          `${successCount}/${aiProperties.length} properties transferred to ${creditorPlayer!.username}!`
        );
      }
      // ── CASE 2: Bankrupt for any other reason (tax, other AI, etc.) → return to bank ──
      else {
        toast(`${currentPlayer.username} bankrupt — properties returned to bank.`);
      
      }

      // 3. Remove the AI player from the game
      await apiClient.post("/game-players/leave", {
        address: currentPlayer.address,
        code: game.code,
        reason: "bankruptcy",
      });

      toast.success(`${currentPlayer.username} removed from game.`, { duration: 4000 });
    } catch (err) {
      console.error("Bankruptcy handling error:", err);
      toast.error("AI bankruptcy failed — game might need manual intervention");
    }
  };

  console.log(
    `AI bankruptcy check: ${currentPlayer.username} | Balance: $${currentPlayer.balance} | Pos: ${currentPlayer.position}`
  );

  const timer = setTimeout(() => {
    if (currentPlayer.balance < 0) {
      handleAITurnBankruptcy();
    }
  }, 3400); // slightly longer delay for drama + network

  return () => clearTimeout(timer);
}, [
  isAITurn,
  currentPlayer,
  game_properties,
  game.code,
  game.players,
]);
  
  
  // Winner detection (AI removed → human wins in 1v1)
  useEffect(() => {
    if (!me || game.players.length !== 2) return;

    const aiPlayer = game.players.find(p => isAIPlayer(p));
    const humanPlayer = me;

    // If AI is no longer in players list (removed via /leave) or has negative/zero balance
    if ((!aiPlayer || aiPlayer.balance <= 0) && humanPlayer.balance > 0) {
      setWinner(humanPlayer);
      setEndGameCandidate({
        winner: humanPlayer,
        position: humanPlayer.position ?? 0,
        balance: BigInt(humanPlayer.balance),
      });
    }
  }, [game.players, me]);

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
    <aside className="w-80 h-full bg-gradient-to-b from-[#0a0e17] to-[#1a0033] border-r-4 border-cyan-500 shadow-2xl shadow-cyan-500/50 overflow-y-auto relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/80" />

      <div className="p-4 space-y-6">
        <motion.h2
          animate={{ textShadow: ["0 0 10px #0ff", "0 0 20px #0ff", "0 0 10px #0ff"] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-2xl font-bold text-cyan-300 text-center tracking-widest"
        >
          PLAYERS
        </motion.h2>

        <PlayerList
          game={game}
          sortedPlayers={sortedPlayers}
          startTrade={startTrade}
          isNext={isNext}
        />

        <MyEmpire
          showEmpire={showEmpire}
          toggleEmpire={toggleEmpire}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          setSelectedProperty={setSelectedProperty}
        />

        <TradeSection
          showTrade={showTrade}
          toggleTrade={toggleTrade}
          openTrades={openTrades}
          tradeRequests={tradeRequests}
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
          onAccept={() => handleTradeAction(aiTradePopup.id, "accepted")}
          onDecline={() => handleTradeAction(aiTradePopup.id, "declined")}
          onCounter={() => handleTradeAction(aiTradePopup.id, "counter")}
        />

        <AiResponsePopup
          popup={aiResponsePopup}
          properties={properties}
          onClose={() => setAiResponsePopup(null)}
        />

        <VictoryModal
          winner={winner}
          me={me}
          onClaim={handleFinalizeAndLeave}
          claiming={endGamePending}
        />

        <TradeModal
          open={tradeModal.open}
          title={`Trade with ${tradeModal.target?.username || "Player"}`}
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
          title="Counter Trade Offer"
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