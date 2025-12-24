import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@/types/game";
import { Trophy, Sparkles, Crown, RotateCcw } from "lucide-react";

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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-hidden"
      >
        {/* Background subtle animated gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 opacity-40"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.45, 0.3],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ y: 80, scale: 0.85, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 40, scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 18 }}
          className={`
            relative p-10 md:p-14 lg:p-16 
            rounded-3xl md:rounded-4xl
            shadow-[0_0_60px_-5px] 
            overflow-hidden
            border-[3px] border-opacity-40
            backdrop-blur-md
            max-w-md sm:max-w-lg md:max-w-xl w-full
            text-center
            ${isWinner 
              ? "bg-gradient-to-b from-amber-900/90 to-amber-950/90 border-amber-400/60 shadow-amber-500/40" 
              : "bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-slate-500/40 shadow-slate-700/30"
            }
          `}
        >
          {/* Decorative glow effect */}
          {isWinner && (
            <motion.div
              className="absolute -inset-20 bg-gradient-radial from-amber-400/20 via-transparent to-transparent pointer-events-none"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            />
          )}

          <div className="relative z-10">
            {isWinner ? (
              <>
                <motion.div
                  initial={{ scale: 0.6, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 180, delay: 0.2 }}
                  className="mb-8"
                >
                  <Crown className="w-24 h-24 md:w-28 md:h-28 mx-auto text-amber-300 drop-shadow-[0_0_20px_rgba(245,158,11,0.7)]" />
                </motion.div>

                <motion.h1
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-5xl sm:text-6xl md:text-7xl font-black mb-4 tracking-tight"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400">
                    YOU WIN!
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-2xl md:text-3xl font-bold text-amber-100/90 mb-8"
                >
                  Congratulations, Tycoon Legend! 👑
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="mb-10"
                >
                  <p className="text-lg md:text-xl text-amber-200/80 mb-2">
                    You outsmarted the AI and built the ultimate empire
                  </p>
                  <div className="flex items-center justify-center gap-3 text-amber-300/90 mt-3">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-semibold">Legendary Victory</span>
                    <Sparkles className="w-5 h-5" />
                  </div>
                </motion.div>

                <motion.button
                  whileHover={{ scale: 1.06, y: -4 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={claiming}
                  onClick={onClaim}
                  className={`
                    relative px-10 py-5 md:px-14 md:py-7
                    text-xl md:text-2xl font-bold
                    rounded-2xl md:rounded-3xl
                    overflow-hidden group
                    shadow-2xl shadow-purple-900/40
                    border-2 border-white/30
                    transition-all duration-300
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${claiming 
                      ? "bg-gray-700 cursor-wait" 
                      : "bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 hover:from-cyan-400 hover:via-purple-500 hover:to-pink-500"
                    }
                  `}
                >
                  <span className="relative z-10">
                    {claiming ? "Claiming your empire..." : "Claim Your Rewards 🎁"}
                  </span>
                  
                  <motion.div
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  />
                </motion.button>
              </>
            ) : (
              // ────────────── LOSER / OTHER PLAYER WON ──────────────
              <>
                <motion.div
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="mb-10"
                >
                  <Trophy className="w-20 h-20 md:w-24 md:h-24 mx-auto text-slate-300/80" />
                </motion.div>

                <h1 className="text-5xl md:text-6xl font-black text-slate-200 mb-6 tracking-tight">
                  GAME OVER
                </h1>

                <p className="text-3xl md:text-4xl font-bold text-white mb-4">
                  {winner.username} wins!
                </p>

                <p className="text-xl text-slate-300 mb-12">
                  The throne belongs to {winner.username} this time...
                </p>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => window.location.href = "/"}
                  className="
                    px-10 py-5 md:px-12 md:py-6
                    bg-gradient-to-r from-slate-700 to-slate-800
                    hover:from-slate-600 hover:to-slate-700
                    text-white text-xl md:text-2xl font-bold
                    rounded-2xl md:rounded-3xl
                    border border-slate-500/50
                    shadow-lg shadow-black/40
                    transition-all duration-300
                  "
                >
                  <div className="flex items-center justify-center gap-3">
                    <RotateCcw size={22} />
                    <span>Return Home</span>
                  </div>
                </motion.button>
              </>
            )}

            <p className="mt-12 text-base md:text-lg text-white/50 font-light">
              Thanks for playing <span className="text-amber-300/70 font-medium">Tycoon</span> ✨
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};