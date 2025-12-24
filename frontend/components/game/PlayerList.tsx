import React from "react";
import { motion } from "framer-motion";
import { Game, Player } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { useAccount } from "wagmi";

interface PlayerListProps {
  game: Game;
  sortedPlayers: Player[];
  startTrade: (player: Player) => void;
  isNext: boolean;
}

// Simple helper to determine balance "health" color
const getBalanceColor = (balance: number): string => {
  if (balance >= 1300) return "text-cyan-300";     // plenty - bright cyan/blue
  if (balance >= 1000)  return "text-emerald-400";  // good - green
  if (balance >= 750)   return "text-yellow-400";   // drying up - yellow
  if (balance >= 150)   return "text-orange-400";   // danger - orange
  return "text-red-500 animate-pulse";                // almost broke - red + subtle blink
};

export const PlayerList: React.FC<PlayerListProps> = ({
  game,
  sortedPlayers,
  startTrade,
  isNext,
}) => {
  const { address } = useAccount();

  return (
    <>
      {sortedPlayers.map((player) => {
        const isNextTurn = player.user_id === game.next_player_id;
        const isMe = player.address?.toLowerCase() === address?.toLowerCase();
        const canTrade = isNext && !player.in_jail && !isMe;

        const balanceColor = getBalanceColor(player.balance);

        return (
          <motion.div
            key={player.user_id}
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            className={`
              p-4 rounded-xl border-2 transition-all duration-300
              ${isNextTurn
                ? "border-cyan-400 bg-cyan-950/50 shadow-lg shadow-cyan-500/40"
                : "border-purple-800/70 bg-purple-950/30"
              }
              ${player.in_jail ? "opacity-60 bg-gray-900/40" : ""}
            `}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl drop-shadow-md">
                  {getPlayerSymbol(player.symbol)}
                </span>
                <div className="font-bold text-lg sm:text-xl text-cyan-100">
                  {player.username || player.address?.slice(0, 6) + "..."}
                  {isMe && <span className="text-cyan-300 ml-1.5">(YOU)</span>}
                  {player.in_jail && (
                    <span className="text-red-400 ml-2 text-sm font-medium">
                      [JAIL]
                    </span>
                  )}
                </div>
              </div>
                  <br/>
              <div className={`text-xl sm:text-2xl font-black ${balanceColor}`}>
                ${ player.balance.toLocaleString()}
              </div>
            </div>

            {canTrade && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => startTrade(player)}
                className="
                  mt-4 w-full py-2.5 md:py-3
                  bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600
                  hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500
                  text-white font-bold rounded-lg
                  shadow-md shadow-purple-900/40
                  transition-all duration-300
                  text-sm sm:text-base
                "
              >
                TRADE WITH {player.username?.split(" ")[0] || "PLAYER"}
              </motion.button>
            )}
          </motion.div>
        );
      })}
    </>
  );
};