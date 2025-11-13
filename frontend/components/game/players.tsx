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
      toast.success("Trade created successfully");
      setOpenTrades((prev) => [...prev, res.data]);
      setTradeModal({ open: false, target: null });
      resetTradeFields();
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
      await apiClient.post(`/game-trade-requests/${action == 'accepted' ? 'accept' : 'decline'}`, { id });
      toast.success(`Trade ${action}ed`);
      fetchTrades();
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
      await apiClient.put(`/game-trade-requests/${counterModal.trade.id}`, payload);
      toast.success("Counter offer sent");
      setCounterModal({ open: false, trade: null });
      resetTradeFields();
      fetchTrades();
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

      {/* My Empire Section */}  <section className="border-t border-gray-800 mt-2">
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
            <motion.ul
              key="empire-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="divide-y divide-gray-800 overflow-hidden"
            >
              {my_properties.length > 0 ? (
                my_properties.map((prop) => (
                  <motion.li
                    key={prop.id}
                    onClick={() => setSelectedProperty(prop)}
                    whileHover={{ scale: 1.02 }}
                    className="p-3 text-sm text-gray-200 cursor-pointer hover:bg-gray-800/50 transition"
                  >
                    <div className="rounded-lg border border-gray-700 shadow-sm p-2 bg-gray-900">
                      {prop.color && (
                        <div
                          className="w-full h-2 rounded-t-md mb-2"
                          style={{ backgroundColor: prop.color }}
                        />
                      )}

                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{prop.name}</span>
                        <span className="text-xs text-gray-500">#{prop.id}</span>
                      </div>

                      <div className="mt-1 text-xs text-gray-400">
                        <div>Price: 💵 {prop.price}</div>
                        <div>Rent: 🏠 {rentPrice(prop.id)}</div>
                        {isMortgaged(prop.id) ? (
                          <div className="text-red-500 font-medium">🔒 Mortgaged</div>
                        ) : <></>}
                      </div>
                    </div>
                  </motion.li>
                ))
              ) : (
                <div className="text-center text-sm font-medium text-gray-500 py-3">
                  No properties yet..
                </div>
              )}
            </motion.ul>
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
                  <h4 className="font-semibold text-cyan-400 mb-2">My Trades</h4>
                  {openTrades.map((trade) => {
                    const offeredProps = properties.filter((p) =>
                      trade.offer_properties?.includes(p.id)
                    );
                    const requestedProps = properties.filter((p) =>
                      trade.requested_properties?.includes(p.id)
                    );

                    return (
                      <div
                        key={trade.id}
                        className="border border-cyan-800 rounded p-2 bg-gray-900 mb-2"
                      >
                        <div className="flex justify-between text-xs">
                          <span>
                            With:{" "}
                            <b>
                              {
                                game.players.find(
                                  (pl) => pl.user_id === trade.target_player_id
                                )?.username
                              }
                            </b>
                          </span>
                          <span className="text-gray-400 capitalize">{trade.status}</span>
                        </div>

                        {/* Offer */}
                        <div className="mt-1 text-xs text-gray-300">
                          <span className="font-semibold text-cyan-400">Your Offer:</span>
                          {offeredProps.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-400">
                              {offeredProps.map((prop) => (
                                <li key={prop.id}>
                                  {prop.name} — 💵 {prop.price}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">No properties</span>
                          )}
                          {trade.offer_amount > 0 && (
                            <div className="text-gray-400 mt-1">
                              + 💰 {trade.offer_amount} cash
                            </div>
                          )}
                        </div>

                        {/* Request */}
                        <div className="mt-2 text-xs text-gray-300">
                          <span className="font-semibold text-cyan-400">Their Offer:</span>
                          {requestedProps.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-400">
                              {requestedProps.map((prop) => (
                                <li key={prop.id}>
                                  {prop.name} — 💵 {prop.price}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">No properties</span>
                          )}
                          {trade.requested_amount > 0 && (
                            <div className="text-gray-400 mt-1">
                              + 💰 {trade.requested_amount} cash
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Trade Requests */}
              {tradeRequests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-cyan-400 mb-2">Trade Requests</h4>
                  {tradeRequests.map((trade) => {
                    const offeredProps = properties.filter((p) =>
                      trade.offer_properties?.includes(p.id)
                    );
                    const requestedProps = properties.filter((p) =>
                      trade.requested_properties?.includes(p.id)
                    );

                    return (
                      <div
                        key={trade.id}
                        className="border border-gray-700 rounded p-2 bg-gray-900 mb-2"
                      >
                        <div className="text-xs mb-1">
                          From:{" "}
                          <b>
                            {
                              game.players.find(
                                (pl) => pl.user_id === trade.player_id
                              )?.username
                            }
                          </b>
                        </div>

                        {/* Offer */}
                        <div className="text-xs text-gray-300">
                          <span className="font-semibold text-cyan-400">Their Offer:</span>
                          {offeredProps.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-400">
                              {offeredProps.map((prop) => (
                                <li key={prop.id}>
                                  {prop.name} — 💵 {prop.price}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">No properties</span>
                          )}
                          {trade.offer_amount > 0 && (
                            <div className="text-gray-400 mt-1">
                              + 💰 {trade.offer_amount} cash
                            </div>
                          )}
                        </div>

                        {/* Requested */}
                        <div className="mt-2 text-xs text-gray-300">
                          <span className="font-semibold text-cyan-400">Your Request:</span>
                          {requestedProps.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-400">
                              {requestedProps.map((prop) => (
                                <li key={prop.id}>
                                  {prop.name} — 💵 {prop.price}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">No properties</span>
                          )}
                          {trade.requested_amount > 0 && (
                            <div className="text-gray-400 mt-1">
                              + 💰 {trade.requested_amount} cash
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-between text-xs mt-3">
                          <button
                            onClick={() => handleTradeAction(trade.id, "accepted")}
                            className="text-green-400 hover:text-green-300"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleTradeAction(trade.id, "declined")}
                            className="text-red-400 hover:text-red-300"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleTradeAction(trade.id, "counter")}
                            className="text-cyan-400 hover:text-cyan-300"
                          >
                            Counter
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}


              {openTrades.length === 0 && tradeRequests.length === 0 && (
                <p className="text-gray-500 text-center text-xs">No trades yet..</p>
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
              className="bg-gray-900 rounded-xl shadow-lg w-80 border border-cyan-900"
            >
              <div className="p-4 border-b border-cyan-800 flex justify-between items-center">
                <h4 className="text-gray-200 font-semibold">
                  {selectedProperty.name}
                </h4>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✖
                </button>
              </div>

              <div className="p-4 space-y-2 text-sm text-gray-300">
                <button onClick={() => handleDevelopment(selectedProperty.id)} className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  🏠 Development
                </button>
                <button className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  🏚️ Downgrade
                </button>
                <button className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  💰 Mortgage
                </button>
                <button className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  💸 Unmortgage
                </button>
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
        targetPlayerAddres={tradeModal.target?.address}
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
        targetPlayerAddres={counterModal.trade?.target_player_id}
      />
    </aside>
  );
}

/* --- Shared TradeModal (unchanged from your version) --- */


/* --- Shared Modal Component for Create/Counter --- */


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
  targetPlayerAddres
}: any) {
  if (!open) return null;

  const targetOwnedProps = useMemo(() => {
    const validTypes = ["land", "railway", "utility"];
    // Filter game_properties by player ownership and valid type
    const ownedGameProps = game_properties.filter(
      (gp: any) =>
        gp.address == targetPlayerAddres
    );

    // Map to property details
    return properties.filter((p: any) =>
      ownedGameProps.some((gp: any) => gp.property_id === p.id)
    );
  }, [game_properties, properties, targetPlayerAddres]);

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
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          className="bg-gray-900 border border-cyan-900 rounded-xl w-[90%] max-w-2xl p-5 text-sm text-gray-200 shadow-xl max-h-[85vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-cyan-400">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              ✖
            </button>
          </div>

          {/* Your Offer */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-cyan-300 mb-2">Your Offer</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {my_properties.map((prop: Property) => (
                  <div
                    key={prop.id}
                    onClick={() =>
                      toggleSelect(prop.id, offerProperties, setOfferProperties)
                    }
                    className={`border rounded-lg p-2 cursor-pointer transition ${offerProperties.includes(prop.id)
                      ? "border-cyan-500 bg-cyan-900/40"
                      : "border-gray-700 hover:bg-gray-800/40"
                      }`}
                  >
                    {prop.color && (
                      <div
                        className="w-full h-2 rounded-md mb-1"
                        style={{ backgroundColor: prop.color }}
                      />
                    )}
                    <div className="text-xs font-semibold text-gray-100 truncate">
                      {prop.name}
                    </div>
                    <div className="text-[11px] text-gray-400">💵 {prop.price}</div>
                  </div>
                ))}
              </div>
              <input
                type="number"
                className="w-full bg-gray-800 rounded p-2 mt-3 border border-gray-700 text-gray-100"
                placeholder="💰 Offer Cash"
                value={offerCash || ""}
                onChange={(e) => setOfferCash(Number(e.target.value))}
              />
            </div>

            {/* Request Properties */}
            <div>
              <h4 className="font-medium text-cyan-300 mb-2">Request Properties</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {targetOwnedProps.length > 0 ? (
                  targetOwnedProps.map((prop: Property) => (
                    <div
                      key={prop.id}
                      onClick={() =>
                        toggleSelect(prop.id, requestProperties, setRequestProperties)
                      }
                      className={`border rounded-lg p-2 cursor-pointer transition ${requestProperties.includes(prop.id)
                        ? "border-cyan-500 bg-cyan-900/40"
                        : "border-gray-700 hover:bg-gray-800/40"
                        }`}
                    >
                      {prop.color && (
                        <div
                          className="w-full h-2 rounded-md mb-1"
                          style={{ backgroundColor: prop.color }}
                        />
                      )}
                      <div className="text-xs font-semibold text-gray-100 truncate">
                        {prop.name}
                      </div>
                      <div className="text-[11px] text-gray-400">💵 {prop.price}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-xs">No tradable properties available.</p>
                )}
              </div>
              <input
                type="number"
                className="w-full bg-gray-800 rounded p-2 mt-3 border border-gray-700 text-gray-100"
                placeholder="💰 Request Cash"
                value={requestCash || ""}
                onChange={(e) => setRequestCash(Number(e.target.value))}
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="px-4 py-2 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white font-semibold"
              >
                Submit Trade
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
