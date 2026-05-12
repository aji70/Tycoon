"use client";

import { motion } from "framer-motion";
import { Search, Zap, Trophy, Target, UserRound } from "lucide-react";

interface ArenaTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasSpendingCaps: boolean;
}

const tabs = [
  { id: "discover", label: "Discover", icon: Search, locked: false },
  { id: "challenges", label: "Challenges", icon: Zap, locked: false },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy, locked: false },
  { id: "tournaments", label: "Tournaments", icon: Target, locked: false },
  { id: "my-agents", label: "My Agents", icon: UserRound, locked: false },
];

export function ArenaTabBar({ activeTab, onTabChange, hasSpendingCaps }: ArenaTabBarProps) {
  return (
    <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isLocked = (tab.id === "challenges" || tab.id === "tournaments") && !hasSpendingCaps;

        return (
          <motion.button
            key={tab.id}
            whileHover={{ scale: isLocked ? 1 : 1.05 }}
            whileTap={{ scale: isLocked ? 1 : 0.95 }}
            onClick={() => !isLocked && onTabChange(tab.id)}
            disabled={isLocked}
            className={`relative px-4 py-2 rounded-full font-orbitron font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              isActive
                ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/50"
                : isLocked
                ? "bg-slate-800/40 border-2 border-slate-600/30 text-slate-500 cursor-not-allowed"
                : "bg-black/60 border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60"
            }`}
            title={isLocked ? "Set spending caps to unlock" : undefined}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
            {isLocked && <span className="text-xs ml-1">🔒</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
