"use client";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

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
  roll,
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

  const processedAiTradeIds = useRef<Set<number>>(new Set());

  const toggleEmpire = useCallback(() => setShowEmpire((p) => !p), []);
  const toggleTrade = useCallback(() => setShowTrade((p) => !p), []);
  const isNext = me && game.next_player_id === me.user_id;

  const resetTradeFields = () => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  };

  const isMortgaged = useCallback(
    (property_id: number) =>
      game_properties.find((gp) => gp.property_id === property_id)?.mortgaged ?? false,
    [game_properties]
  );

  const developmentStage = useCallback(
    (property_id: number) =>
      game_properties.find((gp) => gp.property_id === property_id)?.development ?? 0,
    [game_properties]
  );

  const rentPrice = useCallback(
    (property_id: number) => {
      const property = properties.find((p) => p.id === property_id);
      const dev = developmentStage(property_id);
      switch (dev) {
        case 1: return property?.rent_one_house || 0;
        case 2: return property?.rent_two_houses || 0;
        case 3: return property?.rent_three_houses || 0;
        case 4: return property?.rent_four_houses || 0;
        case 5: return property?.rent_hotel || 0;
        default: return property?.rent_site_only || 0;
      }
    },
    [properties, developmentStage]
  );

  const sortedPlayers = useMemo(
    () =>
      [...(game?.players ?? [])].sort(
        (a, b) => (a.turn_order ?? Infinity) - (b.turn_order ?? Infinity)
      ),
    [game?.players]
  );

  const calculateFavorability = useCallback(
    (trade: any) => {
      const offerValue =
        trade.offer_properties.reduce(
          (sum: number, id: number) =>
            sum + (properties.find((p) => p.id === id)?.price || 0),
          0
        ) + (trade.offer_amount || 0);

      const requestValue =
        trade.requested_properties.reduce(
          (sum: number, id: number) =>
            sum + (properties.find((p) => p.id === id)?.price || 0),
          0
        ) + (trade.requested_amount || 0);

      if (requestValue === 0) return 100;
      const ratio = ((offerValue - requestValue) / requestValue) * 100;
      return Math.min(100, Math.max(-100, Math.round(ratio)));
    },
    [properties]
  );

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
        const username = (fromPlayer?.username || "").toLowerCase();
        const isAI =
          username.includes("ai_") ||
          username.includes("bot") ||
          username.includes("computer");

        return isAI;
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
    let isFetching = false;
    let interval: NodeJS.Timeout;

    const startPolling = async () => {
      await fetchTrades();
      interval = setInterval(async () => {
        if (isFetching) return;
        isFetching = true;
        try {
          await fetchTrades();
        } finally {
          isFetching = false;
        }
      }, 5000);
    };

    startPolling();
    return () => clearInterval(interval);
  }, [fetchTrades]);

  useEffect(() => {
    processedAiTradeIds.current.clear();
  }, [game?.id]);

  const handleCreateTrade = async () => {
    if (!me || !tradeModal.target) return;

    const targetPlayer = tradeModal.target;
    const username = (targetPlayer.username || "").toLowerCase();
    const isAI = username.includes("ai_") || username.includes("bot") || username.includes("computer");

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
        toast.error(res?.data?.message || "Failed to create trade");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create trade");
    }
  };

  const handleTradeAction = async (id: number, action: "accepted" | "declined" | "counter") => {
    try {
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
      const res = await apiClient.post<ApiResponse>(
        `/game-trade-requests/${action === "accepted" ? "accept" : "decline"}`,
        { id }
      );
      if (res?.data?.success) {
        toast.success(`Trade ${action}`);
        setAiTradePopup(null);
        fetchTrades();
      } else {
        toast.error("Failed to update trade");
      }
    } catch (error) {
      toast.error("Failed to update trade");
    }
  };

  const submitCounterTrade = async () => {
    if (!me || !counterModal.trade) return;
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
      } else {
        toast.error("Failed to send counter trade");
      }
    } catch (error) {
      toast.error("Failed to send counter trade");
    }
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
      else toast.error(res.data?.message ?? "Failed to develop property");
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

  // ==================== AI AUTO-LIQUIDATION ====================
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
          await handleDowngrade(gp.property_id);
          raised += sellValue;
          toast(`AI sold a house on ${prop.name}`);
        } catch {
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
        await handleMortgage(gp.property_id);
        raised += mortgageValue;
        toast(`AI mortgaged ${prop.name}`);
      } catch {
        break;
      }
    }
    return raised;
  };

  useEffect(() => {
    if (!isAITurn || !currentPlayer || !roll) return;

    const liquidateIfNeeded = async () => {
      if (currentPlayer.balance < 300) {
        toast(`${currentPlayer.username} is low on cash — liquidating assets...`);
        const needed = 500 - currentPlayer.balance;
        await aiSellHouses(needed);
        await aiMortgageProperties(needed);
      }
    };

    const timer = setTimeout(liquidateIfNeeded, 2500);
    return () => clearTimeout(timer);
  }, [isAITurn, currentPlayer, roll, game_properties, properties]);

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

        {sortedPlayers.map((player) => {
          const isWinner = player.user_id === game.winner_id;
          const isNextTurn = player.user_id === game.next_player_id;
          const isMe = player.address?.toLowerCase() === address?.toLowerCase();
          const canTrade = isNext && !player.in_jail && !isMe;

          return (
            <motion.div
              key={player.user_id}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                isNextTurn
                  ? "border-cyan-400 bg-cyan-900/40 shadow-lg shadow-cyan-400/60"
                  : "border-purple-800 bg-purple-900/20"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getPlayerSymbol(player.symbol)}</span>
                  <div className="font-bold text-cyan-200">
                    {player.username || player.address?.slice(0, 6)}
                    {isMe && " (YOU)"}
                    {isWinner && " 👑"}
                  </div>
                </div>
                <div className="text-xl font-bold text-yellow-400">
                  ${player.balance.toLocaleString()}
                </div>
              </div>

              {canTrade && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => startTrade(player)}
                  className="mt-3 w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-bold text-white shadow-lg"
                >
                  TRADE
                </motion.button>
              )}
            </motion.div>
          );
        })}

        <div className="border-t-4 border-purple-600 pt-4">
          <button
            onClick={toggleEmpire}
            className="w-full text-xl font-bold text-purple-300 flex justify-between items-center"
          >
            <span>MY EMPIRE</span>
            <motion.span
              animate={{ rotate: showEmpire ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="text-3xl text-cyan-400"
            >
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {showEmpire && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden mt-3 grid grid-cols-2 gap-3"
              >
                {my_properties.length > 0 ? (
                  my_properties.map((prop, index) => (
                    <motion.div
                      key={prop.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedProperty(prop)}
                      whileHover={{ scale: 1.05 }}
                      className="bg-black/60 border-2 border-cyan-600 rounded-lg p-3 cursor-pointer shadow-md"
                    >
                      {prop.color && (
                        <div className="h-3 rounded" style={{ backgroundColor: prop.color }} />
                      )}
                      <div className="mt-2 text-sm font-bold text-cyan-200 truncate">{prop.name}</div>
                      <div className="text-xs text-green-400">Rent: ${rentPrice(prop.id)}</div>
                      {isMortgaged(prop.id) && (
                        <div className="text-red-500 text-xs mt-1 font-bold animate-pulse">MORTGAGED</div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center text-sm font-medium text-gray-500 py-3 col-span-2">
                    No properties yet..
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t-4 border-pink-600 pt-4">
          <button
            onClick={toggleTrade}
            className="w-full text-xl font-bold text-pink-300 flex justify-between items-center"
          >
            <span>TRADES {tradeRequests.length > 0 && `(${tradeRequests.length} pending)`}</span>
            <motion.span animate={{ rotate: showTrade ? 180 : 0 }} className="text-3xl text-cyan-400">
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {showTrade && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden mt-3 space-y-3"
              >
                {openTrades.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-cyan-400 mb-2 flex items-center gap-2">
                      <span>📤</span>
                      <span>MY ACTIVE TRADES</span>
                    </h4>
                    <div className="space-y-2">
                      {openTrades.map((trade) => {
                        const offeredProps = properties.filter((p) =>
                          trade.offer_properties?.includes(p.id)
                        );
                        const requestedProps = properties.filter((p) =>
                          trade.requested_properties?.includes(p.id)
                        );
                        const targetPlayer = game.players.find(
                          (pl) => pl.user_id === trade.target_player_id
                        );

                        return (
                          <div
                            key={trade.id}
                            className="bg-black/40 border border-cyan-800 rounded-lg p-3 text-sm"
                          >
                            <div className="font-medium text-cyan-200 mb-1">
                              To {targetPlayer?.username || "Player"}
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="text-green-400">
                                Offer: {offeredProps.length ? offeredProps.map((p) => p.name).join(", ") : "nothing"} {trade.offer_amount > 0 && `+ $${trade.offer_amount}`}
                              </div>
                              <div className="text-red-400">
                                Want: {requestedProps.length ? requestedProps.map((p) => p.name).join(", ") : "nothing"} {trade.requested_amount > 0 && `+ $${trade.requested_amount}`}
                              </div>
                            </div>
                            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                              trade.status === 'accepted' 
                                ? 'bg-green-900/50 text-green-300' 
                                : trade.status === 'declined' 
                                ? 'bg-red-900/50 text-red-300' 
                                : 'bg-yellow-900/50 text-yellow-300'
                            }`}>
                              {trade.status.toUpperCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {tradeRequests.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-cyan-400 mb-2 flex items-center gap-2">
                      <span>📥</span>
                      <span>INCOMING REQUESTS</span>
                    </h4>
                    <div className="space-y-2">
                      {tradeRequests.map((trade) => {
                        const offeredProps = properties.filter((p) =>
                          trade.offer_properties?.includes(p.id)
                        );
                        const requestedProps = properties.filter((p) =>
                          trade.requested_properties?.includes(p.id)
                        );
                        const fromPlayer = game.players.find(
                          (pl) => pl.user_id === trade.player_id
                        );

                        return (
                          <div
                            key={trade.id}
                            className="bg-black/40 border border-cyan-800 rounded-lg p-3 text-sm"
                          >
                            <div className="font-medium text-cyan-200 mb-1">
                              From {fromPlayer?.username || "Player"}
                            </div>
                            <div className="text-xs space-y-1 mb-2">
                              <div className="text-green-400">
                                Gives: {offeredProps.length ? offeredProps.map((p) => p.name).join(", ") : "nothing"} {trade.offer_amount > 0 && `+ $${trade.offer_amount}`}
                              </div>
                              <div className="text-red-400">
                                Wants: {requestedProps.length ? requestedProps.map((p) => p.name).join(", ") : "nothing"} {trade.requested_amount > 0 && `+ $${trade.requested_amount}`}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                onClick={() => handleTradeAction(trade.id, "accepted")}
                                className="py-1.5 bg-green-600 rounded text-xs font-bold text-white hover:bg-green-500"
                              >
                                ACCEPT
                              </button>
                              <button
                                onClick={() => handleTradeAction(trade.id, "declined")}
                                className="py-1.5 bg-red-600 rounded text-xs font-bold text-white hover:bg-red-500"
                              >
                                DECLINE
                              </button>
                              <button
                                onClick={() => handleTradeAction(trade.id, "counter")}
                                className="py-1.5 bg-yellow-600 rounded text-xs font-bold text-black hover:bg-yellow-500"
                              >
                                COUNTER
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {openTrades.length === 0 && tradeRequests.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    <div className="text-3xl mb-1">💱</div>
                    <p className="text-sm">No trades yet..</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isNext && selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedProperty(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-br from-purple-900 via-black to-cyan-900 rounded-2xl border-4 border-cyan-400 shadow-2xl shadow-cyan-500/50 p-8 max-w-sm w-full"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-cyan-400/10 rounded-2xl" />
              <button
                onClick={() => setSelectedProperty(null)}
                className="absolute top-4 right-4 text-3xl text-red-400 hover:text-red-300 transition"
              >
                X
              </button>
              <h3 className="text-3xl font-bold text-cyan-300 text-center mb-6 relative z-10">{selectedProperty.name}</h3>
              <div className="grid grid-cols-2 gap-4 relative z-10">
                <button onClick={() => { handleDevelopment(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl font-bold text-white shadow-lg hover:shadow-green-500/50">BUILD</button>
                <button onClick={() => { handleDowngrade(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-gradient-to-r from-orange-600 to-red-700 rounded-xl font-bold text-white shadow-lg hover:shadow-orange-500/50">SELL</button>
                <button onClick={() => { handleMortgage(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl font-bold text-white shadow-lg hover:shadow-blue-500/50">MORTGAGE</button>
                <button onClick={() => { handleUnmortgage(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-gradient-to-r from-purple-600 to-pink-700 rounded-xl font-bold text-white shadow-lg hover:shadow-purple-500/50">REDEEM</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiTradePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            onClick={() => setAiTradePopup(null)}
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-br from-cyan-900 via-purple-900 to-pink-900 rounded-3xl border-4 border-cyan-400 shadow-2xl shadow-cyan-600/60 overflow-hidden max-w-md w-full"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />
              </div>
              <button
                onClick={() => setAiTradePopup(null)}
                className="absolute top-4 right-4 text-3xl text-red-300 hover:text-red-200 transition z-20"
              >
                X
              </button>

              <div className="relative z-10 p-8">
                <h3 className="text-4xl font-bold text-cyan-300 text-center mb-6 drop-shadow-lg">
                  🤖 AI Trade Offer!
                </h3>

                <div className="text-center mb-8 bg-black/50 backdrop-blur-md rounded-2xl py-6 px-8 border border-cyan-500/50">
                  <p className="text-2xl text-white mb-2">
                    This deal is
                  </p>
                  <span
                    className={`text-5xl font-bold drop-shadow-2xl ${
                      calculateFavorability(aiTradePopup) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {calculateFavorability(aiTradePopup) >= 0 ? "+" : ""}
                    {calculateFavorability(aiTradePopup)}%
                  </span>
                  <p className="text-xl text-white mt-2">favorable for you</p>
                  <p className="text-sm text-gray-300 mt-4">
                    {calculateFavorability(aiTradePopup) >= 30
                      ? "🟢 Amazing opportunity!"
                      : calculateFavorability(aiTradePopup) >= 0
                      ? "🟡 Decent deal"
                      : "🔴 Think twice"}
                  </p>
                </div>

                <div className="space-y-4 text-base mb-10">
                  <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 rounded-xl p-4 border border-green-500/50">
                    <span className="font-bold text-green-300">AI Gives:</span>{" "}
                    <span className="text-white">
                      {properties
                        .filter((p) => aiTradePopup.offer_properties?.includes(p.id))
                        .map((p) => p.name)
                        .join(", ") || "nothing"}{" "}
                      {aiTradePopup.offer_amount > 0 && `+ $${aiTradePopup.offer_amount}`}
                    </span>
                  </div>
                  <div className="bg-gradient-to-r from-red-900/60 to-pink-900/60 rounded-xl p-4 border border-red-500/50">
                    <span className="font-bold text-red-300">AI Wants:</span>{" "}
                    <span className="text-white">
                      {properties
                        .filter((p) => aiTradePopup.requested_properties?.includes(p.id))
                        .map((p) => p.name)
                        .join(", ") || "nothing"}{" "}
                      {aiTradePopup.requested_amount > 0 && `+ $${aiTradePopup.requested_amount}`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => {
                      handleTradeAction(aiTradePopup.id, "accepted");
                      setAiTradePopup(null);
                    }}
                    className="py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-green-500/60 transition"
                  >
                    ACCEPT
                  </button>
                  <button
                    onClick={() => {
                      handleTradeAction(aiTradePopup.id, "declined");
                      setAiTradePopup(null);
                    }}
                    className="py-4 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-red-500/60 transition"
                  >
                    DECLINE
                  </button>
                  <button
                    onClick={() => {
                      handleTradeAction(aiTradePopup.id, "counter");
                      setAiTradePopup(null);
                    }}
                    className="py-4 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl font-bold text-black text-lg shadow-lg hover:shadow-yellow-500/60 transition"
                  >
                    COUNTER
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiResponsePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            onClick={() => setAiResponsePopup(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-br from-purple-900 via-indigo-900 to-cyan-900 rounded-3xl border-4 border-yellow-400 shadow-2xl shadow-yellow-600/60 overflow-hidden max-w-md w-full"
            >
              <div className="absolute inset-0 bg-gradient-to-tl from-yellow-500/20 via-transparent to-purple-500/20 animate-pulse" />
              <button
                onClick={() => setAiResponsePopup(null)}
                className="absolute top-4 right-4 text-3xl text-red-300 hover:text-red-200 transition z-20"
              >
                X
              </button>

              <div className="relative z-10 p-8">
                <h3 className="text-4xl font-bold text-yellow-300 text-center mb-8 drop-shadow-2xl">
                  🤖 AI Responds...
                </h3>

                <div className="text-center mb-8 bg-black/60 backdrop-blur-md rounded-2xl py-6 px-8 border border-yellow-500/50">
                  <p className="text-2xl text-white mb-3">
                    Your offer was
                  </p>
                  <span
                    className={`text-5xl font-bold drop-shadow-2xl ${
                      aiResponsePopup.favorability >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {aiResponsePopup.favorability >= 0 ? "+" : ""}
                    {aiResponsePopup.favorability}%
                  </span>
                  <p className="text-xl text-white mt-3">favorable for the AI</p>
                </div>

                <div className="text-center mb-8">
                  <div className={`text-4xl font-bold ${aiResponsePopup.decision === "accepted" ? "text-green-400" : "text-red-400"}`}>
                    {aiResponsePopup.decision === "accepted" ? "✅ ACCEPTED!" : "❌ DECLINED"}
                  </div>
                  <p className="text-2xl italic text-gray-200 mt-4">
                    "{aiResponsePopup.remark}"
                  </p>
                </div>

                <div className="space-y-4 text-base">
                  <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 rounded-xl p-4 border border-green-500/50">
                    <span className="font-bold text-green-300">You Offered:</span>{" "}
                    <span className="text-white">
                      {properties
                        .filter((p) => aiResponsePopup.trade.offer_properties?.includes(p.id))
                        .map((p) => p.name)
                        .join(", ") || "nothing"}{" "}
                      {aiResponsePopup.trade.offer_amount > 0 && `+ $${aiResponsePopup.trade.offer_amount}`}
                    </span>
                  </div>
                  <div className="bg-gradient-to-r from-red-900/60 to-pink-900/60 rounded-xl p-4 border border-red-500/50">
                    <span className="font-bold text-red-300">You Asked For:</span>{" "}
                    <span className="text-white">
                      {properties
                        .filter((p) => aiResponsePopup.trade.requested_properties?.includes(p.id))
                        .map((p) => p.name)
                        .join(", ") || "nothing"}{" "}
                      {aiResponsePopup.trade.requested_amount > 0 && `+ $${aiResponsePopup.trade.requested_amount}`}
                    </span>
                  </div>
                </div>

                <div className="mt-10 text-center">
                  <button
                    onClick={() => setAiResponsePopup(null)}
                    className="px-16 py-5 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl font-bold text-black text-2xl shadow-2xl hover:shadow-yellow-500/80 transition"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </aside>
  );
}

function TradeModal({
  open,
  title,
  onClose,
  onSubmit,
  my_properties,
  properties,
  game_properties,
  offerProperties,
  requestProperties,
  setOfferProperties,
  setRequestProperties,
  offerCash,
  requestCash,
  setOfferCash,
  setRequestCash,
  toggleSelect,
  targetPlayerAddress
}: any) {
  if (!open) return null;

  const targetOwnedProps = useMemo(() => {
    const ownedGameProps = game_properties.filter(
      (gp: any) => gp.address === targetPlayerAddress
    );
    return properties.filter((p: any) =>
      ownedGameProps.some((gp: any) => gp.property_id === p.id)
    );
  }, [game_properties, properties, targetPlayerAddress]);

  const PropertyCard = ({ prop, isSelected, onClick }: { prop: Property; isSelected: boolean; onClick: () => void }) => (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden ${
        isSelected
          ? "border-cyan-400 bg-cyan-900/60 shadow-lg shadow-cyan-400/70"
          : "border-gray-700 hover:border-gray-500 bg-black/40"
      }`}
    >
      {isSelected && (
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 animate-pulse" />
      )}
      {prop.color && (
        <div className="h-6 rounded-t-md -m-3 -mt-3 mb-2" style={{ backgroundColor: prop.color }} />
      )}
      <div className="text-xs font-bold text-cyan-200 text-center leading-tight relative z-10">{prop.name}</div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, rotateY: 10 }}
        animate={{ scale: 1, rotateY: 0 }}
        onClick={(e) => e.stopPropagation()}
      className="relative bg-gradient-to-br from-purple-950 via-black to-cyan-950 rounded-3xl border-4 border-cyan-500 shadow-2xl shadow-cyan-600/70 overflow-hidden max-w-5xl w-full max-h-[95vh] overflow-y-auto"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-cyan-500/10 to-purple-500/10" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-600/20 animate-pulse" />
        </div>

        <button onClick={onClose} className="absolute top-6 right-8 text-5xl text-red-400 hover:text-red-300 transition z-20">
          X
        </button>

        <div className="relative z-10 p-10">
          <h2 className="text-5xl font-bold text-cyan-300 text-center mb-12 drop-shadow-2xl">{title}</h2>

          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-3xl font-bold text-green-400 mb-6 text-center drop-shadow-lg">YOU GIVE</h3>
              <div className="grid grid-cols-3 gap-4">
                {my_properties.map((p: Property) => (
                  <PropertyCard
                    key={p.id}
                    prop={p}
                    isSelected={offerProperties.includes(p.id)}
                    onClick={() => toggleSelect(p.id, offerProperties, setOfferProperties)}
                  />
                ))}
              </div>
              <input
                type="number"
                placeholder="+$ CASH"
                value={offerCash || ""}
                onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                className="w-full mt-8 bg-black/70 border-4 border-green-500 rounded-2xl px-6 py-6 text-green-400 font-bold text-3xl text-center placeholder-green-700 focus:outline-none focus:ring-4 focus:ring-green-500/50 transition"
              />
            </div>

            <div>
              <h3 className="text-3xl font-bold text-red-400 mb-6 text-center drop-shadow-lg">YOU GET</h3>
              <div className="grid grid-cols-3 gap-4">
                {targetOwnedProps.length > 0 ? (
                  targetOwnedProps.map((p: Property) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={requestProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                    />
                  ))
                ) : (
                  <div className="col-span-3 text-center text-gray-500 py-12 text-xl">
                    No properties available
                  </div>
                )}
              </div>
              <input
                type="number"
                placeholder="+$ CASH"
                value={requestCash || ""}
                onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
                className="w-full mt-8 bg-black/70 border-4 border-red-500 rounded-2xl px-6 py-6 text-red-400 font-bold text-3xl text-center placeholder-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/50 Вона transition"
              />
            </div>
          </div>

          <div className="flex justify-center gap-12 mt-16">
            <button onClick={onClose} className="px-16 py-6 bg-gradient-to-r from-gray-700 to-gray-800 rounded-2xl font-bold text-3xl text-gray-300 hover:from-gray-600 hover:to-gray-700 transition shadow-2xl">
              CANCEL
            </button>
            <button
              onClick={onSubmit}
              className="px-20 py-6 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 rounded-2xl font-bold text-3xl text-white shadow-2xl hover:shadow-cyan-500/80 transition"
            >
              SEND DEAL
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}