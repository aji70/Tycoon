"use client";

import React from "react";
import { FaUser, FaRobot, FaBrain, FaCoins } from "react-icons/fa6";
import { House } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/game-switch";
import { RiAuctionFill } from "react-icons/ri";
import { GiPrisoner, GiBank } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { useRouter } from "next/navigation";
import { GamePieces } from "@/lib/constants/games";
import { BoardVariantPicker } from "@/components/game-setup/BoardVariantPicker";
import { ShieldCheck } from "lucide-react";
import { useAIGameCreate } from "@/hooks/useAIGameCreate";
import { motion } from "framer-motion";
import { ParticleBackground } from "@/components/hero/ParticleBackground";
import { ScanlineOverlay } from "@/components/hero/ScanlineOverlay";

export interface PlayWithAIProps {
  /** When true, after creating a game redirect to 3D board (ai-play-3d). */
  redirectTo3D?: boolean;
  /** Visual theme: "3d" applies gamified 3D board styling. */
  theme?: "default" | "3d";
}

export default function PlayWithAI({ redirectTo3D = false, theme = "default" }: PlayWithAIProps = {}) {
  const router = useRouter();
  const {
    settings,
    setSettings,
    handlePlay,
    canCreate,
    isCreatePending,
    isGuest,
    isRegisteredLoading,
    registeredAgents,
    agentsLoading,
    registrySupported,
  } = useAIGameCreate({ redirectTo3D });

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-4xl font-orbitron animate-pulse tracking-wider">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  const is3D = theme === "3d";
  const wrapperClass = is3D
    ? "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/30 flex items-center justify-center p-6 relative"
    : "min-h-screen bg-gradient-to-br from-[#010F10] via-[#0a1f20] to-[#010F10] flex items-center justify-center p-6 relative overflow-hidden";
  const cardClass = is3D
    ? "w-full max-w-5xl bg-slate-900/95 backdrop-blur-xl rounded-2xl border-2 border-amber-500/40 shadow-2xl shadow-amber-900/20 p-8 md:p-12"
    : "w-full max-w-5xl bg-black/85 backdrop-blur-3xl rounded-3xl border-2 border-cyan-500/30 shadow-2xl shadow-cyan-900/20 p-8 md:p-12 relative z-10";
  const titleClass = is3D
    ? "text-5xl font-orbitron font-extrabold bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg"
    : "text-5xl font-orbitron font-extrabold bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] bg-clip-text text-transparent drop-shadow-lg";
  const backClass = is3D
    ? "flex items-center gap-3 text-amber-400 hover:text-amber-300 transition group"
    : "flex items-center gap-3 text-[#00F0FF] hover:text-[#0FF0FC] transition group";

  return (
    <div className={wrapperClass}>
      {!is3D && <ParticleBackground />}
      {!is3D && <ScanlineOverlay />}
      <div className={cardClass}>
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <button
            onClick={() => router.push("/")}
            className={backClass}
          >
            <House className="w-6 h-6 group-hover:-translate-x-1 transition" />
            <span className="font-bold text-lg">BACK</span>
          </button>
          <h1 className={titleClass}>
            {is3D ? "AI DUEL · 3D" : "AI DUEL"}
          </h1>
          <div className="w-24 flex justify-end">
            <a
              href="/agents"
              className={is3D ? "text-amber-400 hover:text-amber-300 text-sm font-medium" : "text-cyan-400 hover:text-cyan-300 text-sm font-medium"}
            >
              Manage agents
            </a>
          </div>
        </div>

        {/* Main Grid - Desktop layout */}
        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          {/* Column 1 */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-gradient-to-br from-cyan-900/50 to-blue-900/40 rounded-2xl p-6 border-2 border-cyan-500/50 backdrop-blur-sm hover:border-cyan-400/70 transition-all">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-14 bg-black/60 border-cyan-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-4">
                <BoardVariantPicker
                  value={settings.boardVariantId}
                  onChange={(id) => setSettings((p) => ({ ...p, boardVariantId: id }))}
                />
              </div>
            </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="bg-gradient-to-br from-purple-900/50 to-pink-900/40 rounded-2xl p-6 border-2 border-purple-500/50 backdrop-blur-sm hover:border-purple-400/70 transition-all">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <FaRobot className="w-7 h-7 text-purple-400" />
                <h3 className="text-xl font-bold text-purple-300">AI Opponents</h3>
              </div>
              <Select
                value={settings.aiCount.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiCount: +v }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-purple-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n} AI</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registrySupported && registeredAgents.length > 0 && (
                <p className="mt-2 text-xs text-purple-300/80 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {registeredAgents.length} verified on-chain
                </p>
              )}
            </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-br from-red-900/50 to-orange-900/40 rounded-2xl p-6 border-2 border-red-500/50 backdrop-blur-sm hover:border-red-400/70 transition-all">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-red-400" />
                <h3 className="text-xl font-bold text-red-300">AI Difficulty</h3>
              </div>
              <Select
                value={settings.aiDifficulty}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiDifficulty: v as any }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-red-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="boss" className="text-pink-400 font-bold">BOSS MODE</SelectItem>
                </SelectContent>
              </Select>
              {settings.aiCount > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-red-200/90">Difficulty per opponent</span>
                  <Switch
                    checked={settings.aiDifficultyMode === "random"}
                    onCheckedChange={(v) => setSettings((p) => ({ ...p, aiDifficultyMode: v ? "random" : "same" }))}
                  />
                  <span className="text-sm text-red-200/90">
                    {settings.aiDifficultyMode === "random" ? "Randomize" : "Same"}
                  </span>
                </div>
              )}
            </div>
            </motion.div>
          </div>

          {/* Column 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="bg-gradient-to-br from-amber-900/50 to-orange-900/40 rounded-2xl p-6 border-2 border-amber-500/50 backdrop-blur-sm hover:border-amber-400/70 transition-all">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <FaCoins className="w-7 h-7 text-amber-400" />
              <h3 className="text-xl font-bold text-amber-300">Starting Cash</h3>
            </div>
            <Select
              value={settings.startingCash.toString()}
              onValueChange={(v) => setSettings((p) => ({ ...p, startingCash: +v }))}
            >
              <SelectTrigger className="h-14 bg-black/60 border-amber-500/40 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">$500</SelectItem>
                <SelectItem value="1000">$1,000</SelectItem>
                <SelectItem value="1500">$1,500</SelectItem>
                <SelectItem value="2000">$2,000</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-indigo-400" />
                <h3 className="text-xl font-bold text-indigo-300">Game Duration</h3>
              </div>
              <Select
                value={settings.duration.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, duration: +v }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-indigo-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="0">No limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </motion.div>

          {/* Column 3 */}
          <div className="space-y-6">
            {registrySupported && registeredAgents.length > 0 && !agentsLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-gradient-to-br from-emerald-900/50 to-teal-900/40 rounded-2xl p-6 border-2 border-emerald-500/50 backdrop-blur-sm hover:border-emerald-400/70 transition-all">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-bold text-emerald-300">Registered AI Agents</h3>
                </div>
                <ul className="space-y-2 max-h-32 overflow-y-auto">
                  {registeredAgents.map((a) => (
                    <li key={a.tokenId} className="text-sm text-gray-300 flex justify-between items-center gap-2">
                      <span className="font-medium text-white truncate">{a.name}</span>
                      <span className="text-emerald-400/90 shrink-0">{a.playStyle}</span>
                    </li>
                  ))}
                </ul>
              </div>
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="bg-gradient-to-br from-black/70 to-cyan-900/30 rounded-2xl p-6 border-2 border-cyan-500/50 backdrop-blur-sm hover:border-cyan-400/70 transition-all h-full">
            <div>
              <h3 className="text-xl font-bold text-cyan-400 mb-5 text-center">House Rules</h3>
              <div className="space-y-4">
                {[
                  { icon: RiAuctionFill, label: "Auction Unsold Properties", key: "auction" },
                  { icon: GiPrisoner, label: "Pay Rent in Jail", key: "rentInPrison" },
                  { icon: GiBank, label: "Allow Mortgages", key: "mortgage" },
                  { icon: IoBuild, label: "Even Building Rule", key: "evenBuild" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-cyan-400" />
                      <span className="text-gray-300 text-sm">{item.label}</span>
                    </div>
                    <Switch
                      checked={settings[item.key as keyof typeof settings] as boolean}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex justify-center mt-12">
          <button
            onClick={handlePlay}
            disabled={!canCreate || (!isGuest && isCreatePending)}
            className={
              is3D
                ? "relative px-24 py-6 text-3xl font-orbitron font-black tracking-widest rounded-2xl shadow-2xl shadow-amber-900/50 transform hover:scale-105 active:scale-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-amber-400/60 bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900"
                : "relative px-24 py-6 text-3xl font-orbitron font-black tracking-widest bg-gradient-to-br from-[#00F0FF] to-[#0FF0FC] hover:from-[#0FF0FC] hover:to-[#00F0FF] text-[#010F10] rounded-2xl shadow-2xl shadow-cyan-500/40 transform hover:scale-105 active:scale-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-3 border-[#00F0FF]/60"
            }
          >
            <span className="relative z-10 drop-shadow-lg">
              {isCreatePending ? "SUMMONING..." : is3D ? "LAUNCH 3D BATTLE" : "START BATTLE"}
            </span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
