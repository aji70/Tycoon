"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Agent {
  id: number;
  name: string;
  username: string;
  tier: string;
  tier_color: string;
  xp?: number;
  elo_rating?: number;
  arena_wins: number;
  arena_losses: number;
  arena_draws: number;
  is_public?: boolean;
  erc8004_agent_id?: string | null;
}

interface TournamentPerm {
  enabled: boolean;
  max_entry_fee_usdc: string;
  daily_cap_usdc: string | null;
}

interface MyAgentsTabProps {
  myAgents: Agent[];
  tournamentPerms: Record<number, TournamentPerm>;
  subTab: "overview" | "manage";
  onSubTabChange: (tab: "overview" | "manage") => void;
  onTogglePublic: (agentId: number, currentValue: boolean) => void;
  onOpenManageCaps: (agentId: number) => void;
  onRegisterOnCelo: (agent: Agent) => void;
  isRegisteringId?: number | null;
}

const TierColors: Record<string, string> = {
  gold: "#FFD700",
  cyan: "#00FFFF",
  purple: "#9370DB",
  yellow: "#FFFF00",
  silver: "#C0C0C0",
  brown: "#8B4513",
};

const ARENA_ELO_BASELINE = 1000;

function xpOf(elo: number | undefined) {
  const raw = Number(elo);
  return Number.isFinite(raw) ? Math.max(0, raw - ARENA_ELO_BASELINE) : 0;
}

export function ArenaMyAgentsTab({
  myAgents,
  tournamentPerms,
  subTab,
  onSubTabChange,
  onTogglePublic,
  onOpenManageCaps,
  onRegisterOnCelo,
  isRegisteringId,
}: MyAgentsTabProps) {
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const maxXp = 2000;

  return (
    <div className="space-y-6">
      {/* Sub-tab Switcher */}
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => onSubTabChange("overview")}
          className={`px-4 py-2 rounded-lg font-orbitron font-bold text-sm transition-all ${
            subTab === "overview"
              ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/40"
              : "bg-black/60 border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60"
          }`}
        >
          Quick View
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => onSubTabChange("manage")}
          className={`px-4 py-2 rounded-lg font-orbitron font-bold text-sm transition-all ${
            subTab === "manage"
              ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/40"
              : "bg-black/60 border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60"
          }`}
        >
          Manage & Spending
        </motion.button>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myAgents.map((agent, idx) => {
          const perm = tournamentPerms[agent.id];
          const isExpanded = expandedAgent === agent.id;

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-black/60 border-2 border-cyan-500/30 hover:border-cyan-400/60 rounded-lg overflow-hidden transition-all"
            >
              {/* Card Content */}
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-orbitron font-bold text-cyan-300">{agent.name}</h3>
                    <p className="text-cyan-400/70 text-xs">by {agent.username}</p>
                  </div>
                  <div
                    className="px-2 py-1 rounded-full text-xs font-orbitron font-bold"
                    style={{
                      backgroundColor: `${TierColors[agent.tier_color] || "#00FFFF"}33`,
                      color: TierColors[agent.tier_color] || "#00FFFF",
                      border: `1px solid ${TierColors[agent.tier_color] || "#00FFFF"}`,
                    }}
                  >
                    {agent.tier}
                  </div>
                </div>

                {/* XP Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-cyan-400/70">XP</span>
                    <span className="font-orbitron font-bold text-cyan-300">{xpOf(agent.elo_rating)}</span>
                  </div>
                  <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${(xpOf(agent.elo_rating) / maxXp) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="font-orbitron font-bold text-cyan-300">{agent.arena_wins}</div>
                    <div className="text-cyan-500/70">W</div>
                  </div>
                  <div>
                    <div className="font-orbitron font-bold text-cyan-300">{agent.arena_losses}</div>
                    <div className="text-cyan-500/70">L</div>
                  </div>
                  <div>
                    <div className="font-orbitron font-bold text-cyan-300">{agent.arena_draws}</div>
                    <div className="text-cyan-500/70">D</div>
                  </div>
                </div>

                {/* Quick Actions */}
                {subTab === "overview" && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => onTogglePublic(agent.id, agent.is_public ?? false)}
                    className="w-full py-2 rounded-lg font-orbitron font-bold text-xs border-2 transition-all"
                    style={{
                      backgroundColor: agent.is_public ? "rgba(0, 240, 255, 0.1)" : "rgba(100, 100, 100, 0.1)",
                      borderColor: agent.is_public ? "#00FFFF" : "#666666",
                      color: agent.is_public ? "#00FFFF" : "#999999",
                    }}
                  >
                    {agent.is_public ? "🔓 PUBLIC" : "🔒 PRIVATE"}
                  </motion.button>
                )}

                {/* Manage Panel */}
                {subTab === "manage" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 border-t border-cyan-500/20 pt-3"
                  >
                    {perm && perm.enabled && (
                      <div className="bg-cyan-900/30 border border-cyan-500/40 rounded p-2">
                        <p className="text-xs text-cyan-300 font-orbitron">
                          <strong>Max Entry:</strong> ${perm.max_entry_fee_usdc}
                        </p>
                        {perm.daily_cap_usdc && (
                          <p className="text-xs text-cyan-300 font-orbitron">
                            <strong>Daily Cap:</strong> ${perm.daily_cap_usdc}
                          </p>
                        )}
                      </div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => onOpenManageCaps(agent.id)}
                      className="w-full py-2 rounded-lg font-orbitron font-bold text-xs bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                    >
                      ⚙️ SET CAPS
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => onRegisterOnCelo(agent)}
                      disabled={isRegisteringId === agent.id}
                      className="w-full py-2 rounded-lg font-orbitron font-bold text-xs bg-amber-900/30 border-2 border-amber-500/40 text-amber-300 hover:border-amber-400/60 disabled:opacity-50 transition-all"
                    >
                      {isRegisteringId === agent.id ? "Registering..." : agent.erc8004_agent_id ? "Re-register on Celo" : "Register on Celo"}
                    </motion.button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create Agent Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-full py-4 rounded-lg font-orbitron font-bold text-lg bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border-2 border-dashed border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40 transition-all"
      >
        + CREATE ANOTHER AGENT
      </motion.button>
    </div>
  );
}
