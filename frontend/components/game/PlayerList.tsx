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
    </>
  );
};