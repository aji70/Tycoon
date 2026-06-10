"use client";
import { motion } from "framer-motion";

interface HUDLevelBadgeProps {
  level: number;
  label: string;
  progress: number;
  maxXp: number;
  currentXp: number;
}

export function HUDLevelBadge({
  level,
  label,
  progress,
  maxXp,
  currentXp,
}: HUDLevelBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Animated level badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-cyan-500/20 to-cyan-500/30 rounded-lg blur-xl animate-pulse" />
        <div className="relative backdrop-blur-sm bg-[#010F10]/80 border-2 border-[#00F0FF] rounded-lg px-6 py-3 shadow-lg shadow-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-xs font-orbitron text-[#00F0FF]/70 uppercase tracking-wider">
                LEVEL
              </span>
              <motion.span
                key={level}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-2xl font-orbitron font-bold text-[#00F0FF] leading-none"
              >
                {level}
              </motion.span>
            </div>
            <div className="w-px h-8 bg-[#00F0FF]/30" />
            <div className="text-right">
              <span className="text-xs font-orbitron text-[#00F0FF]/70 uppercase tracking-wider block">
                STATUS
              </span>
              <motion.span
                key={label}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-sm font-dmSans font-semibold text-[#17ffff]"
              >
                {label}
              </motion.span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* XP Bar with label */}
      {level < 99 && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "auto", opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-xs"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-orbitron text-[#00F0FF]/70 uppercase">
              XP Progress
            </span>
            <span className="text-xs font-dmSans text-[#00F0FF]/60">
              {Math.round(currentXp)}/{Math.round(maxXp)}
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-[#0E282A] overflow-hidden border border-[#003B3E]/60 shadow-inner shadow-black/50">
            {/* Glow effect behind bar */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500/30 via-cyan-400/20 to-transparent blur-md"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
            {/* Main XP bar */}
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] via-[#0FF0FC] to-[#00F0FF] shadow-lg shadow-cyan-500/50"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                boxShadow:
                  "0 0 12px rgba(0, 240, 255, 0.8), inset 0 0 6px rgba(255, 255, 255, 0.3)",
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Live stats ticker */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-xs font-orbitron text-[#00F0FF]/60 tracking-wider uppercase"
      >
        ⚡ Ready for Battle
      </motion.div>
    </div>
  );
}
