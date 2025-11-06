"use client";
import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";

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
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
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

  const startTrade = (targetPlayer: Player) => {
    if (!isNext) return;
    setTradeModal({ open: true, target: targetPlayer });
  };

  const handleCreateTrade = () => {
    if (!me || !tradeModal.target) return;
    const newTrade = {
      id: Date.now(),
      initiator: me,
      target: tradeModal.target,
      offer: { properties: offerProperties, cash: offerCash },
      request: { properties: requestProperties, cash: requestCash },
      status: "pending",
    };
    setOpenTrades((prev) => [...prev, newTrade]);
    setTradeModal({ open: false, target: null });
    resetTradeFields();
  };

  const handleTradeAction = (id: number, action: "accept" | "decline" | "counter") => {
    if (action === "counter") {
      const trade = tradeRequests.find((t) => t.id === id);
      if (trade) {
        setCounterModal({ open: true, trade });
      }
    } else {
      setTradeRequests((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: action } : t))
      );
    }
  };

  const resetTradeFields = () => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  };

  const toggleSelect = (id: number, arr: number[], setter: (val: number[]) => void) => {
    if (arr.includes(id)) setter(arr.filter((x) => x !== id));
    else setter([...arr, id]);
  };

  const submitCounterTrade = () => {
    if (!me || !counterModal.trade) return;
    const updatedTrade = {
      ...counterModal.trade,
      offer: { properties: offerProperties, cash: offerCash },
      request: { properties: requestProperties, cash: requestCash },
      status: "countered",
    };
    setTradeRequests((prev) =>
      prev.map((t) => (t.id === counterModal.trade.id ? updatedTrade : t))
    );
    setCounterModal({ open: false, trade: null });
    resetTradeFields();
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
              <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                <span>Pos: {player.position ?? "0"}</span>
                <span>Circle: {player.circle ?? "0"}</span>
                <span>Turn: {player.turn_order ?? "N/A"}</span>
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

      {/* My Empire */}
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

        <AnimatePresence>
          {showEmpire && (
            <motion.ul
              key="empire-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
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
                        {isMortgaged(prop.id) && (
                          <div className="text-red-500 font-medium">🔒 Mortgaged</div>
                        )}
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
          <span className="text-xs text-cyan-400">
            {showTrade ? "Hide ▲" : "Show ▼"}
          </span>
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
              {/* Active Trades */}
              {openTrades.length > 0 && (
                <div>
                  <h4 className="font-semibold text-cyan-400 mb-2">My Trades</h4>
                  {openTrades.map((trade) => (
                    <div
                      key={trade.id}
                      className="border border-cyan-800 rounded p-2 bg-gray-900"
                    >
                      <div className="flex justify-between text-xs">
                        <span>
                          With: <b>{trade.target.username}</b>
                        </span>
                        <span className="text-gray-400">{trade.status}</span>
                      </div>
                      <div className="text-xs mt-1 text-gray-400 italic">
                        Offer: {trade.offer.properties.length} props / {trade.offer.cash} 💰 | Request:{" "}
                        {trade.request.properties.length} props / {trade.request.cash} 💰
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Incoming Trade Requests */}
              {tradeRequests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-cyan-400 mb-2">Trade Requests</h4>
                  {tradeRequests.map((trade) => (
                    <div
                      key={trade.id}
                      className="border border-gray-700 rounded p-2 bg-gray-900"
                    >
                      <div className="text-xs mb-1">
                        From: <b>{trade.initiator.username}</b>
                      </div>
                      <div className="flex justify-between text-xs">
                        <button
                          onClick={() => handleTradeAction(trade.id, "accept")}
                          className="text-green-400 hover:text-green-300"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleTradeAction(trade.id, "decline")}
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
                  ))}
                </div>
              )}

              {openTrades.length === 0 && tradeRequests.length === 0 && (
                <p className="text-gray-500 text-center text-xs">No trades yet..</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Create Trade Modal */}
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
      />

      {/* Counter Trade Modal */}
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
      />
    </aside>
  );
}

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
}: any) {
  if (!open) return null;

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
          className="bg-gray-900 border border-cyan-900 rounded-xl w-[90%] max-w-lg p-5 text-sm text-gray-200 shadow-xl max-h-[85vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-cyan-400 text-lg">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              ✖
            </button>
          </div>

          <div className="space-y-6">
            {/* --- Offer Section --- */}
            <div>
              <h4 className="font-medium text-cyan-300 mb-2">Your Offer</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {my_properties.length > 0 ? (
                  my_properties.map((prop: Property) => {
                    const selected = offerProperties.includes(prop.id);
                    return (
                      <div
                        key={prop.id}
                        onClick={() =>
                          toggleSelect(prop.id, offerProperties, setOfferProperties)
                        }
                        className={`relative border rounded-lg cursor-pointer p-2 text-center transition-all ${selected
                            ? "border-cyan-500 bg-cyan-900/30"
                            : "border-gray-700 hover:bg-gray-800/40"
                          }`}
                      >
                        {/* Group color bar */}
                        {prop.color && (
                          <div
                            className="absolute top-0 left-0 w-full h-2 rounded-t-md"
                            style={{ backgroundColor: prop.color }}
                          />
                        )}
                        <div className="pt-3">
                          <p className="font-semibold text-gray-100 truncate">
                            {prop.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">💵 {prop.price}</p>
                        </div>
                        {selected && (
                          <div className="absolute top-1 right-1 text-cyan-400 text-xs">
                            ✔
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="col-span-full text-center text-gray-500 text-xs">
                    You own no properties
                  </p>
                )}
              </div>

              <input
                type="number"
                className="w-full bg-gray-800 rounded p-2 mt-3 border border-gray-700"
                placeholder="💰 Offer Cash"
                value={offerCash || ""}
                onChange={(e) => setOfferCash(Number(e.target.value))}
              />
            </div>

            {/* --- Request Section --- */}
            <div>
              <h4 className="font-medium text-cyan-300 mb-2">Request Properties</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {properties.length > 0 ? (
                  properties.map((prop: Property) => {
                    const selected = requestProperties.includes(prop.id);
                    return (
                      <div
                        key={prop.id}
                        onClick={() =>
                          toggleSelect(prop.id, requestProperties, setRequestProperties)
                        }
                        className={`relative border rounded-lg cursor-pointer p-2 text-center transition-all ${selected
                            ? "border-cyan-500 bg-cyan-900/30"
                            : "border-gray-700 hover:bg-gray-800/40"
                          }`}
                      >
                        {prop.color && (
                          <div
                            className="absolute top-0 left-0 w-full h-2 rounded-t-md"
                            style={{ backgroundColor: prop.color }}
                          />
                        )}
                        <div className="pt-3">
                          <p className="font-semibold text-gray-100 truncate">
                            {prop.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">💵 {prop.price}</p>
                        </div>
                        {selected && (
                          <div className="absolute top-1 right-1 text-cyan-400 text-xs">
                            ✔
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="col-span-full text-center text-gray-500 text-xs">
                    No properties available
                  </p>
                )}
              </div>

              <input
                type="number"
                className="w-full bg-gray-800 rounded p-2 mt-3 border border-gray-700"
                placeholder="💰 Request Cash"
                value={requestCash || ""}
                onChange={(e) => setRequestCash(Number(e.target.value))}
              />
            </div>

            {/* --- Action Buttons --- */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="px-4 py-2 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white font-semibold transition"
              >
                Submit
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
