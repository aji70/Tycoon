"use client";

import React from "react";
import { FaRobot, FaCoins } from "react-icons/fa6";
import { Clock, ShieldCheck } from "lucide-react";
import { RiAuctionFill } from "react-icons/ri";
import { GiPrisoner, GiBank } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GamePieces } from "@/lib/constants/games";
import { useAIGameCreate } from "@/hooks/useAIGameCreate";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { BattleHeader } from "./BattleHeader";
import { LoadoutCard } from "./LoadoutCard";
import { DifficultySelector } from "./DifficultySelector";
import { HouseRulesPanel } from "./HouseRulesPanel";
import { LaunchButton } from "./LaunchButton";
import { ScanlineOverlay } from "@/components/hero/ScanlineOverlay";
import { BoardVariantPicker } from "@/components/game-setup/BoardVariantPicker";

const PIECE_EMOJI: Record<string, string> = {
  hat: "🎩",
  car: "🚗",
  dog: "🐕",
  thimble: "🔧",
  wheelbarrow: "🛒",
  battleship: "🚢",
  boot: "👢",
  iron: "♨️",
  top_hat: "🎩",
};

export default function BattleSetupOptimized() {
  const router = useRouter();
  const playGuard = usePreventDoubleSubmit();

  const {
    settings,
    setSettings,
    handlePlay,
    canCreate,
    isCreatePending,
    isGuest,
    isRegisteredLoading,
    registeredAgents,
    registrySupported,
  } = useAIGameCreate({ redirectTo3D: true });

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-[#0E282A] to-slate-950">
        <p className="text-cyan-400 text-2xl font-medium animate-pulse">
          Initializing Battle System...
        </p>
      </div>
    );
  }

  const houseRules = [
    { icon: RiAuctionFill, label: "Auction Unsold", key: "auction", desc: "Automatic property auctions" },
    { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison", desc: "Pay rent while imprisoned" },
    { icon: GiBank, label: "Allow Mortgages", key: "mortgage", desc: "Mortgage property for cash" },
    { icon: IoBuild, label: "Even Building", key: "evenBuild", desc: "Balanced house distribution" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 relative overflow-x-hidden flex flex-col pb-10">
      {/* Scanline overlay */}
      <ScanlineOverlay />

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-start justify-center p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto">
          {/* Header */}
          <BattleHeader onBack={() => router.push("/")} />

          {/* Full-width so mobile users see board theme without scrolling past both columns */}
          <div className="mb-6 md:mb-8 w-full">
            <BoardVariantPicker
              value={settings.boardVariantId}
              onChange={(id) => setSettings((p) => ({ ...p, boardVariantId: id }))}
              className="rounded-xl border border-cyan-500/30 bg-slate-800/50 px-4 py-4"
            />
          </div>

          {/* Desktop: Two-column layout | Mobile: Single column vertical */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            {/* LEFT COLUMN */}
            <div className="space-y-4 md:space-y-6">
              {/* Select Piece - Compact 2-row grid on desktop, horizontal scroll on mobile */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Select Piece</p>
                {/* Mobile: Horizontal scroll */}
                <div className="md:hidden overflow-x-auto pb-2">
                  <div className="flex gap-2 min-w-min">
                    {GamePieces.map((piece, idx) => (
                      <motion.button
                        key={piece.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        onClick={() => setSettings((p) => ({ ...p, symbol: piece.id }))}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`relative p-2 rounded-lg transition-all duration-300 border-2 flex-shrink-0 w-24 h-28 flex flex-col items-center justify-center ${
                          settings.symbol === piece.id
                            ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                            : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
                        }`}
                      >
                        <div className="text-xl mb-1">{PIECE_EMOJI[piece.id]}</div>
                        <div className="text-[10px] font-orbitron text-cyan-300 font-bold text-center line-clamp-2 px-0.5 leading-tight">
                          {piece.name}
                        </div>
                        {settings.symbol === piece.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/60"
                          >
                            ✓
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Desktop: 2-row compact grid */}
                <div className="hidden md:grid grid-cols-5 gap-2">
                  {GamePieces.map((piece, idx) => (
                    <motion.button
                      key={piece.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      onClick={() => setSettings((p) => ({ ...p, symbol: piece.id }))}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative p-2 rounded-lg transition-all duration-300 border-2 flex flex-col items-center justify-center py-3 ${
                        settings.symbol === piece.id
                          ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                          : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
                      }`}
                    >
                      <div className="text-2xl mb-1">{PIECE_EMOJI[piece.id]}</div>
                      <div className="text-xs font-orbitron text-cyan-300 font-bold text-center truncate px-1">
                        {piece.name}
                      </div>
                      {settings.symbol === piece.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/60"
                        >
                          ✓
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Enemy Formation */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Enemy Formation</p>

                {/* Number buttons row */}
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSettings((p) => ({ ...p, aiCount: num }))}
                      className={`py-2 md:py-2 rounded-lg font-orbitron font-bold text-sm transition-all duration-300 border-2 ${
                        settings.aiCount === num
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/40"
                          : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                      }`}
                    >
                      {num}
                    </motion.button>
                  ))}
                </div>

                {/* Avatar slots - Desktop only */}
                <div className="hidden md:grid grid-cols-6 gap-2 mt-3">
                  {[...Array(6)].map((_, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: idx < settings.aiCount ? 1 : 0.3, scale: 1 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${
                        idx < settings.aiCount
                          ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/30"
                          : "border-cyan-500/20 bg-slate-800/20"
                      }`}
                    >
                      <div className="text-lg">🤖</div>
                    </motion.div>
                  ))}
                </div>

                {/* Agent info */}
                {registrySupported && registeredAgents.length > 0 && (
                  <p className="text-xs text-cyan-300/70 flex items-center gap-1 mt-2">
                    <ShieldCheck className="w-3 h-3" />
                    {registeredAgents.length} verified agents
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4 md:space-y-6">
              {/* Battle Difficulty */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Battle Difficulty</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "easy", label: "EASY", icon: "🟢" },
                    { id: "hard", label: "HARD", icon: "🟡" },
                    { id: "boss", label: "BOSS", icon: "💀" },
                  ].map((diff, idx) => (
                    <motion.button
                      key={diff.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.1 }}
                      onClick={() => setSettings((p) => ({ ...p, aiDifficulty: diff.id as any }))}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative p-2 rounded-lg transition-all duration-300 border-2 font-orbitron text-center py-3 ${
                        settings.aiDifficulty === diff.id
                          ? diff.id === "boss"
                            ? "border-red-500 bg-red-600/30 shadow-lg shadow-red-600/60"
                            : "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                          : diff.id === "boss"
                          ? "border-red-600/50 bg-red-900/20 hover:border-red-500/70"
                          : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
                      }`}
                    >
                      <div className="text-xl mb-1">{diff.icon}</div>
                      <div className="text-xs font-bold text-white">{diff.label}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Starting Capital */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Starting Capital</p>
                <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
                  {[500, 1000, 1500, 2000].map((amount) => (
                    <motion.button
                      key={amount}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSettings((p) => ({ ...p, startingCash: amount }))}
                      className={`py-2 px-2 rounded-lg font-orbitron text-xs font-bold transition-all border-2 ${
                        settings.startingCash === amount
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                          : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                      }`}
                    >
                      ${amount}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Match Duration */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Match Duration</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 30, label: "30m" },
                    { value: 45, label: "45m" },
                    { value: 60, label: "60m" },
                    { value: 90, label: "90m" },
                    { value: 0, label: "∞" },
                  ].map((duration) => (
                    <motion.button
                      key={duration.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSettings((p) => ({ ...p, duration: duration.value }))}
                      className={`py-2 px-3 rounded-full font-orbitron text-xs font-bold transition-all border-2 ${
                        settings.duration === duration.value
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                          : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                      }`}
                    >
                      {duration.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* House Rules - Compact 2-column grid */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">House Rules</p>
                <div className="grid grid-cols-2 gap-2">
                  {houseRules.map((rule, idx) => {
                    const isActive = settings[rule.key as keyof typeof settings];
                    return (
                      <motion.div
                        key={rule.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all gap-2 ${
                          isActive
                            ? "border-cyan-500/60 bg-cyan-500/15"
                            : "border-cyan-500/20 bg-slate-800/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-center">
                          <span className="text-lg text-cyan-400 flex-shrink-0">{rule.icon}</span>
                          <span className="text-xs font-orbitron font-bold text-white uppercase">
                            {rule.label}
                          </span>
                        </div>

                        <motion.button
                          onClick={() =>
                            setSettings((p) => ({ ...p, [rule.key]: !(p[rule.key as keyof typeof p] as boolean) }))
                          }
                          className={`relative w-10 h-5 rounded-full transition-all duration-300 border-2 ${
                            isActive
                              ? "border-cyan-500 bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-lg shadow-cyan-500/40"
                              : "border-cyan-500/30 bg-slate-700/60"
                          }`}
                        >
                          <motion.div
                            animate={{ x: isActive ? 20 : 2 }}
                            transition={{ type: "spring", stiffness: 600, damping: 25 }}
                            className={`absolute top-0.5 w-4 h-4 rounded-full transition-colors ${
                              isActive ? "bg-white shadow-lg shadow-cyan-400/50" : "bg-slate-500"
                            }`}
                          />
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* LAUNCH BUTTON - Full width */}
          <div className="flex justify-center mt-8">
            <LaunchButton
              onClick={() => playGuard.submit(() => handlePlay())}
              disabled={!canCreate || playGuard.isSubmitting || (!isGuest && isCreatePending)}
              loading={playGuard.isSubmitting || (!isGuest && isCreatePending)}
              children="LAUNCH BATTLE"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
