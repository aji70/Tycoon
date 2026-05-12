"use client";
import { motion } from "framer-motion";

interface CashPickerProps {
  value: number;
  onChange: (value: number) => void;
}

const CASH_OPTIONS = [500, 1000, 1500, 2000];

export function CashPicker({ value, onChange }: CashPickerProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {CASH_OPTIONS.map((amount) => (
          <motion.button
            key={amount}
            onClick={() => onChange(amount)}
            className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center justify-center relative overflow-hidden ${
              value === amount
                ? "border-amber-400 bg-amber-500/20 shadow-lg shadow-amber-500/40"
                : "border-amber-500/20 bg-slate-900/60 hover:border-amber-400/40"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {value === amount && (
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute text-3xl opacity-40"
              >
                💰
              </motion.div>
            )}
            <div className="text-lg">💰</div>
            <div className="text-xs font-orbitron font-bold text-amber-300">${amount}</div>
          </motion.button>
        ))}
      </div>

      {/* Display selected amount - inline */}
      <div className="text-center text-xs">
        <p className="text-amber-300 font-orbitron font-bold">${value}</p>
      </div>
    </div>
  );
}
