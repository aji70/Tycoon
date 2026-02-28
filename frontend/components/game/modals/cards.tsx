"use client";

import React, { useEffect, useState } from "react";
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
  /** Min ms to show before Close is enabled (forces read time) */
  minDisplayMs?: number;
}

export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  card,
  playerName,
  autoCloseMs = 12000,
  minDisplayMs = 2500,
}) => {
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (!isOpen) return setCanClose(false);
    const t = setTimeout(() => setCanClose(true), minDisplayMs);
    return () => clearTimeout(t);
  }, [isOpen, minDisplayMs]);

  useEffect(() => {
    if (!isOpen || autoCloseMs <= 0) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  const displayName = (playerName || "Player").trim() || "Player";
  const isChance = card?.type === "chance";
  const cardLabel = isChance ? "Chance" : "Community Chest";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        style={{ zIndex: 2147483647 }}
        onClick={canClose ? onClose : undefined}
      >
        <motion.div
          initial={{ scale: 0.85, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md overflow-hidden"
          style={{
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          {/* Card header - Chance = orange, Community Chest = blue */}
          <div
            className={`px-6 py-5 text-center border-b-4 ${
              isChance
                ? "bg-gradient-to-b from-amber-400 to-amber-600 border-amber-700 text-amber-950"
                : "bg-gradient-to-b from-blue-400 to-blue-700 border-blue-800 text-white"
            }`}
          >
            <p className="text-xs font-bold tracking-widest uppercase opacity-90">
              {displayName} draws
            </p>
            <h2 className="text-2xl font-black mt-1 tracking-tight">
              {cardLabel}
            </h2>
          </div>

          {/* Card body - clean white/cream card look */}
          <div className="px-6 py-6 bg-[#faf8f5] text-slate-800">
            {card?.text ? (
              <p className="text-lg leading-relaxed font-medium text-slate-800">
                {card.text}
              </p>
            ) : (
              <p className="text-slate-500 text-base">No card details</p>
            )}
            {card?.effect && (
              <p className={`mt-3 text-sm font-bold ${card.isGood ? "text-emerald-700" : "text-red-700"}`}>
                {card.effect}
              </p>
            )}
          </div>

          {/* Footer - Close button (disabled until minDisplayMs) */}
          <div className="px-6 pb-5 pt-2 flex justify-center">
            <button
              type="button"
              onClick={canClose ? onClose : undefined}
              disabled={!canClose}
              className={`px-8 py-3 rounded-xl text-base font-bold transition ${
                canClose
                  ? "bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              {canClose ? "Continue" : "..."}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
