"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, DollarSign, Skull, RotateCcw, Gift, Coins } from "lucide-react";

interface BankruptcyModalProps {
  isOpen: boolean;
  onClose?: () => void;
  message?: string;
  onReturnHome?: () => void;
  autoCloseDelay?: number;
  tokensAwarded?: number; // ← new: show how many tokens they got
}

export const BankruptcyModal: React.FC<BankruptcyModalProps> = ({
  isOpen,
  onClose,
  message = "Your empire has fallen... but you're not out of the game forever!",
  onReturnHome = () => window.location.href = "/",
  autoCloseDelay = 7500,
  tokensAwarded = 0.5, // default to 0.5 TYC
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onReturnHome();
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [isOpen, onReturnHome, autoCloseDelay]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[9999] p-4 overflow-hidden"
      >
        {/* Dramatic danger background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-red-950 via-black to-rose-950"
          animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.06, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Quick red alert flashes */}
        <motion.div
          className="absolute inset-0 bg-red-600/25 pointer-events-none"
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 1.4, repeat: 3, repeatType: "reverse" }}
        />

        <motion.div
          initial={{ scale: 0.72, y: 100, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.15 }}
          className="
            relative max-w-lg w-full
            p-10 md:p-14
            rounded-3xl border-4 border-red-700/70
            bg-gradient-to-b from-slate-950/95 via-red-950/75 to-black/95
            backdrop-blur-xl shadow-2xl shadow-red-900/60
            overflow-hidden text-center
          "
        >
          {/* Falling tokens + broken money animation */}
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-4xl pointer-events-none select-none"
              initial={{
                x: Math.random() * 360 - 180,
                y: -150,
                opacity: 0,
                rotate: Math.random() * 400 - 200,
              }}
              animate={{
                y: [0, 700, 900],
                opacity: [0.8, 1, 0],
                rotate: Math.random() * 800 - 400,
              }}
              transition={{
                duration: 3.5 + Math.random() * 3,
                delay: i * 0.12 + Math.random() * 0.4,
                ease: "easeIn",
              }}
              style={{ left: `${Math.random() * 100}%` }}
            >
              {Math.random() > 0.65 ? "💸" : "₿"}
            </motion.div>
          ))}

          {/* Main icon */}
          <motion.div
            initial={{ scale: 0.5, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 160, delay: 0.4 }}
            className="relative mb-10"
          >
            <Skull className="w-32 h-32 mx-auto text-red-500 drop-shadow-[0_0_45px_rgba(239,68,68,0.85)]" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <AlertTriangle className="w-20 h-20 text-red-400/60" />
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="
              text-6xl md:text-7xl font-black tracking-tighter mb-5
              bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-rose-500 to-red-600
              animate-pulse
            "
            style={{ textShadow: "0 0 35px rgba(239,68,68,0.8)" }}
          >
            BANKRUPTCY
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            className="text-2xl md:text-3xl font-bold text-red-300/90 mb-6"
          >
            {message}
          </motion.p>

          {/* Token consolation prize */}
          <motion.div
            initial={{ scale: 0.7, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ delay: 1.1, type: "spring", stiffness: 140 }}
            className="mb-10 p-6 bg-black/50 rounded-2xl border border-amber-600/40 inline-block"
          >
            <div className="flex items-center justify-center gap-4">
              <Coins className="w-12 h-12 text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.7)]" />
              <div className="text-left">
                <p className="text-xl font-bold text-amber-300">Consolation Reward</p>
                <p className="text-3xl font-black text-amber-200">
                  +{tokensAwarded} TYC
                </p>
                <p className="text-sm text-amber-200/70">Tycoon Tokens</p>
              </div>
            </div>
            <p className="mt-3 text-amber-100/80 text-base">
              Come back stronger next time — your empire awaits!
            </p>
          </motion.div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <motion.button
              whileHover={{ scale: 1.08, boxShadow: "0 0 35px rgba(245,158,11,0.5)" }}
              whileTap={{ scale: 0.95 }}
              onClick={onReturnHome}
              className="
                px-12 py-6 text-xl font-bold rounded-2xl
                bg-gradient-to-r from-amber-700 to-yellow-700
                hover:from-amber-600 hover:to-yellow-600
                border-2 border-amber-500/60
                shadow-xl shadow-amber-900/40
                transition-all duration-300 flex items-center gap-3
              "
            >
              <Gift size={24} />
              Claim {tokensAwarded} TYC & Return
            </motion.button>

            {onClose && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={onClose}
                className="
                  px-10 py-5 text-lg font-semibold rounded-2xl
                  bg-slate-800/80 hover:bg-slate-700
                  border border-slate-600
                  text-slate-300
                  transition-colors
                "
              >
                Close
              </motion.button>
            )}
          </div>

          <p className="mt-10 text-sm text-red-400/50">
            Better luck next empire • Tycoon never dies
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};