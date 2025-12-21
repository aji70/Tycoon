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

export default function MobileGamePlayers({
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
    <aside className="w-full md:w-80 h-full bg-gradient-to-b from-[#0a0e17] to-[#1a0033] border-r-4 md:border-r-4 border-cyan-500 shadow-2xl shadow-cyan-500/50 overflow-y-auto relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/80" />

      <div className="p-2 sm:p-4 space-y-4 sm:space-y-6">
        <motion.h2
          animate={{ textShadow: ["0 0 10px #0ff", "0 0 20px #0ff", "0 0 10px #0ff"] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-xl sm:text-2xl font-bold text-cyan-300 text-center tracking-widest"
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
              className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                isNextTurn
                  ? "border-cyan-400 bg-cyan-900/40 shadow-lg shadow-cyan-400/60"
                  : "border-purple-800 bg-purple-900/20"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-3xl">{getPlayerSymbol(player.symbol)}</span>
                  <div className="font-bold text-cyan-200 text-sm sm:text-base">
                    {player.username || player.address?.slice(0, 6)}
                    {isMe && " (YOU)"}
                    {isWinner && " 👑"}
                  </div>
                </div>
                <div className="text-base sm:text-xl font-bold text-yellow-400">
                  ${player.balance.toLocaleString()}
                </div>
              </div>

              {canTrade && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => startTrade(player)}
                  className="mt-2 sm:mt-3 w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-bold text-sm sm:text-base text-white shadow-lg"
                >
                  TRADE
                </motion.button>
              )}
            </motion.div>
          );
        })}

        <div className="border-t-4 border-purple-600 pt-3 sm:pt-4">
          <button
            onClick={toggleEmpire}
            className="w-full text-lg sm:text-xl font-bold text-purple-300 flex justify-between items-center"
          >
            <span>MY EMPIRE</span>
            <motion.span
              animate={{ rotate: showEmpire ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="text-2xl sm:text-3xl text-cyan-400"
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
                className="overflow-hidden mt-2 sm:mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3"
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
                      className="bg-black/60 border-2 border-cyan-600 rounded-lg p-2 sm:p-3 cursor-pointer shadow-md"
                    >
                      {prop.color && (
                        <div className="h-2 sm:h-3 rounded" style={{ backgroundColor: prop.color }} />
                      )}

                      <div className="mt-1 sm:mt-2 text-xs sm:text-sm font-bold text-cyan-200 truncate">{prop.name}</div>
                      <div className="text-xxs sm:text-xs text-green-400">Rent: ${rentPrice(prop.id)}</div>
                      {isMortgaged(prop.id) && (
                        <div className="text-red-500 text-xxs sm:text-xs mt-1 font-bold animate-pulse">MORTGAGED</div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2 sm:py-3 col-span-2 sm:col-span-3">
                    No properties yet..
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t-4 border-pink-600 pt-3 sm:pt-4">
          <button
            onClick={toggleTrade}
            className="w-full text-lg sm:text-xl font-bold text-pink-300 flex justify-between items-center"
          >
            <span>TRADES {tradeRequests.length > 0 && `(${tradeRequests.length} pending)`}</span>
            <motion.span animate={{ rotate: showTrade ? 180 : 0 }} className="text-2xl sm:text-3xl text-cyan-400">
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {showTrade && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden mt-3 sm:mt-4 space-y-3 sm:space-y-4"
              >
                {openTrades.length > 0 && (
                  <div>
                    <h4 className="text-lg sm:text-xl font-bold text-cyan-400 mb-1 sm:mb-2 flex items-center space-x-1">
                      <span>📤</span>
                      <span>MY ACTIVE TRADES</span>
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
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-gradient-to-br from-purple-900/60 to-cyan-900/40 border-2 border-cyan-500 rounded-xl p-3 sm:p-5"
                          >
                            <div className="font-bold text-cyan-300 mb-2 sm:mb-3 text-sm sm:text-base">
                              With {targetPlayer?.username || targetPlayer?.address?.slice(0, 6)}
                            </div>
                            <div className="text-xs sm:text-sm space-y-1 sm:space-y-2 mb-3 sm:mb-4">
                              <div className="text-green-400">
                                Gives: {offeredProps.length ? offeredProps.map((p) => p.name).join(", ") : "nothing"} + ${trade.offer_amount || 0}
                              </div>
                              <div className="text-red-400">
                                Wants: {requestedProps.length ? requestedProps.map((p) => p.name).join(", ") : "nothing"} + ${trade.requested_amount || 0}
                              </div>
                            </div>
                            <span className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${trade.status === 'accepted' 
                              ? 'bg-green-900/40 text-green-300' 
                              : trade.status === 'declined' 
                              ? 'bg-red-900/40 text-red-300' 
                              : 'bg-yellow-900/40 text-yellow-300'
                            }`}>
                              {trade.status.toUpperCase()}
                            </span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {tradeRequests.length > 0 && (
                  <div>
                    <h4 className="text-lg sm:text-xl font-bold text-cyan-400 mb-1 sm:mb-2 flex items-center space-x-1">
                      <span>📥</span>
                      <span>INCOMING REQUESTS</span>
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
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-gradient-to-br from-purple-900/60 to-cyan-900/40 border-2 border-cyan-500 rounded-xl p-3 sm:p-5"
                          >
                            <div className="font-bold text-cyan-300 mb-2 sm:mb-3 text-sm sm:text-base">
                              From {fromPlayer?.username || fromPlayer?.address?.slice(0, 6)}
                            </div>
                            <div className="text-xs sm:text-sm space-y-1 sm:space-y-2 mb-3 sm:mb-4">
                              <div className="text-green-400">
                                Gives: {offeredProps.length ? offeredProps.map((p) => p.name).join(", ") : "nothing"} + ${trade.offer_amount || 0}
                              </div>
                              <div className="text-red-400">
                                Wants: {requestedProps.length ? requestedProps.map((p) => p.name).join(", ") : "nothing"} + ${trade.requested_amount || 0}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1 sm:gap-2">
                              <button
                                onClick={() => handleTradeAction(trade.id, "accepted")}
                                className="py-1 sm:py-2 bg-green-600 rounded font-bold text-xs sm:text-base text-white hover:bg-green-500"
                              >
                                ACCEPT
                              </button>
                              <button
                                onClick={() => handleTradeAction(trade.id, "declined")}
                                className="py-1 sm:py-2 bg-red-600 rounded font-bold text-xs sm:text-base text-white hover:bg-red-500"
                              >
                                DECLINE
                              </button>
                              <button
                                onClick={() => handleTradeAction(trade.id, "counter")}
                                className="py-1 sm:py-2 bg-yellow-600 rounded font-bold text-xs sm:text-base text-black hover:bg-yellow-500"
                              >
                                COUNTER
                              </button>
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
                    className="text-center text-gray-500 py-2 sm:py-3"
                  >
                    <div className="text-2xl sm:text-3xl mb-1">💱</div>
                    <p className="text-xs sm:text-sm">No trades yet..</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Property Modal */}
      <AnimatePresence>
        {isNext && selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
            onClick={() => setSelectedProperty(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-br from-purple-900 to-cyan-900 rounded-2xl border-4 border-cyan-400 shadow-2xl p-4 sm:p-8 max-w-xs sm:max-w-sm w-full"
            >
              <button
                onClick={() => setSelectedProperty(null)}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 text-2xl sm:text-3xl text-red-400 hover:text-red-300 transition"
              >
                X
              </button>
              <h3 className="text-2xl sm:text-3xl font-bold text-cyan-300 text-center mb-4 sm:mb-6">{selectedProperty.name}</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <button onClick={() => { handleDevelopment(selectedProperty.id); setSelectedProperty(null); }} className="py-3 sm:py-4 bg-green-600 rounded-xl font-bold text-sm sm:text-base text-white shadow-lg">BUILD</button>
                <button onClick={() => { handleDowngrade(selectedProperty.id); setSelectedProperty(null); }} className="py-3 sm:py-4 bg-orange-600 rounded-xl font-bold text-sm sm:text-base text-white shadow-lg">SELL</button>
                <button onClick={() => { handleMortgage(selectedProperty.id); setSelectedProperty(null); }} className="py-3 sm:py-4 bg-blue-600 rounded-xl font-bold text-sm sm:text-base text-white shadow-lg">MORTGAGE</button>
                <button onClick={() => { handleUnmortgage(selectedProperty.id); setSelectedProperty(null); }} className="py-3 sm:py-4 bg-purple-600 rounded-xl font-bold text-sm sm:text-base text-white shadow-lg">REDEEM</button>
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

  const PropertyCard = ({ prop, isSelected, onClick }: { prop: Property; isSelected: boolean; onClick: () => void }) => (
    <div
      onClick={onClick}
      className={`p-2 sm:p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col gap-1 sm:gap-2 ${
        isSelected
          ? "border-cyan-400 bg-cyan-900/50 shadow-lg shadow-cyan-400/50"
          : "border-gray-700 hover:border-gray-500"
      }`}
    >
      {prop.color && (
        <div className="h-2 sm:h-3 rounded -m-2 sm:-m-3 -mt-2 sm:-mt-3 mb-1 sm:mb-2" style={{ backgroundColor: prop.color }} />
      )}
      <div className="text-xs sm:text-sm font-bold text-cyan-200 text-center leading-tight">{prop.name}</div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-purple-900 to-black rounded-2xl border-4 border-cyan-500 shadow-2xl p-4 sm:p-8 max-w-full w-full max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-2 sm:top-4 right-4 sm:right-6 text-3xl sm:text-4xl text-red-400 hover:text-red-300 transition z-10">
          X
        </button>

        <h2 className="text-2xl sm:text-4xl font-bold text-cyan-300 text-center mb-4 sm:mb-8">{title}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-green-400 mb-2 sm:mb-4 text-center">YOU GIVE</h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
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
              className="w-full mt-4 sm:mt-6 bg-black/60 border-2 border-green-500 rounded-lg px-3 sm:px-4 py-3 sm:py-4 text-green-400 font-bold text-xl sm:text-2xl text-center placeholder-green-700"
            />
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-red-400 mb-2 sm:mb-4 text-center">YOU GET</h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
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
                <div className="col-span-3 text-center text-gray-500 py-6 sm:py-8 text-sm sm:text-base">
                  No properties available
                </div>
              )}
            </div>
            <input
              type="number"
              placeholder="+$ CASH"
              value={requestCash || ""}
              onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
              className="w-full mt-4 sm:mt-6 bg-black/60 border-2 border-red-500 rounded-lg px-3 sm:px-4 py-3 sm:py-4 text-red-400 font-bold text-xl sm:text-2xl text-center placeholder-red-700"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8 mt-6 sm:mt-12">
          <button onClick={onClose} className="px-8 sm:px-12 py-4 sm:py-5 bg-gray-800 rounded-xl font-bold text-xl sm:text-2xl text-gray-300 hover:bg-gray-700 transition">
            CANCEL
          </button>
          <button
            onClick={onSubmit}
            className="px-8 sm:px-16 py-4 sm:py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold text-xl sm:text-2xl text-white shadow-lg hover:shadow-cyan-500/50 transition"
          >
            SEND DEAL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}