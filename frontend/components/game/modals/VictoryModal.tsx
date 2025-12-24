import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@/types/game";

interface VictoryModalProps {
  winner: Player | null;
  me: Player | null;
  onClaim: () => void;
  claiming: boolean;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winner,
  me,
  onClaim,
  claiming,
}) => {
  if (!winner) return null;

  const isWinner = winner.user_id === me?.user_id;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4"
    >
      <motion.div
        initial={{ scale: 0.8, rotate: -5 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`p-12 md:p-16 rounded-3xl shadow-2xl text-center max-w-lg w-full border-8 ${
          isWinner
            ? "bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400"
            : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600"
        }`}
      >
        {isWinner ? (
          <>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 drop-shadow-2xl">🏆 YOU WIN! 🏆</h1>
            <p className="text-4xl md:text-5xl font-bold text-white mb-8">
              Congratulations, Champion!
            </p>
            <p className="text-2xl md:text-3xl text-yellow-200 mb-12">
              You bankrupted the AI and became the ultimate Tycoon!
            </p>
            <button
              onClick={onClaim}
              disabled={claiming}
              className="px-12 py-6 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-2xl md:text-3xl font-bold rounded-2xl shadow-2xl hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-300 border-4 border-white/40 disabled:opacity-70"
            >
              {claiming ? "Claiming..." : "Claim Your Rewards 🎉"}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-gray-300">Game Over</h1>
            <p className="text-3xl md:text-4xl font-bold text-white mb-6">
              {winner.username} wins!
            </p>
            <p className="text-xl md:text-2xl text-gray-300 mb-10">
              Better luck next time!
            </p>
            <button
              onClick={() => window.location.href = "/"}
              className="px-12 py-6 bg-gradient-to-r from-gray-600 to-gray-700 text-white text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-gray-500/50 hover:scale-105 transition-all duration-300 border-4 border-gray-500"
            >
              Return Home
            </button>
          </>
        )}
        <p className="text-lg text-yellow-200/80 mt-10 opacity-90">
          Thanks for playing Tycoon!
        </p>
      </motion.div>
    </motion.div>
  );
};