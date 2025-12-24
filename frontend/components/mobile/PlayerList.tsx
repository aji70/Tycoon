import React from "react";
import { motion } from "framer-motion";
import { Game, Player } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";

interface PlayerListProps {
  game: Game;
  me: Player | null;
  address: string | undefined;
  isNext: boolean;
  startTrade: (player: Player) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  game,
  me,
  address,
  isNext,
  startTrade,
}) => {
  const sorted = [...(game?.players ?? [])].sort((a, b) => (a.turn_order ?? 99) - (b.turn_order ?? 99));

  return (
    <>
      <motion.h2
        animate={{ textShadow: ["0 0 10px #0ff", "0 0 20px #0ff", "0 0 10px #0ff"] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-xl font-bold text-cyan-300 text-center tracking-widest"
      >
        PLAYERS
      </motion.h2>

      {sorted.map((p) => {
        const isMe = p.address?.toLowerCase() === address?.toLowerCase();
        const isTurn = p.user_id === game.next_player_id;
        const canTrade = isNext && !p.in_jail && !isMe;
        const name = p.username || p.address?.slice(0, 6) || "Player";
        const isAI = name.toLowerCase().includes("ai") || name.toLowerCase().includes("bot");

        return (
          <motion.div
            key={p.user_id}
            whileHover={{ scale: 1.02 }}
            className={`p-3 rounded-xl border-2 transition-all ${
              isTurn ? "border-cyan-400 bg-cyan-900/40 shadow-lg shadow-cyan-400/60"
                     : "border-purple-800 bg-purple-900/20"
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getPlayerSymbol(p.symbol)}</span>
                <div className="font-bold text-cyan-200 text-sm">
                  {name}{isMe && " (YOU)"}{isAI && " (AI)"}
                </div>
              </div>
              <div className="text-base font-bold text-yellow-400">
                ${p.balance.toLocaleString()}
              </div>
            </div>
            {canTrade && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => startTrade(p)}
                className="mt-2 w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-bold text-white shadow-lg text-sm"
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