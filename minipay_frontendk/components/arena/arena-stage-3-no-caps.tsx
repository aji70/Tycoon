"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";

interface Stage3Props {
  myAgents: any[];
  onTabChange: (tab: string) => void;
  onOpenManageCaps: (agentId: number) => void;
}

export function ArenaStage3NoCaps({ myAgents, onTabChange, onOpenManageCaps }: Stage3Props) {
  const TierColors: Record<string, string> = {
    gold: "#FFD700",
    cyan: "#00FFFF",
    purple: "#9370DB",
    yellow: "#FFFF00",
    silver: "#C0C0C0",
    brown: "#8B4513",
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border-2 border-amber-500/60 rounded-lg p-4 flex items-start gap-3"
      >
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-2xl"
        >
          ⚠️
        </motion.span>
        <div>
          <p className="font-orbitron font-bold text-amber-300">SET SPENDING CAPS TO UNLOCK CHALLENGES & TOURNAMENTS</p>
          <p className="text-amber-300/70 text-sm mt-1">Protect your wallet by setting entry fee limits and daily spending caps per agent.</p>
        </div>
      </motion.div>

      {/* Agent Cards with Cap Warning */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myAgents.map((agent) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 border-2 border-cyan-500/30 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-orbitron font-bold text-cyan-300">{agent.name}</h3>
                <p className="text-cyan-400/70 text-xs">by {agent.username}</p>
              </div>
              <div
                className="px-2 py-1 rounded-full text-xs font-orbitron font-bold"
                style={{
                  backgroundColor: `${TierColors[agent.tier_color] || '#00FFFF'}33`,
                  color: TierColors[agent.tier_color] || '#00FFFF',
                  border: `1px solid ${TierColors[agent.tier_color] || '#00FFFF'}`,
                }}
              >
                {agent.tier || 'Unknown'}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onOpenManageCaps(agent.id)}
              animate={{ scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-full py-2 rounded-lg font-orbitron font-bold text-sm bg-amber-900/40 border-2 border-amber-500/60 text-amber-300 hover:bg-amber-900/60 transition-all"
            >
              ⚠️ SET CAPS →
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Tab Navigation with Lock Icons */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "discover", label: "Discover", icon: "🔍", locked: false },
          { id: "challenges", label: "Challenges", icon: "⚡", locked: true },
          { id: "leaderboard", label: "Leaderboard", icon: "🏆", locked: false },
          { id: "tournaments", label: "Tournaments", icon: "🎯", locked: true },
          { id: "my-agents", label: "My Agents", icon: "🤖", locked: false },
        ].map((tab) => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.05 }}
            onClick={() => !tab.locked && onTabChange(tab.id)}
            disabled={tab.locked}
            className={`px-4 py-2 rounded-lg font-orbitron font-bold text-sm flex items-center gap-2 transition-all ${
              tab.locked
                ? "bg-slate-800/40 border-2 border-slate-600/30 text-slate-500 cursor-not-allowed"
                : "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40"
            }`}
            title={tab.locked ? "Set spending caps to unlock" : undefined}
          >
            {tab.locked && <Lock className="w-3 h-3" />}
            {tab.icon} {tab.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
