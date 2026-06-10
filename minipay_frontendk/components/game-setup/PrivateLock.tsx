"use client";
import { motion } from "framer-motion";

interface PrivateLockProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function PrivateLock({ checked, onCheckedChange }: PrivateLockProps) {
  return (
    <div className="space-y-4">
      {/* Lock toggle button */}
      <motion.button
        onClick={() => onCheckedChange(!checked)}
        className={`w-full p-6 rounded-xl border-2 transition-all ${
          checked
            ? "border-red-500/60 bg-red-500/15"
            : "border-green-500/40 bg-green-500/10"
        }`}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{checked ? "🔒" : "🔓"}</div>
            <div className="text-left">
              <h3 className="text-lg font-orbitron font-bold text-white uppercase">
                {checked ? "ROOM LOCKED" : "ROOM PUBLIC"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {checked ? "Join via code only" : "Anyone can discover"}
              </p>
            </div>
          </div>

          {/* Custom toggle switch */}
          <motion.div
            className={`w-16 h-8 rounded-full border-2 flex items-center p-1 transition-all ${
              checked
                ? "border-red-500 bg-red-900/40"
                : "border-green-500 bg-green-900/40"
            }`}
          >
            <motion.div
              animate={{ x: checked ? 32 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`w-6 h-6 rounded-full ${
                checked ? "bg-red-400" : "bg-green-400"
              } shadow-lg`}
            />
          </motion.div>
        </div>
      </motion.button>

      {/* Status badge */}
      <div className={`text-center p-4 rounded-lg border-2 transition-all ${
        checked
          ? "border-red-500/40 bg-red-900/30"
          : "border-green-500/40 bg-green-900/30"
      }`}>
        <span className={`font-orbitron font-bold uppercase tracking-widest ${
          checked ? "text-red-300" : "text-green-300"
        }`}>
          {checked ? "🔐 PRIVATE" : "🌐 PUBLIC"}
        </span>
      </div>
    </div>
  );
}
