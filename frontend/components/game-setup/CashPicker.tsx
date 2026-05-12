"use client";
import { motion } from "framer-motion";

interface CashPickerProps {
  value: number;
  onChange: (value: number) => void;
}

const CASH_OPTIONS = [500, 1000, 1500, 2000];

export function CashPicker({ value, onChange }: CashPickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-amber-400 font-orbitron font-bold text-lg">STARTING CASH</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {CASH_OPTIONS.map((amount) => (
          <motion.button
            key={amount}
            onClick={() => onChange(amount)}
            className={`p-4 rounded-xl border-2 transition-all h-20 flex flex-col items-center justify-center relative overflow-hidden group ${
              value === amount
                ? "border-amber-400 bg-amber-500/20 shadow-lg shadow-amber-500/50"
                : "border-amber-500/20 bg-slate-900/60 hover:border-amber-400/40"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {value === amount && (
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute text-5xl opacity-50"
              >
                💰
              </motion.div>
            )}
            <div className="text-3xl mb-1">💰</div>
            <div className="text-sm font-orbitron font-bold text-amber-300">${amount}</div>
          </motion.button>
        ))}
      </div>

      {/* Display selected amount */}
      <div className="text-center mt-6 p-4 rounded-lg bg-black/40 border border-amber-500/30">
        <p className="text-xs text-amber-300/70 uppercase tracking-wide">Current Stake</p>
        <p className="text-2xl font-orbitron font-bold text-amber-300 mt-1">${value}</p>
      </div>
    </div>
  );
}
