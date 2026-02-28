"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Property } from "@/types/game";

interface TradeSection3DProps {
  showTrade: boolean;
  toggleTrade: () => void;
  openTrades: any[];
  tradeRequests: any[];
  properties: Property[];
  game: { players?: any[] };
  onTradeAction: (id: number, action: "accepted" | "declined" | "counter") => void;
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
            {tradeRequests.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-cyan-400/90 uppercase tracking-wider mb-1.5">
                  Incoming
                </p>
                <div className="space-y-2">
                  {tradeRequests.map((t) => renderTrade(t, true))}
                </div>
              </div>
            )}
            {openTrades.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-cyan-400/90 uppercase tracking-wider mb-1.5">
                  Outgoing
                </p>
                <div className="space-y-2">
                  {openTrades.map((t) => renderTrade(t, false))}
                </div>
              </div>
            )}
            {totalActive === 0 && (
              <div className="py-6 text-center">
                <p className="text-slate-500 text-sm">No active trades</p>
                <p className="text-slate-600 text-xs mt-1">Use Trade on a player to propose</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
