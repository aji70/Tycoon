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

// ── Debug Claim Modal ───────────────────────────────────────────────────────────
interface ClaimPropertyModalProps {
  open: boolean;
  game_properties: GameProperty[];
  properties: Property[];
  me: Player | null;
  game: Game;
  onClose: () => void;
  onClaim: (propertyId: number) => Promise<unknown>;
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

  if (!open) return null;

  const claimable = game_properties
    .filter(gp => gp.address !== me?.address && gp.address !== "bank" && gp.property_id)
    .map(gp => ({
      ...gp,
      base: properties.find(p => p.id === gp.property_id),
    }))
    .filter((gp): gp is typeof gp & { base: Property } => !!gp.base)
    .sort((a, b) => (b.base.price || 0) - (a.base.price || 0));

    console.log("Claimable Properties List:", claimable);

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

              console.log("Claimable Property :", id, base.name, address);
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
            onClick={() => selectedId && onClaim(selectedId)}
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

// ── Main Component ───────────────────────────────────────────────────────────────
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
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [propertyToClaim, setPropertyToClaim] = useState<GameProperty | null>(null);

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

  const toggleEmpire = useCallback(() => setShowEmpire(p => !p), []);
  const toggleTrade = useCallback(() => setShowTrade(p => !p), []);
  const isNext = !!me && game.next_player_id === me.user_id;

