"use client";
import { motion } from "framer-motion";
import { GamePieces } from "@/lib/constants/games";

interface PieceTileSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const PIECE_EMOJI: Record<string, string> = {
  hat: "🎩",
  car: "🚗",
  dog: "🐕",
  thimble: "🔧",
  wheelbarrow: "🛒",
  battleship: "🚢",
  boot: "👢",
  iron: "♨️",
  top_hat: "🎩",
};

export function PieceTileSelector({ value, onChange }: PieceTileSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-cyan-400 font-orbitron font-bold text-lg">SELECT YOUR PIECE</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {GamePieces.map((piece, idx) => (
          <motion.button
            key={piece.id}
            onClick={() => onChange(piece.id)}
            className={`relative p-4 rounded-xl border-2 transition-all h-24 flex flex-col items-center justify-center ${
              value === piece.id
                ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                : "border-cyan-500/20 bg-slate-900/60 hover:border-cyan-400/40"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <div className="text-4xl mb-2">{PIECE_EMOJI[piece.id] || "?"}</div>
            <div className="text-xs font-orbitron font-bold text-cyan-300 text-center uppercase">
              {piece.name}
            </div>
            {value === piece.id && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/60">
                ✓
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
