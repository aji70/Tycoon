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
  const [showEmpire, setShowEmpire] = useState(true);
  const [showTrades, setShowTrades] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Trade modals
  const [tradeModal, setTradeModal] = useState<{ open: boolean; target: Player | null }>({
    open: false,
    target: null,
  });
  const [counterModal, setCounterModal] = useState<{ open: boolean; trade: any | null }>({
    open: false,
    trade: null,
  });

  // Trade form
  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);

  // Trade data
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [incomingTrades, setIncomingTrades] = useState<any[]>([]);

  const isNext = me && game.next_player_id === me.user_id;

  const resetTradeFields = () => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  };

  // Helpers
  const isMortgaged = useCallback(
    (id: number) => game_properties.find((gp) => gp.property_id === id)?.mortgaged ?? false,
    [game_properties]
  );

  const developmentStage = useCallback(
    (id: number) => game_properties.find((gp) => gp.property_id === id)?.development ?? 0,
    [game_properties]
  );

  const rentPrice = useCallback(
    (id: number): number => {
      const p = properties.find((prop) => prop.id === id);
      if (!p) return 0;
      const dev = developmentStage(id);
      const rents = [
        p.rent_site_only,
        p.rent_one_house,
        p.rent_two_houses,
        p.rent_three_houses,
        p.rent_four_houses,
        p.rent_hotel,
      ];
      return rents[dev] ?? 0;
    },
    [properties, developmentStage]
  );

  const sortedPlayers = useMemo(
    () =>
      [...(game?.players ?? [])].sort(
        (a: Player, b: Player) => (a.turn_order ?? 99) - (b.turn_order ?? 99)
      ),
    [game?.players]
  );

  const toggleSelect = (
    id: number,
    arr: number[],
    setter: React.Dispatch<React.SetStateAction<number[]>>
  ) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startTrade = (p: Player) => {
    if (!isNext) {
      toast.error("Not your turn!");
      return;
    }
    setTradeModal({ open: true, target: p });
    resetTradeFields();
  };

  // ———— TRADE POLLING + AI AUTO-ACCEPT (FULLY WORKING) ————
  const fetchTrades = useCallback(async () => {
    if (!me || !game?.id) return;

    try {
      const [outRes, inRes] = await Promise.all([
        apiClient.get<ApiResponse>(`/game-trade-requests/my/${game.id}/player/${me.user_id}`),
        apiClient.get<ApiResponse>(`/game-trade-requests/incoming/${game.id}/player/${me.user_id}`),
      ]);

      setOpenTrades(outRes.data?.data || []);
      setIncomingTrades(inRes.data?.data || []);

      // ———— AI INSTANT ACCEPT LOGIC ————
      const incoming = inRes.data?.data || [];
      for (const trade of incoming) {
        if (trade.status !== "pending") continue;

        const fromPlayer = game.players.find((p: Player) => p.user_id === trade.player_id);
        const username = (fromPlayer?.username || "").toLowerCase();
        const isAI = username.includes("ai") || username.includes("bot") || username.includes("computer");

        if (!isAI) continue;

        const givesProperty = (trade.offer_properties?.length || 0) > 0;
        const cashFair = (trade.offer_amount || 0) >= (trade.requested_amount || 0);

        if (givesProperty || cashFair) {
          try {
            await apiClient.post("/game-trade-requests/accept", { id: trade.id });
            toast.success(`${fromPlayer?.username || "AI"} accepted instantly!`, {
              icon: "Robot",
              duration: 4000,
            });
            // Refetch to update UI immediately
            fetchTrades();
          } catch (err) {
            console.error("AI failed to accept trade", err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch trades", err);
    }
  }, [me, game?.id, game.players]);

  useEffect(() => {
    if (!me || !game?.id) return;
    fetchTrades();
    const interval = setInterval(fetchTrades, 4000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  // ———— TRADE ACTIONS ————
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
      };

      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res.data?.success) {
        toast.success("Trade sent successfully!");
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        fetchTrades();
      } else {
        toast.error(res.data?.message || "Failed to send trade");
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

  // ———— PROPERTY ACTIONS ————
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

        {/* Players List */}
        {sortedPlayers.map((p: Player) => {
          const isMe = p.address?.toLowerCase() === address?.toLowerCase();
          const isTurn = p.user_id === game.next_player_id;
          const canTrade = isNext && !p.in_jail && !isMe;
          const displayName = p.username || p.address?.slice(0, 6) || "Player";
          const isAI = displayName.toLowerCase().includes("ai") || displayName.toLowerCase().includes("bot");

          return (
            <motion.div
              key={p.user_id}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-xl border-2 transition-all ${isTurn ? "border-cyan-400 bg-cyan-900/40 shadow-lg shadow-cyan-400/60" : "border-purple-800 bg-purple-900/20"}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getPlayerSymbol(p.symbol)}</span>
                  <div className="font-bold text-cyan-200">
                    {displayName}
                    {isMe && " (ME)"}
                    {isAI && " (AI)"}
                  </div>
                </div>
                <div className="text-xl font-bold text-yellow-400">
                  ${p.balance.toLocaleString()}
                </div>
              </div>
              {canTrade && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => startTrade(p)}
                  className="mt-3 w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-bold text-white shadow-lg"
                >
                  TRADE
                </motion.button>
              )}
            </motion.div>
          );
        })}

        {/* My Empire */}
        <div className="border-t-4 border-purple-600 pt-4">
     <button
  onClick={() => setShowEmpire(v => !v)}
  className="w-full text-xl font-bold text-purple-300 flex justify-between items-center"
>
  <span>MY EMPIRE</span>

  <motion.span
    animate={{ rotate: showEmpire ? 180 : 0, textShadow: ["0 0 10px #0ff", "0 0 20px #0ff"] }}
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
                {my_properties.map((prop, i) => (
                  <motion.div
                    key={prop.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => isNext && setSelectedProperty(prop)}
                    whileHover={{ scale: 1.05 }}
                    className="bg-black/60 border-2 border-cyan-600 rounded-lg p-3 cursor-pointer shadow-md"
                  >
                    {prop.color && <div className="h-3 rounded" style={{ backgroundColor: prop.color }} />}
                    <div className="mt-2 text-sm font-bold text-cyan-200 truncate">{prop.name}</div>
                    <div className="text-xs text-green-400">Rent: ${rentPrice(prop.id)}</div>
                    {isMortgaged(prop.id) && (
                      <div className="text-red-500 text-xs mt-1 font-bold animate-pulse">MORTGAGED</div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Incoming Trades */}
        <div className="border-t-4 border-pink-600 pt-4">
          <button
            onClick={() => setShowTrades((v) => !v)}
            className="w-full text-xl font-bold text-pink-300 flex justify-between items-center"
          >
            <span>TRADES {incomingTrades.length > 0 && `(${incomingTrades.length} pending)`}</span>
            <motion.span animate={{ rotate: showTrades ? 180 : 0 }} className="text-3xl text-cyan-400">
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {showTrades && incomingTrades.length > 0 && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden mt-4 space-y-4"
              >
                {incomingTrades.map((trade: any) => {
                  const from = game.players.find((p: Player) => p.user_id === trade.player_id);
                  const offerProps = properties.filter((p: Property) => trade.offer_properties?.includes(p.id));
                  const requestProps = properties.filter((p: Property) => trade.requested_properties?.includes(p.id));

                  return (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-purple-900/60 to-cyan-900/40 border-2 border-cyan-500 rounded-xl p-5"
                    >
                      <div className="font-bold text-cyan-300 mb-3">
                        From {from?.username || "Player"}
                      </div>
                      <div className="text-sm space-y-2 mb-4">
                        <div className="text-green-400">
                          Gives: {offerProps.length ? offerProps.map((p) => p.name).join(", ") : "nothing"} + ${trade.offer_amount || 0}
                        </div>
                        <div className="text-red-400">
                          Wants: {requestProps.length ? requestProps.map((p) => p.name).join(", ") : "nothing"} + ${trade.requested_amount || 0}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleTradeAction(trade.id, "accepted")}
                          className="py-2 bg-green-600 rounded font-bold text-white hover:bg-green-500"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleTradeAction(trade.id, "declined")}
                          className="py-2 bg-red-600 rounded font-bold text-white hover:bg-red-500"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleTradeAction(trade.id, "counter")}
                          className="py-2 bg-yellow-600 rounded font-bold text-black hover:bg-yellow-500"
                        >
                          Counter
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
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
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedProperty(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-br from-purple-900 to-cyan-900 rounded-2xl border-4 border-cyan-400 shadow-2xl p-8 max-w-sm w-full"
            >
              <button
                onClick={() => setSelectedProperty(null)}
                className="absolute top-4 right-4 text-3xl text-red-400 hover:text-red-300 transition"
              >
                X
              </button>
              <h3 className="text-3xl font-bold text-cyan-300 text-center mb-6">{selectedProperty.name}</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { handleDevelopment(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-green-600 rounded-xl font-bold text-white shadow-lg">BUILD</button>
                <button onClick={() => { handleDowngrade(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-orange-600 rounded-xl font-bold text-white shadow-lg">SELL</button>
                <button onClick={() => { handleMortgage(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-blue-600 rounded-xl font-bold text-white shadow-lg">MORTGAGE</button>
                <button onClick={() => { handleUnmortgage(selectedProperty.id); setSelectedProperty(null); }} className="py-4 bg-purple-600 rounded-xl font-bold text-white shadow-lg">REDEEM</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Trade Modal */}
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

      {/* Counter Trade Modal - FULLY FIXED */}
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
    </aside>
  );
}

// ———— CLEAN & WORKING TRADE MODAL ————
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
  targetPlayerAddress,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: GameProperty[];
  offerProperties: number[];
  requestProperties: number[];
  setOfferProperties: React.Dispatch<React.SetStateAction<number[]>>;
  setRequestProperties: React.Dispatch<React.SetStateAction<number[]>>;
  offerCash: number;
  requestCash: number;
  setOfferCash: React.Dispatch<React.SetStateAction<number>>;
  setRequestCash: React.Dispatch<React.SetStateAction<number>>;
  toggleSelect: (id: number, arr: number[], setter: React.Dispatch<React.SetStateAction<number[]>>) => void;
  targetPlayerAddress?: string | null;
}) {
  if (!open) return null;

  const targetProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    return properties.filter((p) =>
      game_properties.some((gp) => gp.property_id === p.id && gp.address === targetPlayerAddress)
    );
  }, [properties, game_properties, targetPlayerAddress]);

  const PropertyCard = ({ prop, isSelected, onClick }: { prop: Property; isSelected: boolean; onClick: () => void }) => (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col gap-2 ${
        isSelected
          ? "border-cyan-400 bg-cyan-900/50 shadow-lg shadow-cyan-400/50"
          : "border-gray-700 hover:border-gray-500"
      }`}
    >
      {prop.color && (
        <div className="h-6 rounded-t-md -m-3 -mt-3 mb-2" style={{ backgroundColor: prop.color }} />
      )}
      <div className="text-xs font-bold text-cyan-200 text-center leading-tight">{prop.name}</div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-purple-900 to-black rounded-2xl border-4 border-cyan-500 shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-4 right-6 text-4xl text-red-400 hover:text-red-300 transition z-10">
          X
        </button>

        <h2 className="text-4xl font-bold text-cyan-300 text-center mb-8">{title}</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-bold text-green-400 mb-4 text-center">YOU GIVE</h3>
            <div className="grid grid-cols-3 gap-3">
              {my_properties.map((p) => (
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
              className="w-full mt-6 bg-black/60 border-2 border-green-500 rounded-lg px-4 py-4 text-green-400 font-bold text-2xl text-center placeholder-green-700"
            />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-red-400 mb-4 text-center">YOU GET</h3>
            <div className="grid grid-cols-3 gap-3">
              {targetProps.length > 0 ? (
                targetProps.map((p) => (
                  <PropertyCard
                    key={p.id}
                    prop={p}
                    isSelected={requestProperties.includes(p.id)}
                    onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                  />
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-500 py-8">
                  No properties available
                </div>
              )}
            </div>
            <input
              type="number"
              placeholder="+$ CASH"
              value={requestCash || ""}
              onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
              className="w-full mt-6 bg-black/60 border-2 border-red-500 rounded-lg px-4 py-4 text-red-400 font-bold text-2xl text-center placeholder-red-700"
            />
          </div>
        </div>

        <div className="flex justify-center gap-8 mt-12">
          <button onClick={onClose} className="px-12 py-5 bg-gray-800 rounded-xl font-bold text-2xl text-gray-300 hover:bg-gray-700 transition">
            CANCEL
          </button>
          <button
            onClick={onSubmit}
            className="px-16 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold text-2xl text-white shadow-lg hover:shadow-cyan-500/50 transition"
          >
            SEND DEAL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}