  const resetTradeFields = () => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  };

  const toggleSelect = (
    id: number,
    arr: number[],
    setter: React.Dispatch<React.SetStateAction<number[]>>
  ) => {
    setter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
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
      setOpenTrades(_initiated.data?.data || []);
      setTradeRequests(_incoming.data?.data || []);

      const pendingAi = (_incoming.data?.data || []).filter((t: any) => {
        if (t.status !== "pending" || processedAiTradeIds.current.has(t.id)) return false;
        const from = game.players.find(p => p.user_id === t.player_id);
        return from && isAIPlayer(from);
      });

      if (pendingAi.length > 0) {
        const trade = pendingAi[0];
        setAiTradePopup(trade);
        processedAiTradeIds.current.add(trade.id);
      }
    } catch (err) {
      console.error("Trades fetch error:", err);
    }
  }, [me, game?.id, game.players]);

  useEffect(() => {
    if (!me || !game?.id) return;
    const interval = setInterval(fetchTrades, 6000);
    fetchTrades();
    return () => clearInterval(interval);
  }, [fetchTrades]);

  useEffect(() => {
    processedAiTradeIds.current.clear();
  }, [game?.id]);

  const handleCreateTrade = async () => {
    if (!me || !tradeModal.target) return;

    const target = tradeModal.target;
    const isAI = isAIPlayer(target);

    try {
      const payload = {
        game_id: game.id,
        player_id: me.user_id,
        target_player_id: target.user_id,
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "pending",
      };

      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res.data?.success) {
        toast.success("Trade offer sent!");
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        fetchTrades();

        if (isAI) {
          const trade = { ...payload, id: res.data?.data?.id || Date.now() };
          const score = calculateAiFavorability(trade, properties);

          let decision: "accepted" | "declined" = score >= 30 ? "accepted" : "declined";
          if (score >= 10 && score < 30) decision = Math.random() < 0.6 ? "accepted" : "declined";
          if (score >= 0 && score < 10) decision = Math.random() < 0.25 ? "accepted" : "declined";

          if (decision === "accepted") {
            await apiClient.post("/game-trade-requests/accept", { id: trade.id });
            toast.success("AI accepted your trade! 🎉");
            fetchTrades();
          }

          setAiResponsePopup({ trade, favorability: score, decision });
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Trade creation failed");
    }
  };

  const handleTradeAction = async (id: number, action: "accepted" | "declined" | "counter") => {
    if (action === "counter") {
      const trade = tradeRequests.find(t => t.id === id);
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
      const endpoint = action === "accepted" ? "accept" : "decline";
      const res = await apiClient.post<ApiResponse>(`/game-trade-requests/${endpoint}`, { id });
      if (res.data?.success) {
        toast.success(`Trade ${action}`);
        setAiTradePopup(null);
        fetchTrades();
      }
    } catch {
      toast.error("Trade action failed");
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
      if (res.data?.success) {
        toast.success("Counter-offer sent");
        setCounterModal({ open: false, trade: null });
        resetTradeFields();
        fetchTrades();
      }
    } catch {
      toast.error("Failed to send counter");
    }
  };

  // Simple development actions (you can keep or remove them)
  const handleDevelopment = async (id: number) => {/* ... */};
  const handleDowngrade = async (id: number) => {/* ... */};
  const handleMortgage = async (id: number) => {/* ... */};
  const handleUnmortgage = async (id: number) => {/* ... */};

  // AI bankruptcy handling
  useEffect(() => {
    if (!isAITurn || !currentPlayer || currentPlayer.balance >= 0) return;

    const handleBankruptcy = async () => {
      const toastId = toast.loading(`${currentPlayer.username} is bankrupt...`);

      try {
        const landed = game_properties.find(gp => gp.id === currentPlayer.position);
        const creditorAddr = landed?.address && landed.address !== "bank" ? landed.address : null;
        const creditor = creditorAddr ? game.players.find(p => p.address === creditorAddr) : null;
        const toHuman = creditor && !isAIPlayer(creditor);

        const aiProps = game_properties.filter(gp => gp.address === currentPlayer.address);
        const targetAddr = toHuman ? creditor!.address : "bank";
        const targetName = toHuman ? creditor!.username : "Bank";

        let success = 0;
        for (const prop of aiProps) {
          const pid = prop.property_id ?? prop.id;
          try {
            await apiClient.put(`/game-properties/${pid}`, {
              address: targetAddr,
              game_code: game.code,
            });
            success++;
          } catch (e) {
            console.error(`Property ${pid} transfer failed`, e);
          }
        }

        await apiClient.post("/game-players/leave", {
          address: currentPlayer.address,
          code: game.code,
          reason: "bankruptcy",
        });

        toast.success(
          `${success}/${aiProps.length} properties → ${targetName}\n${currentPlayer.username} removed`,
          { id: toastId }
        );
      } catch (err) {
        toast.error("Bankruptcy handling failed", { id: toastId });
        console.error("BANKRUPTCY ERROR", err);
      }
    };

    const timer = setTimeout(handleBankruptcy, 3800);
    return () => clearTimeout(timer);
  }, [isAITurn, currentPlayer, game_properties, game.code, game.players]);

  // Winner detection (simple 1v1 case)
  useEffect(() => {
    if (!me || game.players.length !== 2) return;
    const ai = game.players.find(isAIPlayer);
    if ((!ai || ai.balance <= 0) && me.balance > 0) {
      setWinner(me);
      setEndGameCandidate({
        winner: me,
        position: me.position ?? 0,
        balance: BigInt(me.balance),
      });
    }
  }, [game.players, me]);

  function findPropertyByAddress(gameProperties: any, address: any) {
    // Input validation
    if (!Array.isArray(gameProperties)) {
        console.warn('gameProperties must be an array');
        return null;
    }
    
    if (typeof address !== 'string' || !address.startsWith('0x')) {
        console.warn('Invalid address format');
        return null;
    }

    const normalizedSearch = address.toLowerCase().trim();
    
    return gameProperties.find(prop => {
        if (!prop.address) return false;
        return prop.address.toLowerCase() === normalizedSearch;
    }) || null;
}
// const handleClaimProperty = async (propertyId: number) => {
//   if (!me?.user_id) {
//     toast.error("You must be logged in");
//     return;
//   }

//   const toastId = toast.loading(`Claiming property #${propertyId}...`);
//   // console.log("Attempting to claim property ID:", propertyId);

//   try {

//     const ppt = findPropertyByAddress(game_properties, me.address);
//     console.log("Found property to claim:", ppt);
//     const id = ppt.player_id;
     
//     // const response = await apiClient.get(`/game-properties/${propertyId}`);
//     // console.log("attem :", response.data);
//     // console.log("me", game_properties);
    
//     // if (res.data?.success) {
//     //   toast.success(
//     //     `You now own ${res.data.data?.property_name || "the property"}!`,
//     //     { id: toastId }
//     //   );

  
//     // } else {
//     //   // throw new Error(res.data?.message || "Server reported failure");
//     // }
//     // const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, payload);
  
//     // console.log("Claim response data:", r.data?.address);
//     // console.log("game player:", r.data?.address);
//     // console.log("Claim response:", res.data);
//     const payload = {
//       game_id: game.id,            // usually needed for validation
//       player_id: id,          // the ID of the player claiming the property
      
//     };

//     // console.log("Sending claim payload:", payload);
//     // console.log("Game Properties:", game_properties);
//     // console.log("Game players:", game);
    
//     const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, payload);
    
//     // console.log("game properties:", game_properties);
//     // console.log("Claim response:", res.data);

//     if (res.data?.success) {
//       toast.success(
//         `You now own ${res.data.data?.property_name || "the property"}!`,
//         { id: toastId }
//       );

  
//     } else {
//       // throw new Error(res.data?.message || "Server reported failure");
//     }
//   } catch (err: any) {
//     const errorMessage =
//       err.response?.data?.message ||
//       err.message ||
//       "Failed to claim property";

//     console.error("Claim failed:", {
//       propertyId,
//       payload: err.config?.data,
//       response: err.response?.data,
//     });

//     toast.error(errorMessage, { id: toastId });
//   }
// };
  
const handleClaimProperty = async (propertyId: number) => {
  if (!me?.user_id) {
    toast.error("You must be logged in");
    return;
  }

  const toastId = toast.loading(`Claiming property #${propertyId}...`);

  try {
    // 1. Find any property YOU currently own to extract your game-specific player_id
    const myOwnedProperty = game_properties.find(gp => 
      gp.player_id && 
      game.players.some(p => p.user_id === me.user_id && p.address === gp.address)
    );

    if (!myOwnedProperty?.player_id) {
      throw new Error("Couldn't find your existing property to determine game player ID");
    }

    const myGamePlayerId = myOwnedProperty.player_id;

    console.log(`Found your game player ID: ${myGamePlayerId} from property ${myOwnedProperty.id}`);

    // 2. Now claim the selected property using YOUR game player ID
    const payload = {
      game_id: game.id,
      player_id: myGamePlayerId,       // ← your game-specific player ID
    };

    const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, payload);

    if (res.data?.success) {
      toast.success(
        `You now own ${res.data.data?.property_name || `#${propertyId}`}!`,
        { id: toastId }
      );

      // Optional: refresh game data (add your preferred method)
      // queryClient.invalidateQueries({ queryKey: ['game-properties', game.code] });
      // or temporary: setTimeout(() => window.location.reload(), 1200);
    } else {
      throw new Error(res.data?.message || "Claim reported as unsuccessful");
    }
  } catch (err: any) {
    const errorMessage =
      err.response?.data?.message ||
      err.message ||
      "Failed to claim property";

    console.error("Claim failed:", {
      propertyId,
      payload: err.config?.data ? JSON.parse(err.config.data) : undefined,
      response: err.response?.data,
    });

    toast.error(errorMessage, { id: toastId });
  }
};

