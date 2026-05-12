"use client";
import { motion } from "framer-motion";

interface PlayerSlotsProps {
  count: number;
  onChange: (count: number) => void;
  max?: number;
}

export function PlayerSlots({ count, onChange, max = 8 }: PlayerSlotsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-purple-400 font-orbitron font-bold text-lg">OPPONENT SLOTS</span>
      </div>

      {/* Slot circles */}
      <div className="flex justify-center gap-3 flex-wrap">
        {Array.from({ length: max }).map((_, idx) => {
          const slotNum = idx + 1;
          const isFilled = slotNum <= count;
          return (
            <motion.button
              key={idx}
              onClick={() => onChange(slotNum)}
              className={`w-12 h-12 rounded-full font-bold text-lg transition-all border-2 flex items-center justify-center ${
                isFilled
                  ? "bg-cyan-500/30 border-cyan-400 shadow-lg shadow-cyan-500/50 text-cyan-100"
                  : "border-cyan-500/20 bg-slate-900/40 text-cyan-500/30 hover:border-cyan-400/40"
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {isFilled ? "👤" : "○"}
            </motion.button>
          );
        })}
      </div>

      {/* Count display and controls */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <button
          onClick={() => onChange(Math.max(2, count - 1))}
          disabled={count <= 2}
          className="w-10 h-10 rounded-lg border border-purple-500/40 bg-slate-900/60 text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          −
        </button>
        <div className="text-center">
          <p className="text-sm text-purple-300/70">PLAYERS</p>
          <p className="text-3xl font-orbitron font-bold text-purple-400">{count}</p>
        </div>
        <button
          onClick={() => onChange(Math.min(max, count + 1))}
          disabled={count >= max}
          className="w-10 h-10 rounded-lg border border-purple-500/40 bg-slate-900/60 text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          +
        </button>
      </div>
    </div>
  );
}
