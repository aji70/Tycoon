"use client";
import { motion } from "framer-motion";

interface WARoomLaunchButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  isFreeGame?: boolean;
  approvePending?: boolean;
  approveConfirming?: boolean;
  isCreatePending?: boolean;
  canCreate?: boolean;
  text?: string;
}

export function WARoomLaunchButton({
  onClick,
  disabled = false,
  isSubmitting = false,
  isFreeGame = false,
  approvePending = false,
  approveConfirming = false,
  isCreatePending = false,
  canCreate = true,
  text = "INITIATE MATCH",
}: WARoomLaunchButtonProps) {
  const isLoading =
    isSubmitting || approvePending || approveConfirming || isCreatePending;

  return (
    <div className="flex flex-col items-center justify-center gap-3 mt-6">
      <div className="relative w-full max-w-md">
        {/* Pulsing glow rings */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 rounded-xl border-2 border-cyan-500/40 blur-lg"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-xl border border-cyan-500/20 blur-xl"
        />

        <button
          onClick={onClick}
          disabled={disabled || !canCreate || isLoading}
          className="relative w-full px-8 py-4 text-lg font-orbitron font-bold tracking-wider
                     bg-black border-3 border-cyan-500 rounded-xl
                     hover:shadow-[0_0_20px_rgba(0,240,255,0.6)]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-300 overflow-hidden
                     text-cyan-300"
          title={!canCreate ? "Connect wallet and register to create a game" : undefined}
        >
          {/* Shine sweep effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: "-100%" }}
            whileHover={{ x: "100%" }}
            transition={{ duration: 0.6 }}
            style={{ pointerEvents: "none" }}
          />

          {/* Button text */}
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  ⚙️
                </motion.span>
                {approvePending || approveConfirming
                  ? "APPROVING…"
                  : isCreatePending
                  ? "CREATING…"
                  : "LAUNCHING…"}
              </>
            ) : (
              <>
                ⚡ {text}
              </>
            )}
          </span>
        </button>
      </div>

      {!canCreate && (
        <p className="text-xs text-slate-500 text-center">
          Connect your wallet and register to create a game.
        </p>
      )}
    </div>
  );
}
