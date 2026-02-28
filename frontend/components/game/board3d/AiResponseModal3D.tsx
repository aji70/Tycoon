"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface AiResponseModal3DProps {
  popup: { trade?: any; favorability?: number; decision?: string; remark?: string } | null;
  properties: { id: number; name: string }[];
  onClose: () => void;
}

/** Gamy AI trade response modal — renders via portal so visible above 3D board */
export default function AiResponseModal3D({ popup, properties, onClose }: AiResponseModal3DProps) {
  if (!popup) return null;

  const trade = popup.trade || {};
  const favorability = popup.favorability ?? 0;
  const decision = popup.decision;
  const remark = popup.remark || "No comment.";

  const offeredPropNames = properties
    .filter((p) => trade.offer_properties?.includes(p.id))
    .map((p) => p.name);
  const requestedPropNames = properties
    .filter((p) => trade.requested_properties?.includes(p.id))
    .map((p) => p.name);

  const hasOfferedProps = offeredPropNames.length > 0;
  const hasOfferedCash = (trade.offer_amount ?? 0) > 0;
  const hasRequestedProps = requestedPropNames.length > 0;
  const hasRequestedCash = (trade.requested_amount ?? 0) > 0;

  const isAccepted = decision === "accepted";

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-amber-500/60 shadow-2xl shadow-amber-500/20"
        style={{
          background: "linear-gradient(165deg, #1e293b 0%, #0f172a 40%, #020617 100%)",
          boxShadow: "0 0 40px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Header strip */}
        <div className="h-16 border-b-2 border-amber-500/30 bg-gradient-to-r from-amber-900/50 to-cyan-900/30 flex items-center justify-center">
          <h2 className="text-xl font-black text-amber-200 tracking-widest uppercase">
            AI Response
          </h2>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border border-amber-400/50 flex items-center justify-center text-amber-100 font-bold text-lg transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Favorability */}
          <div className="rounded-xl border border-cyan-500/40 bg-slate-800/60 py-4 px-5 text-center">
            <p className="text-sm font-bold text-cyan-300/90 uppercase tracking-wider mb-1">
              Favorability
            </p>
            <p
              className={`text-3xl font-black ${
                favorability >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {favorability >= 0 ? "+" : ""}
              {favorability}%
            </p>
          </div>

          {/* Decision */}
          <div
            className={`rounded-xl py-4 px-5 text-center font-black text-2xl ${
              isAccepted
                ? "bg-emerald-900/40 border border-emerald-500/50 text-emerald-300"
                : "bg-rose-900/40 border border-rose-500/50 text-rose-300"
            }`}
          >
            {isAccepted ? "ACCEPTED ✓" : "DECLINED ✗"}
          </div>

          {/* Remark */}
          <p className="text-center text-slate-200 italic text-sm leading-relaxed">
            &ldquo;{remark}&rdquo;
          </p>

          {/* Trade summary */}
          <div className="space-y-3">
            {(hasOfferedProps || hasOfferedCash) && (
              <div className="rounded-xl border border-emerald-500/40 bg-slate-800/50 p-3">
                <p className="text-xs font-bold text-emerald-400 uppercase mb-1">You offered</p>
                <p className="text-sm text-slate-200">
                  {hasOfferedProps && offeredPropNames.join(", ")}
                  {hasOfferedProps && hasOfferedCash && " + "}
                  {hasOfferedCash && (
                    <span className="text-emerald-300 font-semibold">${trade.offer_amount}</span>
                  )}
                </p>
              </div>
            )}
            {(hasRequestedProps || hasRequestedCash) && (
              <div className="rounded-xl border border-amber-500/40 bg-slate-800/50 p-3">
                <p className="text-xs font-bold text-amber-400 uppercase mb-1">You requested</p>
                <p className="text-sm text-slate-200">
                  {hasRequestedProps && requestedPropNames.join(", ")}
                  {hasRequestedProps && hasRequestedCash && " + "}
                  {hasRequestedCash && (
                    <span className="text-amber-300 font-semibold">${trade.requested_amount}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-amber-600/40 hover:bg-amber-500/50 font-bold text-amber-100 border border-amber-400/50 transition"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
