"use client";
import { motion } from "framer-motion";

interface OpponentSlotsProps {
  count: number;
  onChange: (count: number) => void;
}

export function OpponentSlots({ count, onChange }: OpponentSlotsProps) {
  return (
    <div className="space-y-4">
      {/* Slot selector */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((num) => (
          <motion.button
            key={num}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(num)}
            className={`py-3 rounded-lg font-orbitron font-bold text-sm transition-all duration-300 border-2 ${
              count === num
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/40"
                : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
            }`}
          >
            {num}
          </motion.button>
        ))}
      </div>

      {/* Visual opponent slots */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[...Array(6)].map((_, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: idx < count ? 1 : 0.3, scale: 1 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
              idx < count
                ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/30"
                : "border-cyan-500/20 bg-slate-800/20"
            }`}
          >
            <div className="text-3xl">🤖</div>
            <div className="text-xs font-orbitron text-cyan-300/80 mt-1">
              {idx < count ? `AI-${idx + 1}` : "EMPTY"}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
