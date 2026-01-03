"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Skull, Coins } from "lucide-react";

interface BankruptcyModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirmBankruptcy?: () => Promise<void> | void;
  message?: string;
  onReturnHome?: () => void;
  autoCloseDelay?: number; // milliseconds
  tokensAwarded?: number;
}

export const BankruptcyModal: React.FC<BankruptcyModalProps> = ({
  isOpen,
  onClose,
  onConfirmBankruptcy,
  message = "You cannot pay your debts. Your empire has collapsed.",
  onReturnHome = () => (window.location.href = "/"),
  autoCloseDelay = 10000,
  tokensAwarded = 0.5,
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(autoCloseDelay / 1000));
  const [isConfirming, setIsConfirming] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigated = useRef(false);

  // Sync visibility with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setShouldShow(true);
      setIsConfirming(false);
      hasNavigated.current = false;

      // Only reset countdown if in auto mode
      if (!onConfirmBankruptcy) {
        setSecondsLeft(Math.round(autoCloseDelay / 1000));
      }
    } else {
      setShouldShow(false);
    }
  }, [isOpen, autoCloseDelay, onConfirmBankruptcy]);

  // Auto-close logic (only when no manual confirmation needed)
  useEffect(() => {
    if (!shouldShow || onConfirmBankruptcy) {
      // Clean up any running timers
      if (timerRef.current) clearInterval(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      return;
    }

    // Countdown timer
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto navigation after delay
    exitTimerRef.current = setTimeout(() => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      setShouldShow(false);

      // Navigate after exit animation completes
      setTimeout(() => {
        onReturnHome();
      }, 1200);
    }, autoCloseDelay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [shouldShow, autoCloseDelay, onReturnHome, onConfirmBankruptcy]);

  const handleManualClose = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    setShouldShow(false);
    setTimeout(() => {
      onClose?.();
    }, 1200);
  };

  const handleDeclareBankruptcy = async () => {
    if (isConfirming || hasNavigated.current) return;
    setIsConfirming(true);

    try {
      await onConfirmBankruptcy?.();
    } catch (error) {
      console.error("Bankruptcy declaration failed:", error);
      setIsConfirming(false);
      return;
    } finally {
      // Always exit after confirmation (success or fail)
      hasNavigated.current = true;
      setShouldShow(false);

      setTimeout(() => {
        onReturnHome();
      }, 1200);
    }
  };

  if (!shouldShow) return null;

  const isManualMode = !!onConfirmBankruptcy;

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[9999] p-4"
        >
          {/* Pulsing background */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-red-950 via-black to-purple-950"
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.06, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div
            initial={{ scale: 0.7, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.6, y: 200, opacity: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 16 }}
            className="
              relative w-full max-w-lg md:max-w-2xl
              p-8 md:p-12 rounded-3xl
              border-4 border-red-800/70
              bg-gradient-to-b from-slate-950/95 via-red-950/70 to-black/95
              backdrop-blur-2xl shadow-2xl shadow-red-900/80
              text-center overflow-hidden
            "
          >
            {/* Falling money & assets */}
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl md:text-5xl pointer-events-none select-none"
                initial={{ x: Math.random() * 500 - 250, y: -400, opacity: 0 }}
                animate={{ y: 1200, opacity: [0.8, 1, 0] }}
                transition={{
                  duration: 6 + Math.random() * 5,
                  delay: i * 0.2,
                  repeat: Infinity,
                  ease: "easeIn",
                }}
                style={{ left: `${Math.random() * 100}%` }}
              >
                {["💸", "₿", "🏠", "💰", "🪙"][Math.floor(Math.random() * 5)]}
              </motion.div>
            ))}

            {/* Skull icon */}
            <motion.div
              initial={{ scale: 0.4, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 110, delay: 0.2 }}
              className="mb-10"
            >
              <Skull className="w-40 h-40 mx-auto text-red-500 drop-shadow-[0_0_60px_rgba(239,68,68,1)]" />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="
                text-6xl md:text-8xl font-black tracking-tighter mb-6
                bg-clip-text text-transparent
                bg-gradient-to-b from-red-400 via-red-600 to-red-800
                drop-shadow-2xl
              "
            >
              BANKRUPT
            </motion.h1>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-xl md:text-2xl font-medium text-red-200/90 mb-12 max-w-lg mx-auto leading-relaxed"
            >
              {message}
            </motion.p>

            {/* Token Reward */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 100 }}
              className="mb-12 p-8 bg-amber-950/50 rounded-3xl border-2 border-amber-600/70"
            >
              <div className="flex items-center justify-center gap-6">
                <Coins className="w-16 h-16 text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,1)]" />
                <div className="text-left">
                  <p className="text-amber-300 text-xl font-bold">Consolation Prize</p>
                  <p className="text-5xl md:text-6xl font-black text-amber-100">
                    +{tokensAwarded} TYC
                  </p>
                  <p className="text-amber-200 text-lg">Tycoon Tokens Awarded</p>
                </div>
              </div>
            </motion.div>

            {/* Action Area */}
            {isManualMode ? (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="space-y-6"
              >
                <button
                  onClick={handleDeclareBankruptcy}
                  disabled={isConfirming}
                  className="
                    w-full max-w-md mx-auto px-12 py-6 text-3xl font-bold rounded-3xl
                    bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-70
                    text-white shadow-2xl shadow-red-900/80
                    border-4 border-red-900/60
                    transition-all duration-300
                  "
                >
                  {isConfirming ? "Declaring..." : "Declare Bankruptcy"}
                </button>

                {onClose && (
                  <button
                    onClick={handleManualClose}
                    className="text-red-300 hover:text-red-100 underline text-lg font-medium"
                  >
                    Cancel
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="text-xl md:text-2xl text-red-300 font-medium"
              >
                {secondsLeft > 0 ? (
                  <>
                    Returning to home in{" "}
                    <span className="text-red-100 font-black text-4xl">{secondsLeft}</span>{" "}
                    second{secondsLeft !== 1 ? "s" : ""}...
                  </>
                ) : (
                  <span className="text-4xl font-bold text-red-100 animate-pulse">
                    Farewell, Tycoon...
                  </span>
                )}
              </motion.div>
            )}

            <p className="mt-12 text-sm md:text-base text-red-400/60 italic">
              Every great tycoon falls once. Rise again — stronger.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};