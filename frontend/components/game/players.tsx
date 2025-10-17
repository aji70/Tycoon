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
  const [showEmpire, setShowEmpire] = useState<boolean>(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const toggleEmpire = useCallback(() => setShowEmpire((prev) => !prev), []);

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
        (a, b) =>
          (a.turn_order ?? Number.POSITIVE_INFINITY) -
          (b.turn_order ?? Number.POSITIVE_INFINITY)
      ),
    [game?.players]
  );

  return (
    <aside className="w-72 h-full border-r border-white/10 bg-[#010F10] overflow-y-auto">
      {/* Players List */}
      <header className="p-4 border-b border-cyan-800">
        <h2 className="text-lg font-semibold text-gray-300">Players</h2>
      </header>

      <ul className="divide-y divide-cyan-800">
        {sortedPlayers.map((player) => {
          const isWinner = player.user_id === game.winner_id;
          const isNext = player.user_id === game.next_player_id;
          const isMe = player.address?.toLowerCase() === address?.toLowerCase();

          return (
            <li
              key={player.user_id}
              className={`p-3 flex flex-col border-l-4 transition-colors ${isNext
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
              <div className="flex items-center justify-end space-x-2 text-xs text-gray-400">
                <span>Pos: {player.position ?? "0"}</span>
                <span>Circle: {player.circle ?? "0"}</span>
                <span>Turn: {player.turn_order ?? "N/A"}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* My Properties Section */}
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

      {/* Property Modal */}
      <AnimatePresence>
        {selectedProperty && (
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
                <button className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  🏠 Buy House
                </button>
                <button className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  🏚️ Sell House
                </button>
                <button className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  🏨 Buy Hotel
                </button>
                <button className="w-full py-2 bg-cyan-800/30 hover:bg-cyan-700/50 rounded-md">
                  🏩 Sell Hotel
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
    </aside>
  );
}
