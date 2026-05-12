"use client";
import { motion } from "framer-motion";

interface LaunchButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  children: string;
}

export function LaunchButton({
  onClick,
  disabled,
  loading,
  children,
}: LaunchButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="w-full max-w-2xl"
    >
      {/* Outer glow container */}
      <div className="relative group">
        {/* Pulsing glow background */}
        <motion.div
          animate={{
            boxShadow: [
              "0 0 20px rgba(0, 240, 255, 0.3)",
              "0 0 40px rgba(0, 240, 255, 0.6)",
              "0 0 20px rgba(0, 240, 255, 0.3)",
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-2 bg-gradient-to-r from-cyan-500/30 via-cyan-400/20 to-cyan-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />

        <button
          onClick={onClick}
          disabled={disabled || loading}
          className={`relative w-full py-4 md:py-6 px-4 md:px-8 rounded-xl md:rounded-2xl font-orbitron font-black uppercase text-base sm:text-lg md:text-2xl tracking-wider transition-all duration-300 border-2 overflow-hidden group/btn ${
            disabled
              ? "opacity-50 cursor-not-allowed border-cyan-600/30 bg-cyan-900/30 text-cyan-600/50"
              : "border-cyan-400 bg-gradient-to-b from-cyan-500 via-cyan-600 to-cyan-700 text-slate-900 hover:from-cyan-400 hover:via-cyan-500 hover:to-cyan-600 active:scale-95"
          }`}
        >
          {/* Shine effect */}
          {!disabled && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover/btn:opacity-30"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.5 }}
            />
          )}

          {/* Content */}
          <div className="relative z-10 flex items-center justify-center gap-3">
            <motion.span
              animate={{ scale: loading ? [1, 1.2, 1] : 1 }}
              transition={{ duration: 0.6, repeat: loading ? Infinity : 0 }}
            >
              🚀
            </motion.span>
            <span>{loading ? "LAUNCHING..." : children}</span>
            <motion.span
              animate={{ scale: loading ? [1, 1.2, 1] : 1 }}
              transition={{ duration: 0.6, repeat: loading ? Infinity : 0 }}
            >
              🎯
            </motion.span>
          </div>

          {/* Pulse animation on hover */}
          {!disabled && (
            <>
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
                className="absolute inset-0 rounded-2xl border-2 border-cyan-400/50"
              />
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [1, 0] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  repeatDelay: 0.3,
                }}
                className="absolute inset-0 rounded-2xl border-2 border-cyan-300/30"
              />
            </>
          )}
        </button>
      </div>

      {/* Status text */}
      {!disabled && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-cyan-300/60 text-xs font-orbitron uppercase tracking-wider mt-4"
        >
          ⚡ Ready to Engage • All Systems GO
        </motion.p>
      )}
    </motion.div>
  );
}
