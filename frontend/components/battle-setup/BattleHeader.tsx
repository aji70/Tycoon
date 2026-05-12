"use client";
import { motion } from "framer-motion";

interface BattleHeaderProps {
  onBack: () => void;
}

export function BattleHeader({ onBack }: BattleHeaderProps) {
  return (
    <div className="relative mb-6 md:mb-12">
      {/* Glowing background */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-cyan-400/10 to-cyan-500/20 rounded-lg md:rounded-2xl blur-3xl opacity-60" />

      <div className="relative">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onBack}
          className="mb-3 md:mb-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-orbitron text-xs md:text-sm font-bold transition"
        >
          ← BACK TO BASE
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-orbitron uppercase tracking-wider mb-2 md:mb-3">
            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">⚔️</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 bg-clip-text text-transparent drop-shadow-lg"
              style={{
                textShadow: `
                  0 0 20px rgba(0, 240, 255, 0.5),
                  0 0 40px rgba(0, 240, 255, 0.3)
                `,
              }}
            >
              BATTLE SETUP
            </span>
          </h1>
          <p className="text-cyan-300/70 font-dmSans text-xs sm:text-sm tracking-widest uppercase mt-1 md:mt-2">
            Configure Your Match • Engage Enemy • Dominate
          </p>
        </motion.div>
      </div>
    </div>
  );
}
