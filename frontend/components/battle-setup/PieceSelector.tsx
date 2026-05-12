"use client";
import { motion } from "framer-motion";
import { GamePieces } from "@/lib/constants/games";

interface PieceSelectorProps {
  selected: string;
  onChange: (id: string) => void;
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

export function PieceSelector({ selected, onChange }: PieceSelectorProps) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
      {GamePieces.map((piece, idx) => (
        <motion.button
          key={piece.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: idx * 0.05 }}
          onClick={() => onChange(piece.id)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative p-2 md:p-4 rounded-lg md:rounded-xl transition-all duration-300 border-2 group flex flex-col items-center justify-center min-h-24 ${
            selected === piece.id
              ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
              : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
          }`}
        >
          {/* Glow when selected */}
          {selected === piece.id && (
            <motion.div
              layoutId="selectedPiece"
              className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-cyan-400/20 rounded-lg md:rounded-xl blur-lg -z-10"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}

          <div className="text-2xl md:text-3xl mb-1 md:mb-2">{PIECE_EMOJI[piece.id] || "?"}</div>
          <div className="text-xs font-orbitron text-cyan-300 font-bold text-center truncate px-1 max-w-full">
            {piece.name}
          </div>

          {/* Selection indicator */}
          {selected === piece.id && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-cyan-300"
            >
              <span className="text-white text-xs font-bold">✓</span>
            </motion.div>
          )}
        </motion.button>
      ))}
    </div>
  );
}
