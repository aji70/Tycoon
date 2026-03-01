"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bell, Users, X, Building2, Handshake } from "lucide-react";

/** Skeletal UI only: notification bar + player modal (Players / My Empire / Trade) + perks modal. No game logic. */
export default function Mobile3DGameUI() {
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [playerModalTab, setPlayerModalTab] = useState<"players" | "empire" | "trade">("players");

  const incomingTradeCount = 0; // placeholder

  return (
    <>
      {/* Notification bar — fixed at bottom, above board */}
      <div
        className="fixed left-0 right-0 bottom-0 z-40 flex items-center justify-center gap-4 px-4 py-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-600/50 safe-area-pb"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setShowPerksModal(true)}
          className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-600/90 border border-violet-400/60 text-white hover:bg-violet-500 transition-colors"
          aria-label="Perks & collectibles"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setPlayerModalTab("trade");
            setShowPlayerModal(true);
          }}
          className="relative w-12 h-12 rounded-xl flex items-center justify-center border border-violet-500/50 bg-gradient-to-br from-violet-800/95 to-fuchsia-800/95 text-violet-200 hover:border-violet-400/60 transition-colors"
          aria-label="Trade"
        >
          <Bell className="w-5 h-5" />
          {incomingTradeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">
              {incomingTradeCount > 99 ? "99+" : incomingTradeCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setPlayerModalTab("players");
            setShowPlayerModal(true);
          }}
          className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-600/90 border border-amber-400/60 text-white hover:bg-amber-500 transition-colors"
          aria-label="Players"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      {/* Player modal — bottom sheet: Players | My Empire | Trade (skeletal) */}
      <AnimatePresence>
        {showPlayerModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPlayerModal(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t-2 border-amber-500/40 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col max-h-[85dvh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600/50 shrink-0">
                <h2 className="text-lg font-bold text-amber-200">Game</h2>
                <button
                  type="button"
                  onClick={() => setShowPlayerModal(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-600/50 shrink-0">
                {(
                  [
                    { id: "players" as const, label: "Players", icon: Users },
                    { id: "empire" as const, label: "My Empire", icon: Building2 },
                    { id: "trade" as const, label: "Trade", icon: Handshake },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlayerModalTab(id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                      playerModalTab === id
                        ? "text-amber-400 border-b-2 border-amber-400 bg-amber-500/10"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {playerModalTab === "players" && (
                  <div className="space-y-2">
                    <p className="text-slate-500 text-sm">Players list (placeholder)</p>
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-slate-600/50 bg-slate-800/60"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-700" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-200 truncate">Player {i}</p>
                          <p className="text-xs text-slate-400">$0 · —</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {playerModalTab === "empire" && (
                  <div>
                    <p className="text-slate-500 text-sm">My Empire (placeholder)</p>
                    <p className="text-slate-600 text-xs mt-1">Your properties will appear here.</p>
                  </div>
                )}
                {playerModalTab === "trade" && (
                  <div>
                    <p className="text-slate-500 text-sm">Trade (placeholder)</p>
                    <p className="text-slate-600 text-xs mt-1">Incoming and active trades will appear here.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Perks modal — placeholder */}
      <AnimatePresence>
        {showPerksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t-2 border-violet-500/40 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col max-h-[85dvh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600/50">
                <h2 className="text-lg font-bold text-violet-200 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Perks & collectibles
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPerksModal(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-slate-500 text-sm">Perks content (placeholder)</p>
                <p className="text-slate-600 text-xs mt-1">Collectibles and perks will appear here when in a game.</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
