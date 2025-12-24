"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@/types/game";

interface ExitConfirmationProps {
  show: boolean;
  winner: Player | null;
  isPending: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  me: Player | null;
}

export default function ExitConfirmation({ 
  show, 
  winner, 
  isPending, 
  onConfirm, 
  onSkip,
  me
}: ExitConfirmationProps) {
 const isUserWinner = winner?.user_id === me?.user_id;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[1000] p-8"
        >
          <motion.div
            initial={{ scale: 0.85, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 50 }}
            className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl p-10 lg:p-12 rounded-3xl max-w-md w-full text-center border-2 border-cyan-500/40 shadow-2xl"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl mb-6"
            >
              ⚡
            </motion.div>

            <h2 className="text-3xl lg:text-4xl font-black text-white mb-6 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
              Final Step!
            </h2>

            {isUserWinner ? (
              <p className="text-xl text-cyan-200 mb-10 font-semibold leading-relaxed">
                Finalize to claim your rewards from the blockchain! 🏆
              </p>
            ) : (
              <p className="text-xl text-gray-300 mb-10 font-semibold leading-relaxed">
                Wrap up the game results on-chain before leaving.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-black rounded-2xl transition-all border-2 border-cyan-400 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Yes, Finish Game"
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSkip}
                className="flex-1 px-8 py-4 bg-gray-700/80 hover:bg-gray-600 text-white font-semibold rounded-2xl transition-all border-2 border-gray-600 shadow-lg"
              >
                Skip & Leave
              </motion.button>
            </div>

            <p className="text-sm text-gray-400 mt-6">
              Don't worry, you can always come back later
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}