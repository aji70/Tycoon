import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { useAccount } from "wagmi";

interface PlayerListProps {
  game: Game;
  sortedPlayers: Player[];
  isNext: boolean;
  startTrade: (player: Player) => void;
}

const getBalanceColor = (balance: number): string => {
  if (balance >= 1300) return "text-cyan-300";
  if (balance >= 1000) return "text-emerald-400";
  if (balance >= 750) return "text-yellow-400";
  if (balance >= 150) return "text-orange-400";
  return "text-red-500 animate-pulse";
};

export const PlayerList: React.FC<PlayerListProps> = ({
  game,
  sortedPlayers,
  isNext,
  startTrade,
}) => {
  const { address: connectedAddress } = useAccount();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Find indices of important players
  const me = sortedPlayers.find(
    (p) => p.address?.toLowerCase() === connectedAddress?.toLowerCase()
  );
  const current = sortedPlayers.find((p) => p.user_id === game.next_player_id);

  // Default visible players: try to show me + current + 1 more
  const defaultVisible = React.useMemo(() => {
    const visible: Player[] = [];

    if (me) visible.push(me);
    if (current && current.user_id !== me?.user_id) visible.push(current);

    // Add 1-2 more players to reach ~3
    const remaining = sortedPlayers.filter(
      (p) => p.user_id !== me?.user_id && p.user_id !== current?.user_id
    );

    visible.push(...remaining.slice(0, 3 - visible.length));

    return visible;
  }, [sortedPlayers, me, current]);

  const [visiblePlayers, setVisiblePlayers] = React.useState<Player[]>(defaultVisible);

  const handlePlayerClick = (player: Player) => {
    // Toggle selection
    setSelectedPlayerId((prev) =>
      prev === player.user_id ? null : player.user_id
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Top glowing bar */}
      <div className="h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 rounded-full shadow-lg shadow-cyan-400/60" />

      <div className="flex-1 overflow-y-auto px-1 pb-4 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-purple-950/40">
        <div className="space-y-3">
          {visiblePlayers.map((p) => {
            const isMe = p.address?.toLowerCase() === connectedAddress?.toLowerCase();
            const isTurn = p.user_id === game.next_player_id;
            const isSelected = selectedPlayerId === p.user_id;
            const canTrade = isNext && !p.in_jail && !isMe;

            const displayName = p.username || p.address?.slice(0, 6) + "..." || "Player";
            const isAI = displayName.toLowerCase().includes("ai_") || displayName.toLowerCase().includes("bot");

            const balanceColor = getBalanceColor(p.balance);

            return (
              <motion.div
                key={p.user_id}
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handlePlayerClick(p)}
                className={`
                  relative p-4 rounded-2xl border-2 transition-all duration-300 overflow-hidden cursor-pointer
                  ${isTurn
                    ? "border-cyan-400 bg-cyan-900/70 shadow-2xl shadow-cyan-500/70"
                    : isSelected
                    ? "border-purple-400 bg-purple-900/60 shadow-xl shadow-purple-500/50"
                    : "border-purple-700/60 bg-purple-900/30 shadow-lg"
                  }
                  ${p.in_jail ? "opacity-65" : ""}
                `}
              >
                {isTurn && (
                  <div className="absolute inset-0 bg-cyan-400/10 animate-pulse pointer-events-none rounded-2xl" />
                )}

                <div className="relative z-10 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-3xl drop-shadow-md flex-shrink-0">
                      {getPlayerSymbol(p.symbol)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-cyan-100 text-base flex items-center gap-2 flex-wrap">
                        <span className="truncate">{displayName}</span>
                        {isMe && (
                          <span className="px-2 py-0.5 bg-yellow-500/90 text-black text-xs font-black rounded-full flex-shrink-0">
                            YOU
                          </span>
                        )}
                        {isAI && <span className="text-lg">🤖</span>}
                        {p.in_jail && (
                          <span className="text-red-400 text-xs font-bold flex-shrink-0">
                            [JAIL]
                          </span>
                        )}
                      </div>
                      {isTurn && (
                        <div className="text-xs text-cyan-300 font-medium mt-1 flex items-center gap-1">
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-2 h-2 bg-cyan-300 rounded-full"
                          />
                          Current Turn
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`text-xl font-black ${balanceColor} drop-shadow-md`}>
                    ${p.balance.toLocaleString()}
                  </div>
                </div>

                {/* Trade button appears only when card is selected */}
                <AnimatePresence>
                  {isSelected && canTrade && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      onClick={(e) => {
                        e.stopPropagation(); // prevent closing the selection
                        startTrade(p);
                        setSelectedPlayerId(null); // optional: close after trade starts
                      }}
                      className="
                        mt-4 w-full py-3 
                        bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600
                        hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500
                        text-white font-bold rounded-xl text-base
                        shadow-xl shadow-purple-900/60
                        transition-all duration-300
                      "
                    >
                      Trade
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Optional hint */}
      {sortedPlayers.length > visiblePlayers.length && (
        <div className="text-center text-xs text-purple-300/70 mt-2">
          Scroll to see all {sortedPlayers.length} players
        </div>
      )}
    </div>
  );
};