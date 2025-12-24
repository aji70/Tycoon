"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@/types/game";

interface GameOverOverlayProps {
  winner: Player | null;
  me: Player | null;
  onExitAttempt: (shouldFinalize: boolean) => void;
}

export default function GameOverOverlay({ winner, me, onExitAttempt }: GameOverOverlayProps) {
  if (!winner) return null;

  const isUserWinner = winner.user_id === me?.user_id;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[999] p-8"
      >
        <motion.div
          initial={{ scale: 0.7, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0.7, rotate: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`
            p-12 lg:p-20 rounded-3xl shadow-2xl text-center max-w-2xl w-full mx-4 border-8
            ${isUserWinner 
              ? "bg-gradient-to-br from-yellow-500 via-orange-500 to-yellow-600 border-yellow-400 shadow-yellow-500/50" 
              : "bg-gradient-to-br from-gray-800 via-gray-900 to-black border-gray-600 shadow-gray-900/50"
            }
          `}
        >
          {isUserWinner ? (
            <>
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl lg:text-8xl font-black mb-8 drop-shadow-2xl"
              >
                🏆 YOU WIN! 🏆
              </motion.div>
              <h1 className="text-5xl lg:text-6xl font-black mb-8 bg-gradient-to-r from-white to-yellow-200 bg-clip-text text-transparent drop-shadow-2xl">
                Monopoly Master!
              </h1>
              <p className="text-2xl lg:text-3xl text-yellow-100 mb-12 font-semibold leading-relaxed">
                You're the ultimate Tycoon of this board! 💰
              </p>
            </>
          ) : (
            <>
              <h1 className="text-6xl lg:text-7xl font-black mb-8 text-gray-300 drop-shadow-2xl">
                Game Over
              </h1>
              <h2 className="text-4xl lg:text-5xl font-black mb-8 text-white drop-shadow-2xl">
                {winner.username} Wins! 👑
              </h2>
              <p className="text-xl lg:text-2xl text-gray-300 mb-12 font-medium leading-relaxed">
                Great game! Better luck next time — you'll get them next round! 🎲
              </p>
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onExitAttempt(true)}
            className={`
              px-16 py-8 text-2xl lg:text-3xl font-black rounded-3xl shadow-2xl
              transition-all duration-300 border-4
              ${isUserWinner 
                ? "bg-gradient-to-r from-emerald-500 to-cyan-600 border-emerald-400 hover:from-emerald-600 hover:to-cyan-700 shadow-emerald-500/50"
                : "bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 hover:from-cyan-700 hover:to-blue-700 shadow-cyan-500/50"
              }
              text-white uppercase tracking-wider
            `}
          >
            {isUserWinner ? "Claim Rewards 🎉" : "Finish & Play Again"}
          </motion.button>

          <p className="text-lg mt-12 opacity-80 font-medium">
            Thanks for playing Tycoon! Made with ❤️
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}