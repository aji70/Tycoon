"use client";
import { motion } from "framer-motion";

interface DifficultySelectorProps {
  selected: string;
  onChange: (difficulty: string) => void;
  showRandomOption?: boolean;
  randomMode?: string;
  onRandomModeChange?: (mode: string) => void;
}

const difficulties = [
  { id: "easy", label: "EASY", icon: "🟢", desc: "Relaxed match" },
  { id: "hard", label: "HARD", icon: "🟡", desc: "Intense combat" },
  { id: "boss", label: "⚠️ BOSS MODE", icon: "💀", desc: "Maximum threat", danger: true },
];

export function DifficultySelector({
  selected,
  onChange,
  showRandomOption,
  randomMode,
  onRandomModeChange,
}: DifficultySelectorProps) {
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {difficulties.map((diff, idx) => (
          <motion.button
            key={diff.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            onClick={() => onChange(diff.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative p-2 md:p-4 rounded-lg md:rounded-xl transition-all duration-300 border-2 font-orbitron ${
              selected === diff.id
                ? diff.danger
                  ? "border-red-500 bg-red-600/30 shadow-lg shadow-red-600/60"
                  : "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                : diff.danger
                  ? "border-red-600/50 bg-red-900/20 hover:border-red-500/70"
                  : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
            }`}
          >
            {/* BOSS MODE danger glow */}
            {diff.danger && selected === diff.id && (
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -inset-1 bg-gradient-to-r from-red-600/40 to-orange-600/30 rounded-lg md:rounded-xl blur-lg -z-10"
              />
            )}

            {/* Normal glow */}
            {!diff.danger && selected === diff.id && (
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-cyan-400/20 rounded-lg md:rounded-xl blur-lg -z-10" />
            )}

            <div className="text-xl md:text-2xl mb-1">{diff.icon}</div>
            <div className="text-xs md:text-sm font-bold text-white">{diff.label}</div>
            <div className="text-xs opacity-70 text-slate-300 hidden md:block">{diff.desc}</div>

            {selected === diff.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                  diff.danger
                    ? "bg-red-600 border-red-300"
                    : "bg-cyan-500 border-cyan-300"
                }`}
              >
                <span className="text-white text-xs font-bold">✓</span>
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Random/Same toggle for multiple opponents */}
      {showRandomOption && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-slate-800/30 rounded-lg p-3 border border-cyan-500/20 flex items-center justify-between"
        >
          <span className="text-xs font-orbitron text-cyan-300 uppercase">Per Opponent</span>
          <div className="flex gap-2">
            {["same", "random"].map((mode) => (
              <button
                key={mode}
                onClick={() => onRandomModeChange?.(mode)}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${
                  randomMode === mode
                    ? "bg-cyan-500/60 text-white border border-cyan-400"
                    : "bg-slate-700/50 text-cyan-300/60 border border-cyan-500/20"
                }`}
              >
                {mode === "same" ? "Same" : "Random"}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
