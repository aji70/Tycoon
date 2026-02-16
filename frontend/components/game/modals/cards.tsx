import React, { useState, useEffect } from "react";
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
  const [showCardContent, setShowCardContent] = useState(false);
  const DRAW_DISPLAY_DURATION = 7000; // 7 seconds (between 5-10 seconds)
  const CONTENT_DISPLAY_DURATION = 8000; // 8 seconds to read the card content

  useEffect(() => {
    if (isOpen && card) {
      setShowCardContent(false);
      // Show "drew" message first
      const drawTimer = setTimeout(() => {
        setShowCardContent(true);
      }, DRAW_DISPLAY_DURATION);
      
      // Auto-close after showing content
      const closeTimer = setTimeout(() => {
        onClose();
      }, DRAW_DISPLAY_DURATION + CONTENT_DISPLAY_DURATION);
      
      return () => {
        clearTimeout(drawTimer);
        clearTimeout(closeTimer);
      };
    } else {
      setShowCardContent(false);
    }
  }, [isOpen, card, onClose]);

  if (!isOpen || !card) return null;

  const isGood = card.isGood;
  const typeTitle = card.type === "chance" ? "Chance" : "Community Chest";
  const cardColor = card.type === "chance" 
    ? { bg: "from-orange-900 to-amber-950", border: "border-orange-400", shadow: "shadow-orange-500/50", text: "text-orange-300" }
    : { bg: "from-blue-900 to-cyan-950", border: "border-blue-400", shadow: "shadow-blue-500/50", text: "text-blue-300" };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        {/* Stage 1: "Username drew Chance/Community Chest" */}
        <AnimatePresence mode="wait">
          {!showCardContent ? (
            <motion.div
              key="draw-stage"
              initial={{ scale: 0.5, opacity: 0, rotateY: -180 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotateY: 180 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className={`
                relative max-w-lg w-full p-12 rounded-3xl text-center overflow-hidden
                border-4 shadow-2xl
                bg-gradient-to-br ${cardColor.bg} ${cardColor.border} ${cardColor.shadow}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated card flip effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Card icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
                className="mb-8"
              >
                {card.type === "chance" ? (
                  <div className="text-8xl">🎲</div>
                ) : (
                  <div className="text-8xl">💎</div>
                )}
              </motion.div>

              {/* Username */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`text-5xl font-black mb-4 ${cardColor.text}`}
              >
                {playerName}
              </motion.h2>

              {/* "drew" text */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-bold text-white mb-6"
              >
                drew
              </motion.p>

              {/* Card type */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className={`text-4xl font-black ${cardColor.text} bg-black/30 rounded-2xl py-4 px-8 border-2 ${cardColor.border}`}
              >
                {typeTitle}
              </motion.div>

              {/* Pulsing effect */}
              <motion.div
                className={`absolute inset-0 rounded-3xl border-4 ${cardColor.border}`}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
          ) : (
            /* Stage 2: Card Content */
            <motion.div
              key="content-stage"
              initial={{ scale: 0.8, rotateY: 180, opacity: 0 }}
              animate={{ scale: 1, rotateY: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
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

              <motion.h2
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`text-4xl font-black mb-6 ${isGood ? "text-emerald-300" : "text-rose-300"}`}>
                {typeTitle} Card
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-medium text-white mb-4"
              >
                {playerName} drew:
              </motion.p>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-black/40 rounded-2xl p-6 mb-6 border border-white/10"
              >
                <p className="text-2xl italic text-white leading-relaxed">
                  "{card.text}"
                </p>
              </motion.div>

              {card.effect && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`text-3xl font-bold flex items-center justify-center gap-3 ${
                    isGood ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isGood ? <Sparkles size={28} /> : <AlertTriangle size={28} />}
                  {card.effect}
                </motion.p>
              )}

              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
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
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};