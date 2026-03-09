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
import { ShieldCheck } from "lucide-react";
import { useAIGameCreate } from "@/hooks/useAIGameCreate";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";

/** AI game settings: same functionality as game-ai but redirects to ai-play-3d with theme colors. */
export default function PlayWithAI3D() {
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
    agentsLoading,
    registrySupported,
  } = useAIGameCreate({ redirectTo3D: true });

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-[#0E282A] to-slate-950">
        <p className="text-cyan-400 text-2xl font-medium animate-pulse">
          Getting ready...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-lg p-8 md:p-12">
        <div className="flex justify-between items-center mb-12">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-cyan-400 hover:text-cyan-300 transition group"
          >
            <House className="w-6 h-6 group-hover:-translate-x-1 transition" />
            <span className="font-bold text-lg">Back</span>
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent">
            Play vs AI
          </h1>
          <div className="w-24 flex justify-end">
            <a href="/agents" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">
              Manage agents
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-2xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-14 bg-slate-800/80 border-cyan-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaRobot className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">AI Opponents</h3>
              </div>
              <Select
                value={settings.aiCount.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiCount: +v }))}
              >
                <SelectTrigger className="h-14 bg-slate-800/80 border-cyan-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n} AI</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registrySupported && registeredAgents.length > 0 && (
                <p className="mt-2 text-xs text-cyan-300/80 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {registeredAgents.length} verified on-chain
                </p>
              )}
            </div>

            <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-2xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">AI Difficulty</h3>
              </div>
              <Select
                value={settings.aiDifficulty}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiDifficulty: v as any }))}
              >
                <SelectTrigger className="h-14 bg-slate-800/80 border-cyan-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="boss" className="text-cyan-400 font-bold">BOSS MODE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-900/40 to-cyan-900/40 rounded-2xl p-6 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaCoins className="w-7 h-7 text-cyan-400" />
              <h3 className="text-xl font-bold text-cyan-300">Starting Cash</h3>
            </div>
            <Select
              value={settings.startingCash.toString()}
              onValueChange={(v) => setSettings((p) => ({ ...p, startingCash: +v }))}
            >
              <SelectTrigger className="h-14 bg-slate-800/80 border-cyan-500/40 text-white">
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
                <FaBrain className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">Game Duration</h3>
              </div>
              <Select
                value={settings.duration.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, duration: +v }))}
              >
                <SelectTrigger className="h-14 bg-slate-800/80 border-cyan-500/40 text-white">
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

          <div className="space-y-6">
            {registrySupported && registeredAgents.length > 0 && !agentsLoading && (
              <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 rounded-2xl p-6 border border-cyan-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="w-6 h-6 text-cyan-400" />
                  <h3 className="text-lg font-bold text-cyan-300">Registered AI Agents</h3>
                </div>
                <ul className="space-y-2 max-h-32 overflow-y-auto">
                  {registeredAgents.map((a) => (
                    <li key={a.tokenId} className="text-sm text-slate-300 flex justify-between items-center gap-2">
                      <span className="font-medium text-white truncate">{a.name}</span>
                      <span className="text-cyan-400/90 shrink-0">{a.playStyle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="bg-slate-800/60 rounded-2xl p-6 border border-cyan-500/30 h-full">
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
                      <span className="text-slate-300 text-sm">{item.label}</span>
                    </div>
                    <Switch
                      checked={settings[item.key as keyof typeof settings] as boolean}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-12">
          <button
            onClick={() => playGuard.submit(() => handlePlay())}
            disabled={!canCreate || playGuard.isSubmitting || (!isGuest && isCreatePending)}
            className="px-20 py-5 text-2xl font-bold rounded-2xl shadow-md hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-400/50 bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-900"
          >
            {playGuard.isSubmitting || (!isGuest && isCreatePending) ? "Getting ready..." : "Let's Play!"}
          </button>
        </div>
      </div>
    </div>
  );
}
