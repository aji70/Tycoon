"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useState } from "react";

interface Agent {
  id: number;
  name: string;
  username: string;
  elo_rating?: number;
  xp?: number;
  tier: string;
  tier_color: string;
  erc8004_agent_id?: string | null;
  total_games: number;
  arena_wins: number;
  arena_losses: number;
}

interface DiscoverTabProps {
  agents: Agent[];
  myAgents: Agent[];
  selectedOpponents: number[];
  onToggleSelect: (agentId: number) => void;
  onStartMatch: () => void;
  challengerAgentId: number | null;
  onChangeChallengerAgent: (agentId: number) => void;
  stakeAmount: string;
  onStakeChange: (amount: string) => void;
  isStarting: boolean;
  page: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  hasNextPage: boolean;
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

function xpOf(a: Agent) {
  const raw = Number(a.elo_rating);
  return Number.isFinite(raw) ? Math.max(0, raw - ARENA_ELO_BASELINE) : 0;
}

export function ArenaDiscoverTab({
  agents,
  myAgents,
  selectedOpponents,
  onToggleSelect,
  onStartMatch,
  challengerAgentId,
  onChangeChallengerAgent,
  stakeAmount,
  onStakeChange,
  isStarting,
  page,
  onPreviousPage,
  onNextPage,
  hasNextPage,
}: DiscoverTabProps) {
  const [showHint, setShowHint] = useState(true);
  const discoverList = agents.filter((agent) => !myAgents.some((m) => m.id === agent.id));
  const maxXp = 2000;

  return (
    <div className="space-y-6">
      {/* Onboarding Hint */}
      {showHint && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-cyan-900/30 border-2 border-cyan-500/60 rounded-lg p-4 flex items-start gap-3"
        >
          <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-orbitron text-cyan-300 text-sm">
              <strong>1. Pick up to 7 agents</strong> · <strong>2. Choose your agent</strong> · <strong>3. Hit Start</strong>
            </p>
          </div>
          <button
            onClick={() => setShowHint(false)}
            className="text-cyan-400/70 hover:text-cyan-300 transition-colors text-sm"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* Challenge Setup Panel */}
      {myAgents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/60 border-2 border-cyan-500/40 rounded-lg p-6 space-y-4 sticky top-0 z-30"
        >
          <div>
            <h3 className="font-orbitron text-cyan-300 font-bold mb-3">Challenge Setup</h3>

            {/* Slot Indicators */}
            <div className="flex gap-2 mb-4">
              {[...Array(7)].map((_, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-xs font-orbitron font-bold transition-all ${
                    idx < selectedOpponents.length
                      ? "border-cyan-400 bg-cyan-500/30 text-cyan-300 shadow-lg shadow-cyan-500/40"
                      : "border-cyan-500/20 bg-black/40 text-cyan-500/40"
                  }`}
                >
                  {idx < selectedOpponents.length ? "✓" : idx + 1}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Playing As */}
            <div>
              <label className="block font-orbitron text-cyan-300 text-xs mb-2 uppercase">Playing As</label>
              <select
                value={challengerAgentId ?? ""}
                onChange={(e) => onChangeChallengerAgent(Number(e.target.value))}
                className="w-full bg-black/60 border-2 border-cyan-500/40 rounded-lg p-2 font-orbitron text-cyan-300 focus:outline-none focus:border-cyan-400"
              >
                {myAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.tier})
                  </option>
                ))}
              </select>
            </div>

            {/* Stake */}
            <div>
              <label className="block font-orbitron text-cyan-300 text-xs mb-2 uppercase">USDC Stake (Optional)</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => onStakeChange(e.target.value)}
                placeholder="0"
                className="w-full bg-black/60 border-2 border-cyan-500/40 rounded-lg p-2 font-orbitron text-cyan-300 placeholder-cyan-500/30 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Launch Button */}
            <div className="flex items-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStartMatch}
                disabled={isStarting || selectedOpponents.length === 0}
                className="w-full px-4 py-2 rounded-lg font-orbitron font-bold bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                ⚡ LAUNCH{selectedOpponents.length > 0 ? ` (${selectedOpponents.length + 1})` : ""}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discoverList.map((agent, idx) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-black/60 border-2 border-cyan-500/30 hover:border-cyan-400/60 rounded-lg p-4 space-y-3 transition-all"
          >
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

            {/* Stats */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-cyan-400/70">XP</span>
                <span className="font-orbitron font-bold text-cyan-300">{xpOf(agent)}</span>
              </div>
              <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${(xpOf(agent) / maxXp) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex gap-2 text-center">
                <div className="flex-1">
                  <div className="text-cyan-300 font-bold">{agent.arena_wins}</div>
                  <div className="text-cyan-500/70">W</div>
                </div>
                <div className="flex-1">
                  <div className="text-cyan-300 font-bold">{agent.arena_losses}</div>
                  <div className="text-cyan-500/70">L</div>
                </div>
                <div className="flex-1">
                  <div className="text-cyan-300 font-bold">{agent.erc8004_agent_id ? "✓" : "—"}</div>
                  <div className="text-cyan-500/70 text-[10px]">8004</div>
                </div>
              </div>
            </div>

            {/* Select Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggleSelect(agent.id)}
              className={`w-full py-2 rounded-lg font-orbitron font-bold text-sm transition-all border-2 ${
                selectedOpponents.includes(agent.id)
                  ? "border-cyan-400 bg-cyan-500/30 text-cyan-200 shadow-lg shadow-cyan-500/40"
                  : "border-cyan-500/30 bg-black/40 text-cyan-400 hover:border-cyan-400/60"
              }`}
            >
              {selectedOpponents.includes(agent.id) ? "✓ PICKED" : "SELECT"}
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={onPreviousPage}
          disabled={page === 1}
          className="p-2 rounded-lg border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>
        <span className="font-orbitron text-cyan-300">Page {page}</span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="p-2 rounded-lg border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
