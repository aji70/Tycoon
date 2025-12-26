"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Skull, Coins } from "lucide-react";

interface BankruptcyModalProps {
  isOpen: boolean;
  onClose?: () => void;
  message?: string;
  onReturnHome?: () => void;
  autoCloseDelay?: number; // in milliseconds
  tokensAwarded?: number;
}

export const BankruptcyModal: React.FC<BankruptcyModalProps> = ({
  isOpen,
  onClose,
  message = "Your empire has fallen... but the game isn't over forever!",
  onReturnHome = () => (window.location.href = "/"),
  autoCloseDelay = 8000,
  tokensAwarded = 0.5,
}) => {
  const [shouldShow, setShouldShow] = useState(isOpen);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(autoCloseDelay / 1000));
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigated = useRef(false);

  // Sync internal visibility with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setShouldShow(true);
      setSecondsLeft(Math.round(autoCloseDelay / 1000));
      hasNavigated.current = false;
    }
  }, [isOpen, autoCloseDelay]);

  // Countdown + auto-close logic
  useEffect(() => {
    if (!shouldShow) return;

    // Live countdown every second
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Schedule the exit sequence
    const exitTimer = setTimeout(() => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      // Trigger exit animation
      setShouldShow(false);

      // Wait for exit animation to complete before navigation
      const EXIT_ANIMATION_DURATION = 800; // Adjust to match your exit transition duration
      setTimeout(() => {
        onReturnHome();
      }, EXIT_ANIMATION_DURATION);
    }, autoCloseDelay);

    // Cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeout(exitTimer);
    };
  }, [shouldShow, autoCloseDelay, onReturnHome]);

  const handleManualClose = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    setShouldShow(false);

    // Optional: small delay if you want exit animation on manual close too
    setTimeout(() => {
      if (onClose) onClose();
      else onReturnHome();
    }, 800);
  };

  if (!shouldShow) return null;

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[9999] p-4"
        >
          {/* Animated background gradient */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-red-950 via-black to-rose-950"
            animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.04, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div
            key="content"
            initial={{ scale: 0.75, y: 80, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.68, y: 120, opacity: 0, transition: { duration: 0.7, ease: "easeIn" } }}
            transition={{ type: "spring", stiffness: 100, damping: 14, delay: 0.1 }}
            className="
              relative w-full max-w-md sm:max-w-lg md:max-w-xl
              p-8 sm:p-10 md:p-12
              rounded-3xl border-4 border-red-700/60
              bg-gradient-to-b from-slate-950 via-red-950/80 to-black/90
              backdrop-blur-xl shadow-2xl shadow-red-900/70
              text-center overflow-hidden
            "
          >
            {/* Falling money/coins animation */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-3xl sm:text-4xl pointer-events-none select-none"
                initial={{
                  x: Math.random() * 300 - 150,
                  y: -200,
                  opacity: 0,
                  rotate: Math.random() * 360 - 180,
                }}
                animate={{
                  y: [0, 800, 1000],
                  opacity: [0.7, 1, 0],
                  rotate: Math.random() * 720 - 360,
                }}
                transition={{
                  duration: 4 + Math.random() * 3,
                  delay: i * 0.15 + Math.random() * 0.4,
                  ease: "easeIn",
                  repeat: Infinity,
                  repeatDelay: Math.random() * 2,
                }}
                style={{ left: `${Math.random() * 100}%` }}
              >
                {Math.random() > 0.6 ? "💸" : "₿"}
              </motion.div>
            ))}

            {/* Skull + Alert icon */}
            <motion.div
              initial={{ scale: 0.6, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 140, delay: 0.3 }}
              className="relative mb-8"
            >
              <Skull className="w-28 h-28 sm:w-32 sm:h-32 mx-auto text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,0.9)]" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <AlertTriangle className="w-16 h-16 sm:w-20 sm:h-20 text-red-400/50" />
              </motion.div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="
                text-4xl sm:text-5xl md:text-6xl lg:text-7xl 
                font-black tracking-tight mb-4 leading-none
                bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-rose-500 to-red-600
                animate-pulse
              "
              style={{ textShadow: "0 0 30px rgba(239,68,68,0.85)" }}
            >
              BANKRUPTCY
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-xl sm:text-2xl md:text-3xl font-bold text-red-200/90 mb-8 max-w-md mx-auto"
            >
              {message}
            </motion.p>

            {/* Token reward section */}
            <motion.div
              initial={{ scale: 0.75, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 130 }}
              className="mb-10 p-6 bg-black/60 rounded-2xl border border-amber-600/50 inline-block"
            >
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <Coins className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]" />
                <div className="text-left">
                  <p className="text-lg sm:text-xl font-bold text-amber-300">Compensated with</p>
                  <p className="text-3xl sm:text-4xl font-black text-amber-100">
                    +{tokensAwarded} TYC
                  </p>
                  <p className="text-sm sm:text-base text-amber-200/80">Tycoon Tokens</p>
                </div>
              </div>
              <p className="mt-4 text-amber-100/90 text-base sm:text-lg">
                Your tokens have been added — come back stronger!
              </p>
            </motion.div>

            {/* Countdown display */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="text-base sm:text-lg text-red-300/80 mb-8 font-medium"
            >
              Redirecting to home in{" "}
              <span className="text-red-100 font-bold text-xl">{secondsLeft}</span>{" "}
              second{secondsLeft !== 1 ? "s" : ""}...
            </motion.p>

            {/* Optional manual close button */}
            {onClose && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleManualClose}
                className="
                  px-8 py-4 text-base sm:text-lg font-semibold rounded-xl
                  bg-slate-800/70 hover:bg-slate-700
                  border border-slate-600 text-slate-300
                  transition-colors
                "
              >
                Close Preview
              </motion.button>
            )}

            <p className="mt-8 text-xs sm:text-sm text-red-400/50">
              The Tycoon never truly falls • Rise again soon
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};