"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: {
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null;
  playerName: string;
  /** Auto-close after this many ms; 0 = no auto-close */
  autoCloseMs?: number;
}

export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  card,
  playerName,
  autoCloseMs = 12000,
}) => {
  useEffect(() => {
    if (!isOpen || autoCloseMs <= 0) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  const displayName = (playerName || "Player").trim() || "Player";
  const cardLabel = card?.type === "chance" ? "Chance" : "Community Chest";
  const drawLine = `${displayName} draws ${cardLabel}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-xl bg-white shadow-2xl overflow-hidden border border-gray-200"
        >
          {/* Line 1: "PlayerName draws Chance" or "PlayerName draws Community Chest" */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 text-center">
            <p className="text-base font-semibold text-gray-800">
              {drawLine}
            </p>
          </div>

          {/* The action on the card */}
          <div className="px-5 py-5 text-center min-h-[4rem] flex flex-col justify-center">
            {card?.text ? (
              <p className="text-gray-800 text-lg leading-snug font-medium">
                {card.text}
              </p>
            ) : (
              <p className="text-gray-500 text-sm">No card details</p>
            )}
          </div>

          <div className="px-5 pb-4 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
