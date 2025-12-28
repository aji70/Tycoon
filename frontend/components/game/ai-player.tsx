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
  const isDevMode = true;

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

  const [claimModalOpen, setClaimModalOpen] = useState(false);

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

const handlePropertyTransfer = async (propertyId: number, newPlayerId: number) => {
  // Prevent invalid calls
  if (!propertyId || !newPlayerId) {
    toast("Cannot transfer: missing property or player");
    return;
  }

  try {
    const response = await apiClient.put<ApiResponse>(
      `/game-properties/${propertyId}`,
      {
        game_id: game.id,     // ← make sure game is in scope!
        player_id: newPlayerId
      }
    );

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
};

  // AI liquidation functions
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

  // Helper to safely get internal player_id from any owned property
  const getGamePlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const ownedProp = game_properties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return ownedProp?.player_id ?? null;
  };

  // Dev claim function
  const handleClaimProperty = async (propertyId: number, player: Player) => {
    const gamePlayerId = getGamePlayerId(player.address);

    if (!gamePlayerId) {
      toast.error("Cannot claim: unable to determine your game player ID");
      return;
    }

    const toastId = toast.loading(`Claiming property #${propertyId}...`);

    try {
      const payload = {
        game_id: game.id,
        player_id: gamePlayerId,
      };

      const res = await apiClient.delete<ApiResponse>(`/game-properties/${propertyId}`, payload);

      if (res.data?.success) {
        toast.success(
          `You now own ${res.data.data?.property_name || `#${propertyId}`}!`,
          { id: toastId }
        );
      } else {
        throw new Error(res.data?.message || "Claim unsuccessful");
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to claim property";
      console.error("Claim failed:", err);
      toast.error(errorMessage, { id: toastId });
    }
  };

  // Immediate AI liquidation + bankruptcy when balance goes negative
  useEffect(() => {
    if (!isAITurn || !currentPlayer || currentPlayer.balance >= 0) return;

    const handleAiBankruptImmediately = async () => {
      toast(`${currentPlayer.username} cannot pay and is bankrupt! Liquidating immediately...`);

      // Liquidate everything possible
      await aiSellHouses(Infinity); // Sell all houses
      await aiMortgageProperties(Infinity); // Mortgage all eligible properties

      // Now proceed directly to bankruptcy (no chance to recover)
      try {
        const landedProperty = game_properties.find(gp => gp.id === currentPlayer.position);

        const creditorAddress = landedProperty?.address && landedProperty.address !== "bank" 
          ? landedProperty.address 
          : null;

        const creditorPlayer = creditorAddress
          ? game.players.find(p => p.address?.toLowerCase() === creditorAddress.toLowerCase())
          : null;

        const bankruptedByHuman = !!creditorPlayer && !isAIPlayer(creditorPlayer);

        const aiProperties = game_properties.filter(gp => gp.address === currentPlayer.address);

        let successCount = 0;

        if (bankruptedByHuman && landedProperty?.player_id) {
          const creditorGamePlayerId = landedProperty.player_id;

          toast(
            `${currentPlayer.username} bankrupted by ${creditorPlayer!.username} — transferring all properties...`
          );

          for (const prop of aiProperties) {
            const propertyId = prop.id;

            try {
              handleClaimProperty(propertyId, me!);

      if (true) successCount++;
            } catch (err) {
              console.error(`Transfer failed for property ${propertyId}:`, err);
            }
          }

          toast.success(
            `${successCount}/${aiProperties.length} properties transferred to ${creditorPlayer!.username}!`
          );
        } else {
          toast(`${currentPlayer.username} bankrupt — all properties returned to bank.`);

          for (const prop of aiProperties) {
            const propertyId = prop.property_id ?? prop.id;
                const payload = {
        game_id: game.id,
        
      };


            try {
              const res = await apiClient.delete<ApiResponse>(`/game-properties/${propertyId}`, payload);

              if (res.data?.success) successCount++;
            } catch (err) {
              console.error(`Failed to return property ${propertyId} to bank:`, err);
            }
          }

          toast.success(`${successCount}/${aiProperties.length} properties returned to bank.`);
        }

        // Remove AI from game
        await apiClient.post("/game-players/leave", {
          address: currentPlayer.address,
          code: game.code,
          reason: "bankruptcy",
        });

        toast.success(`${currentPlayer.username} has been removed from the game.`, { duration: 5000 });
      } catch (err: any) {
        console.error("Immediate bankruptcy handling failed:", err);
        toast.error("AI bankruptcy failed", { duration: 6000 });
      }
    };

    // Trigger immediately — no delay
    handleAiBankruptImmediately();
  }, [isAITurn, currentPlayer?.balance, currentPlayer, game_properties, game.id, game.code, game.players]);

  // Winner detection (1v1 human vs AI)
  useEffect(() => {
    if (!me || game.players.length !== 2) return;

    const aiPlayer = game.players.find(p => isAIPlayer(p));
    const humanPlayer = me;

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
    const toastId = toast.loading(
      winner?.user_id === me?.user_id
        ? "Claiming your prize..."
        : "Finalizing game..."
    );

    try {
      if (endGame) await endGame();

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

        {isDevMode && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setClaimModalOpen(true)}
            className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-purple-700 to-fuchsia-700 hover:from-purple-600 hover:to-fuchsia-600 rounded-xl text-white font-medium shadow-lg shadow-purple-900/30"
          >
            DEV: Claim Any Property
          </motion.button>
        )}
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
          onAccept={() => handleTradeAction(aiTradePopup!.id, "accepted")}
          onDecline={() => handleTradeAction(aiTradePopup!.id, "declined")}
          onCounter={() => handleTradeAction(aiTradePopup!.id, "counter")}
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

        <ClaimPropertyModal
          open={claimModalOpen && isDevMode}
          game_properties={game_properties}
          properties={properties}
          me={me}
          game={game}
          onClose={() => setClaimModalOpen(false)}
          onClaim={handleClaimProperty}
        />
      </AnimatePresence>
    </aside>
  );
}

