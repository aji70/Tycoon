"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Property } from "@/types/game";
import { X, Handshake } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

type DeleteConfirmMode = "outgoing" | "all" | null;

interface TradeSection3DProps {
  showTrade: boolean;
  toggleTrade: () => void;
  openTrades: any[];
  tradeRequests: any[];
  properties: Property[];
  game: { players?: any[] };
  onTradeAction: (id: number, action: "accepted" | "declined" | "counter" | "delete") => void;
}

export default function TradeSection3D({
  showTrade,
  toggleTrade,
  openTrades,
  tradeRequests,
  properties,
  game,
  onTradeAction,
}: TradeSection3DProps) {
  const totalActive = openTrades.length + tradeRequests.length;
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmMode>(null);

  const handleClearAllOutgoing = () => {
    if (openTrades.length === 0) return;
    setDeleteConfirm("outgoing");
  };

  const handleDeleteAll = () => {
    const total = tradeRequests.length + openTrades.length;
    if (total === 0) return;
    setDeleteConfirm("all");
  };

  const confirmDelete = () => {
    if (deleteConfirm === "outgoing") {
      openTrades.forEach((trade) => onTradeAction(trade.id, "delete"));
    } else if (deleteConfirm === "all") {
      tradeRequests.forEach((trade) => onTradeAction(trade.id, "delete"));
      openTrades.forEach((trade) => onTradeAction(trade.id, "delete"));
    }
    setDeleteConfirm(null);
  };

  const renderTrade = (trade: any, isIncoming: boolean) => {
    const offeredProps = properties.filter((p) => trade.offer_properties?.includes(p.id));
    const requestedProps = properties.filter((p) => trade.requested_properties?.includes(p.id));
    const player = game.players?.find((pl: any) =>
      isIncoming ? pl.user_id === trade.player_id : pl.user_id === trade.target_player_id
    );

    return (
      <div
        key={trade.id}
        className="rounded-xl border border-cyan-500/30 bg-slate-800/60 p-2.5 text-xs"
      >
        <p className="font-semibold text-cyan-200 mb-1">
          {isIncoming ? "From" : "To"} {player?.username || "Player"}
        </p>
        <p className="text-emerald-400/90 mb-0.5">
          {isIncoming ? "Gives" : "Offer"}:{" "}
          {offeredProps.length ? offeredProps.map((p) => p.name).join(", ") : "—"}{" "}
          {trade.offer_amount > 0 && `+ $${trade.offer_amount}`}
        </p>
        <p className="text-amber-300/90 mb-2">
          {isIncoming ? "Wants" : "Want"}:{" "}
          {requestedProps.length ? requestedProps.map((p) => p.name).join(", ") : "—"}{" "}
          {trade.requested_amount > 0 && `+ $${trade.requested_amount}`}
        </p>
        {isIncoming ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => onTradeAction(trade.id, "accepted")}
              className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]"
            >
              Accept
            </button>
            <button
              onClick={() => onTradeAction(trade.id, "declined")}
              className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[10px]"
            >
              Decline
            </button>
            <button
              onClick={() => onTradeAction(trade.id, "counter")}
              className="flex-1 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold text-[10px]"
            >
              Counter
            </button>
          </div>
        ) : (
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
              trade.status === "accepted"
                ? "bg-emerald-900/50 text-emerald-300"
                : trade.status === "declined"
                ? "bg-red-900/50 text-red-300"
                : "bg-amber-900/50 text-amber-300"
            }`}
          >
            {trade.status?.toUpperCase() ?? "PENDING"}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <button
        onClick={toggleTrade}
        className="w-full flex items-center justify-between py-2 text-left group"
      >
        <span className="text-sm font-black text-amber-200 tracking-widest uppercase">
          Active Trades
          {totalActive > 0 && (
            <span className="ml-1.5 text-cyan-400 font-normal">({totalActive})</span>
          )}
        </span>
        <motion.span
          animate={{ rotate: showTrade ? 180 : 0 }}
          className="text-amber-400/80 group-hover:text-amber-300 transition"
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {showTrade && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden space-y-3"
          >
            {totalActive > 0 && (
              <div className="flex justify-end mb-1.5">
                <button
                  onClick={handleDeleteAll}
                  className="px-2 py-1 rounded text-[10px] font-bold bg-red-700/80 hover:bg-red-600 text-white"
                >
                  Delete All
                </button>
              </div>
            )}
            {tradeRequests.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-cyan-400/90 uppercase tracking-wider mb-1.5">Incoming</p>
                <div className="space-y-2">
                  {tradeRequests.map((t) => renderTrade(t, true))}
                </div>
              </div>
            )}
            {openTrades.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] font-bold text-cyan-400/90 uppercase tracking-wider">
                    Outgoing
                  </p>
                  <button
                    onClick={handleClearAllOutgoing}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-amber-700/80 hover:bg-amber-600 text-black"
                  >
                    Delete Outgoing
                  </button>
                </div>
                <div className="space-y-2">
                  {openTrades.map((t) => renderTrade(t, false))}
                </div>
              </div>
            )}
            {totalActive === 0 && (
              <EmptyState
                icon={<Handshake className="w-12 h-12 text-slate-500" />}
                title="No active trades"
                description="Click a player on the board and choose Trade to make an offer, or wait for others to send you requests."
                compact
                className="py-6 border-slate-700/50 bg-slate-900/30"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-app delete confirmation modal — stays inside fullscreen so it doesn't exit fullscreen */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm z-[2147483647]"
            onClick={() => setDeleteConfirm(null)}
            style={{ position: "fixed" }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-xl border border-cyan-500/40 bg-slate-900 p-5 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-cyan-200">
                  {deleteConfirm === "outgoing"
                    ? "Delete all outgoing?"
                    : "Delete all trades?"}
                </h3>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-300 mb-5">
                {deleteConfirm === "outgoing"
                  ? "Delete ALL your active trade offers? This cannot be undone."
                  : `Delete ALL ${tradeRequests.length + openTrades.length} trade(s)? This will decline and remove both incoming and outgoing trades. This cannot be undone.`}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
                >
                  Delete all
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
