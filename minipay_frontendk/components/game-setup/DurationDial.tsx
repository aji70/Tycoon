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
    <div className="flex flex-wrap gap-2 justify-center">
      {DURATION_OPTIONS.map((option) => (
        <motion.button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 rounded-lg border-2 font-orbitron font-bold text-xs transition-all ${
            value === option.value
              ? "border-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/40 text-indigo-200"
              : "border-indigo-500/20 bg-slate-900/60 hover:border-indigo-400/40 text-indigo-400"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {option.label}
        </motion.button>
      ))}
    </div>
  );
}