// ── Debug Claim Modal ───────────────────────────────────────────────────────────
interface ClaimPropertyModalProps {
  open: boolean;
  game_properties: GameProperty[];
  properties: Property[];
  me: Player | null;
  game: Game;
  onClose: () => void;
  onClaim: (propertyId: number, player: Player) => Promise<unknown>;
}

function ClaimPropertyModal({
  open,
  game_properties,
  properties,
  me,
  game,
  onClose,
  onClaim,
}: ClaimPropertyModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (!open || !me) return null;

  const claimable = game_properties
    .filter(gp => gp.address !== me?.address && gp.address !== "bank" && gp.property_id)
    .map(gp => ({
      ...gp,
      base: properties.find(p => p.id === gp.property_id),
    }))
    .filter((gp): gp is typeof gp & { base: Property } => !!gp.base)
    .sort((a, b) => (b.base.price || 0) - (a.base.price || 0));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="bg-gray-900/95 border border-cyan-600/40 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-cyan-800/30">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-cyan-300">DEV: Claim Property</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
              ×
            </button>
          </div>
          <p className="text-cyan-400/70 text-sm mt-1">
            Force transfer any property to yourself
          </p>
        </div>

        <div className="p-6 max-h-[55vh] overflow-y-auto space-y-3">
          {claimable.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No claimable properties found
            </div>
          ) : (
            claimable.map(({ id, base, address }) => {
              const currentOwner = game.players.find(p => p.address === address);
              const isSelected = selectedId === id;

              return (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  className={`w-full p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40"
                      : "border-gray-700 hover:border-cyan-700/50 bg-gray-800/30"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-lg text-white">{base.name}</div>
                      <div className="text-sm text-cyan-300 mt-1">
                        ${base.price?.toLocaleString() || "—"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Current: {currentOwner?.username || address?.slice(0, 8) + "..."}
                      </div>
                    </div>
                    <div className={`text-2xl ${isSelected ? "text-cyan-400" : "text-gray-600"}`}>
                      {isSelected ? "✓" : "→"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-6 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedId && me && onClaim(selectedId, me)}
            disabled={!selectedId}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Claim Selected Property
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}