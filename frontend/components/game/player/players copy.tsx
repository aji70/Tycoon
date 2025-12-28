"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
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
}

export default function GamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
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

  // trade form states
  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState<number>(0);
  const [requestCash, setRequestCash] = useState<number>(0);

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
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

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
        case 1:
          return property?.rent_one_house;
        case 2:
          return property?.rent_two_houses;
        case 3:
          return property?.rent_three_houses;
        case 4:
          return property?.rent_four_houses;
        case 5:
          return property?.rent_hotel;
        default:
          return property?.rent_site_only;
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

  const fetchTrades = useCallback(async () => {
    if (!me || !game?.id) return;
    try {
      const [_initiated, _incoming] = await Promise.all([
        apiClient.get<ApiResponse>(`/game-trade-requests/my/${game.id}/player/${me.user_id}`),
        apiClient.get<ApiResponse>(`/game-trade-requests/incoming/${game.id}/player/${me.user_id}`),
      ]);
      const initiated = _initiated.data?.data || []
      const incoming = _incoming.data?.data || []
      setOpenTrades(initiated);
      setTradeRequests(incoming);
    } catch (err) {
      console.error("Error loading trades:", err);
      toast.error("Failed to load trades");
    }
  }, [me, game?.id]);

  useEffect(() => {
    if (!me || !game?.id) return;
    let isFetching = false;
    let interval: NodeJS.Timeout;

    const startPolling = async () => {
      // Initial load
      await fetchTrades();

      // Poll every 5 seconds
      interval = setInterval(async () => {
        if (isFetching) return; // avoid overlap
        isFetching = true;
        try {
          await fetchTrades();
        } finally {
          isFetching = false;
        }
      }, 5000);
    };

    startPolling();

    // cleanup on unmount
    return () => clearInterval(interval);
  }, [fetchTrades, me, game?.id]);


  // Create new trade
  const handleCreateTrade = async () => {
    if (!me || !tradeModal.target) return;

    try {
      const payload = {
        game_id: game.id,
        player_id: me.user_id,
        target_player_id: tradeModal.target.user_id,
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "pending",
      };

      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success("Trade created successfully");
        setOpenTrades((prev) => [...prev, res.data]);
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        return;
      }
      toast.error(res?.data?.message || "Failed to create trade");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Failed to create trade");
    }
  };

  // Accept, decline, or counter
  const handleTradeAction = async (id: number, action: "accepted" | "declined" | "counter") => {
    try {
      if (action === "counter") {
        const trade = tradeRequests.find((t) => t.id === id);
        if (trade) setCounterModal({ open: true, trade });
        return;
      }
      const res = await apiClient.post<ApiResponse>(`/game-trade-requests/${action == 'accepted' ? 'accept' : 'decline'}`, { id });
      if (res?.data?.success) {
        toast.success(`Trade ${action}`);
        fetchTrades();
        return;
      }
      toast.error("Failed to update trade");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update trade");
    }
  };

  // Submit counter trade update
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
        return;
      }
      toast.error("Failed to send counter trade");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send counter trade");
    }
  };

  const toggleSelect = (id: number, arr: number[], setter: (val: number[]) => void) => {
    if (arr.includes(id)) setter(arr.filter((x) => x !== id));
    else setter([...arr, id]);
  };

  const startTrade = (targetPlayer: Player) => {
    if (!isNext) return;
    setTradeModal({ open: true, target: targetPlayer });
  };

  const handleDevelopment = async (id: number) => {
    if (!isNext || !me) return;

    try {
      const payload = {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      };

      const res = await apiClient.post<ApiResponse>("/game-properties/development", payload);
      if (res?.data?.success) {
        toast.success("Property development successfully");
        return;
      }
      toast.error(res.data?.message ?? "Failed to develop property.");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to develop property..");
    }
  };

  const handleDowngrade = async (id: number) => {
    if (!isNext || !me) return;

    try {
      const payload = {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      };

      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", payload);
      if (res?.data?.success) {
        toast.success("Property downgraded successfully");
        return;
      }
      toast.error(res.data?.message ?? "Failed to downgrade property.");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to downgrade property..");
    }
  };

  const handleMortgage = async (id: number) => {
    if (!isNext || !me) return;

    try {
      const payload = {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      };

      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", payload);
      if (res?.data?.success) {
        toast.success("Property mortgaged successfully");
        return;
      }
      toast.error(res.data?.message ?? "Failed to mortgage property.");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to mortgage property..");
    }
  };

  const handleUnmortgage = async (id: number) => {
    if (!isNext || !me) return;

    try {
      const payload = {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      };

      const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", payload);
      if (res?.data?.success) {
        toast.success("Property unmortgaged successfully");
        return;
      }
      toast.error(res.data?.message ?? "Failed to unmortgage property.");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to unmortgage property..");
    }
  };

  return (
    <aside className="w-72 h-full border-r border-white/10 bg-[#010F10] overflow-y-auto">
      {/* Players List */}
      <header className="p-4 border-b border-cyan-800">
        <h2 className="text-lg font-semibold text-gray-300">Players</h2>
      </header>

      <ul className="divide-y divide-cyan-800">
        {sortedPlayers.map((player) => {
          const isWinner = player.user_id === game.winner_id;
          const isNextTurn = player.user_id === game.next_player_id;
          const isMe = player.address?.toLowerCase() === address?.toLowerCase();
          const canTrade = isNext && !player.in_jail && !isMe;

          return (
            <li
              key={player.user_id}
              className={`p-3 flex flex-col border-l-4 transition-colors ${isNextTurn
                ? "border-cyan-800 bg-cyan-900/20"
                : "border-transparent hover:bg-gray-900/20"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-200">
                  {getPlayerSymbol(player.symbol)} &nbsp;
                  {player.username || player.address?.slice(0, 6)}
                  {isMe && " (Me)"}
                  {isWinner && " 👑"}
                </span>
                <span className="text-xs text-gray-300">{player.balance} 💰</span>
              </div>

              {canTrade && (
                <button
                  onClick={() => startTrade(player)}
                  className="mt-2 text-xs bg-cyan-800/30 hover:bg-cyan-700/50 text-cyan-300 py-1 px-2 rounded transition"
                >
                  💱 Start Trade
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* My Empire Section */}
      <section className="border-t border-gray-800 mt-2">
        <button
          onClick={toggleEmpire}
          className="w-full flex justify-between items-center px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-cyan-900/20 transition"
        >
          <span>🏰 My Empire</span>
          <span className="text-xs text-cyan-400">
            {showEmpire ? "Hide ▲" : "Show ▼"}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {showEmpire && (
            <motion.div
              key="empire-grid"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {my_properties.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 p-2">
                  {my_properties.map((prop, index) => (
                    <motion.div
                      key={prop.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      onClick={() => setSelectedProperty(prop)}
                      whileHover={{ scale: 1.02 }}
                      className="text-sm text-gray-200 cursor-pointer hover:bg-gray-800/50 transition"
                    >
                      <motion.div
                        whileHover={{ y: -1 }}
                        className="rounded-lg border border-gray-700/50 shadow-sm p-2 bg-gradient-to-br from-gray-900/80 to-gray-800/80 h-full"
                      >
                        {prop.color && (
                          <div
                            className="w-full h-2 rounded mb-2 shadow"
                            style={{ backgroundColor: prop.color }}
                          />
                        )}

                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-gray-100 text-xs">{prop.name}</span>
                          <span className="text-xs bg-cyan-900/40 text-cyan-300 px-1 py-0.5 rounded">
                            #{prop.id}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">💵 Price</span>
                            <span className="font-medium text-gray-200">{prop.price}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">🏠 Rent</span>
                            <span className="font-medium text-green-400">{rentPrice(prop.id)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">🏗️ Level</span>
                            <span className="font-medium text-cyan-400">{developmentStage(prop.id)}</span>
                          </div>
                        </div>

                        {isMortgaged(prop.id) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="mt-2 p-1 bg-red-900/30 border border-red-500/30 rounded text-center"
                          >
                            <span className="text-red-400 text-xs font-medium">🔒 Mortgaged</span>
                          </motion.div>
                        )}
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm font-medium text-gray-500 py-3">
                  No properties yet..
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Trade Section */}
      <section className="border-t border-gray-800 mt-2">
        <button
          onClick={toggleTrade}
          className="w-full flex justify-between items-center px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-cyan-900/20 transition"
        >
          <span>💱 Trade</span>
          <span className="text-xs text-cyan-400">{showTrade ? "Hide ▲" : "Show ▼"}</span>
        </button>

        <AnimatePresence>
          {showTrade && (
            <motion.div
              key="trade-section"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-3 space-y-3 text-sm text-gray-300"
            >
              {/* My Trades */}
              {openTrades.length > 0 && (
                <div>
                  <h4 className="font-semibold text-cyan-400 mb-2 flex items-center space-x-1">
                    <span>📤</span>
                    <span>My Active Trades</span>
                  </h4>
                  <AnimatePresence>
                    {openTrades.map((trade, index) => {
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
                        <motion.div
                          key={trade.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.05 }}
                          className="border border-cyan-800/50 rounded-lg p-2 bg-gradient-to-br from-gray-900/50 to-gray-800/50 mb-2"
                        >
                          <div className="flex justify-between items-center mb-1 text-xs">
                            <span className="text-gray-200">
                              With {targetPlayer?.username || targetPlayer?.address?.slice(0, 6)}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${trade.status === 'accepted' 
                              ? 'bg-green-900/40 text-green-300' 
                              : trade.status === 'declined' 
                              ? 'bg-red-900/40 text-red-300' 
                              : 'bg-yellow-900/40 text-yellow-300'
                            }`}>
                              {trade.status}
                            </span>
                          </div>

                          {/* Your Offer */}
                          <div className="mb-1">
                            <h5 className="font-medium text-cyan-300 mb-1 text-xs">📤 Your Offer</h5>
                            <div className="space-y-1 text-xs">
                              {offeredProps.length > 0 ? (
                                offeredProps.map((prop) => (
                                  <div key={prop.id} className="flex justify-between items-center bg-gray-800/30 p-1 rounded">
                                    <span className="text-gray-300 truncate flex-1">{prop.name}</span>
                                    <span className="text-green-400 ml-1">💵 {prop.price}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500 italic p-1">No properties</div>
                              )}
                              {trade.offer_amount > 0 && (
                                <div className="flex justify-between items-center bg-green-900/20 p-1 rounded">
                                  <span className="text-gray-300">💰 Cash</span>
                                  <span className="text-green-400 font-medium">{trade.offer_amount}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Their Offer */}
                          <div className="mb-1">
                            <h5 className="font-medium text-cyan-300 mb-1 text-xs">📥 Their Offer</h5>
                            <div className="space-y-1 text-xs">
                              {requestedProps.length > 0 ? (
                                requestedProps.map((prop) => (
                                  <div key={prop.id} className="flex justify-between items-center bg-gray-800/30 p-1 rounded">
                                    <span className="text-gray-300 truncate flex-1">{prop.name}</span>
                                    <span className="text-green-400 ml-1">💵 {prop.price}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500 italic p-1">No properties</div>
                              )}
                              {trade.requested_amount > 0 && (
                                <div className="flex justify-between items-center bg-green-900/20 p-1 rounded">
                                  <span className="text-gray-300">💰 Cash</span>
                                  <span className="text-green-400 font-medium">{trade.requested_amount}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* Trade Requests */}
              {tradeRequests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-cyan-400 mb-2 flex items-center space-x-1">
                    <span>📥</span>
                    <span>Incoming Requests</span>
                  </h4>
                  <AnimatePresence>
                    {tradeRequests.map((trade, index) => {
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
                        <motion.div
                          key={trade.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.05 }}
                          className="border border-gray-700/50 rounded-lg p-2 bg-gradient-to-br from-gray-900/50 to-gray-800/50 mb-2"
                        >
                          <div className="flex justify-between items-center mb-1 text-xs">
                            <span className="text-gray-200">
                              From {fromPlayer?.username || fromPlayer?.address?.slice(0, 6)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-900/40 text-yellow-300">
                              Pending
                            </span>
                          </div>

                          {/* Their Offer */}
                          <div className="mb-1">
                            <h5 className="font-medium text-cyan-300 mb-1 text-xs">📤 Their Offer</h5>
                            <div className="space-y-1 text-xs">
                              {offeredProps.length > 0 ? (
                                offeredProps.map((prop) => (
                                  <div key={prop.id} className="flex justify-between items-center bg-gray-800/30 p-1 rounded">
                                    <span className="text-gray-300 truncate flex-1">{prop.name}</span>
                                    <span className="text-green-400 ml-1">💵 {prop.price}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500 italic p-1">No properties</div>
                              )}
                              {trade.offer_amount > 0 && (
                                <div className="flex justify-between items-center bg-green-900/20 p-1 rounded">
                                  <span className="text-gray-300">💰 Cash</span>
                                  <span className="text-green-400 font-medium">{trade.offer_amount}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Your Request */}
                          <div className="mb-2">
                            <h5 className="font-medium text-cyan-300 mb-1 text-xs">📥 Your Request</h5>
                            <div className="space-y-1 text-xs">
                              {requestedProps.length > 0 ? (
                                requestedProps.map((prop) => (
                                  <div key={prop.id} className="flex justify-between items-center bg-gray-800/30 p-1 rounded">
                                    <span className="text-gray-300 truncate flex-1">{prop.name}</span>
                                    <span className="text-green-400 ml-1">💵 {prop.price}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500 italic p-1">No properties</div>
                              )}
                              {trade.requested_amount > 0 && (
                                <div className="flex justify-between items-center bg-green-900/20 p-1 rounded">
                                  <span className="text-gray-300">💰 Cash</span>
                                  <span className="text-green-400 font-medium">{trade.requested_amount}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex justify-center space-x-2 pt-1 border-t border-gray-700/50 text-xs">
                            <motion.button
                              onClick={() => handleTradeAction(trade.id, "accepted")}
                              whileHover={{ scale: 1.05 }}
                              className="px-2 py-1 bg-green-800/60 hover:bg-green-700/70 rounded text-green-200 font-medium border border-green-500/30 transition flex-1 mr-0.5"
                            >
                              ✅ Accept
                            </motion.button>
                            <motion.button
                              onClick={() => handleTradeAction(trade.id, "declined")}
                              whileHover={{ scale: 1.05 }}
                              className="px-2 py-1 bg-red-800/60 hover:bg-red-700/70 rounded text-red-200 font-medium border border-red-500/30 transition flex-1 mx-0.5"
                            >
                              ❌ Decline
                            </motion.button>
                            <motion.button
                              onClick={() => handleTradeAction(trade.id, "counter")}
                              whileHover={{ scale: 1.05 }}
                              className="px-2 py-1 bg-cyan-800/60 hover:bg-cyan-700/70 rounded text-cyan-200 font-medium border border-cyan-500/30 transition flex-1 ml-0.5"
                            >
                              💱 Counter
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {openTrades.length === 0 && tradeRequests.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-gray-500 py-3"
                >
                  <div className="text-xl mb-1">💱</div>
                  <p className="text-xs">No trades yet..</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Property Modal */}
      <AnimatePresence>
        {isNext && selectedProperty && (
          <motion.div
            key="property-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-gray-900 rounded-2xl shadow-2xl w-96 border border-cyan-900/50 backdrop-blur-sm"
            >
              {/* Header */}
              <div className="p-6 border-b border-cyan-800/50 flex justify-between items-center">
                <h4 className="text-xl font-bold text-gray-100">
                  {selectedProperty.name}
                </h4>
                <motion.button
                  onClick={() => setSelectedProperty(null)}
                  whileHover={{ scale: 1.1 }}
                  className="text-gray-400 hover:text-gray-200 p-1 rounded-full transition"
                >
                  ✖
                </motion.button>
              </div>

              {/* Property Details */}
              <div className="p-6 space-y-4">
                {selectedProperty.color && (
                  <div
                    className="w-full h-4 rounded-xl shadow-inner"
                    style={{ backgroundColor: selectedProperty.color }}
                  />
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs uppercase tracking-wide">Price</div>
                    <div className="font-bold text-gray-100">💵 {selectedProperty.price}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs uppercase tracking-wide">Current Rent</div>
                    <div className="font-bold text-gray-100">🏠 {rentPrice(selectedProperty.id)}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs uppercase tracking-wide">Development</div>
                    <div className="font-bold text-gray-100">{developmentStage(selectedProperty.id)} 🏠</div>
                  </div>
                  {isMortgaged(selectedProperty.id) && (
                    <div className="bg-red-900/30 rounded-lg p-3 border border-red-500/30">
                      <div className="text-red-400 text-xs uppercase tracking-wide">Status</div>
                      <div className="font-bold text-red-300">🔒 Mortgaged</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-gray-700/50 pt-6">
                <h5 className="text-cyan-400 font-semibold mb-4 text-center">Quick Actions</h5>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    onClick={() => handleDevelopment(selectedProperty.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="py-3 px-4 bg-gradient-to-r from-green-800/60 to-green-700/60 hover:from-green-700/70 hover:to-green-600/70 rounded-xl text-green-200 font-medium shadow-lg border border-green-500/30 transition-all"
                  >
                    🏗️ Develop
                  </motion.button>
                  <motion.button
                    onClick={() => handleDowngrade(selectedProperty.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="py-3 px-4 bg-gradient-to-r from-yellow-800/60 to-yellow-700/60 hover:from-yellow-700/70 hover:to-yellow-600/70 rounded-xl text-yellow-200 font-medium shadow-lg border border-yellow-500/30 transition-all"
                  >
                    🏚️ Downgrade
                  </motion.button>
                  <motion.button
                    onClick={() => handleMortgage(selectedProperty.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="py-3 px-4 bg-gradient-to-r from-blue-800/60 to-blue-700/60 hover:from-blue-700/70 hover:to-blue-600/70 rounded-xl text-blue-200 font-medium shadow-lg border border-blue-500/30 transition-all"
                  >
                    💰 Mortgage
                  </motion.button>
                  <motion.button
                    onClick={() => handleUnmortgage(selectedProperty.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="py-3 px-4 bg-gradient-to-r from-purple-800/60 to-purple-700/60 hover:from-purple-700/70 hover:to-purple-600/70 rounded-xl text-purple-200 font-medium shadow-lg border border-purple-500/30 transition-all"
                  >
                    💸 Unmortgage
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create + Counter Modals */}
      <TradeModal
        open={tradeModal.open}
        title={`Trade with ${tradeModal.target?.username}`}
        onClose={() => setTradeModal({ open: false, target: null })}
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
        onClose={() => setCounterModal({ open: false, trade: null })}
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

/* --- Shared TradeModal --- */

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
    const validTypes = ["land", "railway", "utility"];
    // Filter game_properties by player ownership and valid type
    const ownedGameProps = game_properties.filter(
      (gp: any) =>
        gp.address == targetPlayerAddress
    );

    // Map to property details
    return properties.filter((p: any) =>
      ownedGameProps.some((gp: any) => gp.property_id === p.id)
    );
  }, [game_properties, properties, targetPlayerAddress]);

  return (
    <AnimatePresence>
      <motion.div
        key="modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="bg-gray-900 border border-cyan-900/50 rounded-2xl w-[95%] max-w-4xl p-6 text-sm text-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-cyan-800/30">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-cyan-900/30 rounded-xl">💱</div>
              <h3 className="font-bold text-xl text-cyan-300">{title}</h3>
            </div>
            <motion.button 
              onClick={onClose} 
              whileHover={{ scale: 1.1 }}
              className="text-gray-400 hover:text-gray-200 p-2 rounded-full transition"
            >
              ✖
            </motion.button>
          </div>

          {/* Trade Sections */}
          <div className="space-y-6">
            {/* Your Offer */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50"
            >
              <h4 className="font-semibold text-cyan-300 mb-4 flex items-center space-x-2">
                <div className="p-1 bg-green-900/30 rounded">📤</div>
                <span>Your Offer</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {my_properties.map((prop: Property) => (
                  <motion.div
                    key={prop.id}
                    whileHover={{ scale: 1.05 }}
                    onClick={() =>
                      toggleSelect(prop.id, offerProperties, setOfferProperties)
                    }
                    className={`border rounded-lg p-3 cursor-pointer transition-all shadow-md hover:shadow-cyan-500/25 ${offerProperties.includes(prop.id)
                      ? "border-cyan-500 bg-cyan-900/40 ring-2 ring-cyan-500/30"
                      : "border-gray-700 hover:bg-gray-700/40"
                      }`}
                  >
                    {prop.color && (
                      <div
                        className="w-full h-3 rounded-md mb-2 shadow-inner"
                        style={{ backgroundColor: prop.color }}
                      />
                    )}
                    <div className="text-xs font-bold text-gray-100 truncate">
                      {prop.name}
                    </div>
                    <div className="text-[10px] text-gray-400">💵 {prop.price}</div>
                  </motion.div>
                ))}
              </div>
              <input
                type="number"
                className="w-full bg-gray-800/70 rounded-xl p-3 border border-gray-700/50 text-gray-100 placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none transition"
                placeholder="💰 Additional Cash"
                value={offerCash || ""}
                onChange={(e) => setOfferCash(Number(e.target.value))}
              />
            </motion.div>

            {/* Exchange Arrow */}
            <div className="flex justify-center">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-2xl text-cyan-400"
              >
                ➡️
              </motion.div>
            </div>

            {/* Request */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50"
            >
              <h4 className="font-semibold text-cyan-300 mb-4 flex items-center space-x-2">
                <div className="p-1 bg-red-900/30 rounded">📥</div>
                <span>Request From Them</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {targetOwnedProps.length > 0 ? (
                  targetOwnedProps.map((prop: Property) => (
                    <motion.div
                      key={prop.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={() =>
                        toggleSelect(prop.id, requestProperties, setRequestProperties)
                      }
                      className={`border rounded-lg p-3 cursor-pointer transition-all shadow-md hover:shadow-cyan-500/25 ${requestProperties.includes(prop.id)
                        ? "border-cyan-500 bg-cyan-900/40 ring-2 ring-cyan-500/30"
                        : "border-gray-700 hover:bg-gray-700/40"
                        }`}
                    >
                      {prop.color && (
                        <div
                          className="w-full h-3 rounded-md mb-2 shadow-inner"
                          style={{ backgroundColor: prop.color }}
                        />
                      )}
                      <div className="text-xs font-bold text-gray-100 truncate">
                        {prop.name}
                      </div>
                      <div className="text-[10px] text-gray-400">💵 {prop.price}</div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-6 text-gray-500">
                    <div className="text-3xl mb-2">🤷</div>
                    <p className="text-xs">No tradable properties available.</p>
                  </div>
                )}
              </div>
              <input
                type="number"
                className="w-full bg-gray-800/70 rounded-xl p-3 border border-gray-700/50 text-gray-100 placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none transition"
                placeholder="💰 Request Cash"
                value={requestCash || ""}
                onChange={(e) => setRequestCash(Number(e.target.value))}
              />
            </motion.div>

            {/* Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-end gap-3 pt-6 border-t border-cyan-800/30"
            >
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                className="px-6 py-3 rounded-xl bg-gray-700/70 hover:bg-gray-600/70 text-gray-300 font-medium shadow-lg border border-gray-600/30 transition-all"
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={onSubmit}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-700/80 to-cyan-600/80 hover:from-cyan-600/90 hover:to-cyan-500/90 text-white font-semibold shadow-lg border border-cyan-500/30 transition-all"
              >
                Submit Trade
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}