return (
    <aside className="w-80 h-full bg-gradient-to-b from-[#0a0e17] to-[#1a0033] border-r-4 border-cyan-500 shadow-2xl shadow-cyan-500/30 overflow-y-auto">
      <div className="p-4 space-y-6">
        <motion.h2
          animate={{ textShadow: ["0 0 10px #0ff", "0 0 20px #0ff", "0 0 10px #0ff"] }}
          transition={{ duration: 3, repeat: Infinity }}
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
          onAccept={() => handleTradeAction(aiTradePopup?.id, "accepted")}
          onDecline={() => handleTradeAction(aiTradePopup?.id, "declined")}
          onCounter={() => handleTradeAction(aiTradePopup?.id, "counter")}
        />

        <AiResponsePopup
          popup={aiResponsePopup}
          properties={properties}
          onClose={() => setAiResponsePopup(null)}
        />

        <VictoryModal
          winner={winner}
          me={me}
          onClaim={() => {/* your claim logic */}}
          claiming={endGamePending}
        />

        <TradeModal
          open={tradeModal.open}
          title={`Trade with ${tradeModal.target?.username || "Player"}`}
          onClose={() => {
            setTradeModal({ open: false, target: null });
            resetTradeFields();
          }}
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
          title="Counter Trade"
          onClose={() => {
            setCounterModal({ open: false, trade: null });
            resetTradeFields();
          }}
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
          targetPlayerAddress={
            game.players.find(p => p.user_id === counterModal.trade?.target_player_id)?.address
          }
        />

        {/* Debug Claim Modal */}
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