"use client";
import { motion } from "framer-motion";

interface DurationDialProps {
  value: number;
  onChange: (value: number) => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "60m" },
  { value: 90, label: "90m" },
  { value: 0, label: "∞" },
];

export function DurationDial({ value, onChange }: DurationDialProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-indigo-400 font-orbitron font-bold text-lg">GAME DURATION</span>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        {DURATION_OPTIONS.map((option) => (
          <motion.button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`px-5 py-3 rounded-lg border-2 font-orbitron font-bold uppercase transition-all ${
              value === option.value
                ? "border-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/50 text-indigo-200"
                : "border-indigo-500/20 bg-slate-900/60 hover:border-indigo-400/40 text-indigo-400"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-lg mr-2">⏱</span>
            {option.label}
          </motion.button>
        ))}
      </div>

      {/* Duration display */}
      <div className="text-center mt-6 p-4 rounded-lg bg-black/40 border border-indigo-500/30">
        <p className="text-xs text-indigo-300/70 uppercase tracking-wide">Match Duration</p>
        <p className="text-2xl font-orbitron font-bold text-indigo-300 mt-1">
          {value === 0 ? "NO TIME LIMIT" : `${value} MINUTES`}
        </p>
      </div>
    </div>
  );
}
