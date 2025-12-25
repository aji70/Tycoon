import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertTriangle } from "lucide-react";

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: {
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null;
  playerName: string;
}

export const CardModal: React.FC<CardModalProps> = ({ isOpen, onClose, card, playerName }) => {
  if (!isOpen || !card) return null;

  const isGood = card.isGood;
  const typeTitle = card.type === "chance" ? "Chance" : "Community Chest";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, rotateY: 180 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className={`
            relative max-w-md w-full p-8 rounded-3xl text-center overflow-hidden
            border-4 shadow-2xl
            ${isGood 
              ? "bg-gradient-to-br from-emerald-900 to-teal-950 border-emerald-400 shadow-emerald-500/50" 
              : "bg-gradient-to-br from-rose-900 to-red-950 border-rose-400 shadow-rose-500/50"
            }
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background effects */}
          {isGood ? (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-full h-full text-emerald-300/30" />
            </motion.div>
          ) : (
            <motion.div
              className="absolute inset-0 bg-red-600/15 pointer-events-none"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}

          <h2 className={`text-4xl font-black mb-6 ${isGood ? "text-emerald-300" : "text-rose-300"}`}>
            {typeTitle} Card
          </h2>

          <p className="text-xl font-medium text-white mb-4">
            {playerName} drew:
          </p>

          <div className="bg-black/40 rounded-2xl p-6 mb-6 border border-white/10">
            <p className="text-2xl italic text-white leading-relaxed">
              "{card.text}"
            </p>
          </div>

          {card.effect && (
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={`text-3xl font-bold flex items-center justify-center gap-3 ${
                isGood ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isGood ? <Sparkles size={28} /> : <AlertTriangle size={28} />}
              {card.effect}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className={`
              mt-8 px-12 py-4 rounded-xl font-bold text-xl text-white
              transition-all shadow-lg
              ${isGood 
                ? "bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50" 
                : "bg-rose-600 hover:bg-rose-500 border border-rose-400/50"
              }
            `}
          >
            CONTINUE
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};