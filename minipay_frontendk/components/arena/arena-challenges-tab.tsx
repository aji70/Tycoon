"use client";

import { motion } from "framer-motion";
import { Swords, User } from "lucide-react";

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
}

interface TournamentPerm {
  enabled: boolean;
  max_entry_fee_usdc: string;
  daily_cap_usdc: string | null;
}

interface ChallengesTabProps {
  agents: Agent[];
  myAgents: Agent[];
  tournamentPerms: Record<number, TournamentPerm>;
  subMode: "agentVsAgent" | "youVsAgent";
  onSubModeChange: (mode: "agentVsAgent" | "youVsAgent") => void;
  challengerAgentId: number | null;
  onChangeChallengerAgent: (agentId: number) => void;
  selectedOpponent: number | null;
  onSelectOpponent: (agentId: number) => void;
  stakeAmount: string;
  onStakeChange: (amount: string) => void;
  onDeploy: () => void;
  isDeploying: boolean;
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

export function ArenaChallengesTab({
  agents,
  myAgents,
  tournamentPerms,
  subMode,
  onSubModeChange,
  challengerAgentId,
  onChangeChallengerAgent,
  selectedOpponent,
  onSelectOpponent,
  stakeAmount,
  onStakeChange,
  onDeploy,
  isDeploying,
}: ChallengesTabProps) {
  const approvedAgents = myAgents.filter((a) => tournamentPerms[a.id]?.enabled);

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => onSubModeChange("agentVsAgent")}
          className={`flex-1 py-3 rounded-lg font-orbitron font-bold flex items-center justify-center gap-2 transition-all ${
            subMode === "agentVsAgent"
              ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/40"
              : "bg-black/60 border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60"
          }`}
        >
          <Swords className="w-5 h-5" />
          Agent vs Agent
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => onSubModeChange("youVsAgent")}
          className={`flex-1 py-3 rounded-lg font-orbitron font-bold flex items-center justify-center gap-2 transition-all ${
            subMode === "youVsAgent"
              ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/40"
              : "bg-black/60 border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60"
          }`}
        >
          <User className="w-5 h-5" />
          You vs Agent
        </motion.button>
      </div>

      {/* Your Squad Section */}
      <div>
        <h3 className="font-orbitron text-cyan-300 font-bold mb-3 text-sm">YOUR SQUAD</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {approvedAgents.map((agent) => {
            const perm = tournamentPerms[agent.id];
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/60 border-2 border-cyan-500/30 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-orbitron font-bold text-cyan-300">{agent.name}</h4>
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
                <div className="text-xs text-cyan-400/70 space-y-1">
                  <p>
                    <strong>Max Entry:</strong> ${perm?.max_entry_fee_usdc || "—"}
                  </p>
                  {perm?.daily_cap_usdc && (
                    <p>
                      <strong>Daily Cap:</strong> ${perm.daily_cap_usdc}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Opponent Selection */}
      <div>
        <h3 className="font-orbitron text-cyan-300 font-bold mb-3 text-sm">CHOOSE OPPONENT</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents
            .filter((a) => !approvedAgents.some((aa) => aa.id === a.id))
            .map((agent) => (
              <motion.button
                key={agent.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectOpponent(agent.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedOpponent === agent.id
                    ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/40"
                    : "border-cyan-500/30 bg-black/60 hover:border-cyan-400/60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-orbitron font-bold text-cyan-300">{agent.name}</h4>
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
                <p className="text-cyan-400/70 text-xs mb-2">by {agent.username}</p>
                <div className="flex gap-2 text-xs">
                  <div>
                    <div className="font-orbitron font-bold text-cyan-300">{agent.arena_wins}</div>
                    <div className="text-cyan-500/70">W</div>
                  </div>
                  <div>
                    <div className="font-orbitron font-bold text-cyan-300">{agent.arena_losses}</div>
                    <div className="text-cyan-500/70">L</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-orbitron font-bold text-cyan-300">{xpOf(agent.elo_rating)}</div>
                    <div className="text-cyan-500/70">XP</div>
                  </div>
                </div>
              </motion.button>
            ))}
        </div>
      </div>

      {/* Deploy Panel */}
      {selectedOpponent && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/60 border-2 border-cyan-500/40 rounded-lg p-6 space-y-4 sticky bottom-0"
        >
          <h3 className="font-orbitron text-cyan-300 font-bold">DEPLOY MATCH</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Select Agent */}
            <div>
              <label className="block font-orbitron text-cyan-300 text-xs mb-2 uppercase">Your Agent</label>
              <select
                value={challengerAgentId ?? ""}
                onChange={(e) => onChangeChallengerAgent(Number(e.target.value))}
                className="w-full bg-black/60 border-2 border-cyan-500/40 rounded-lg p-2 font-orbitron text-cyan-300 focus:outline-none focus:border-cyan-400"
              >
                {approvedAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
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
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDeploy}
            disabled={isDeploying}
            className="w-full py-3 rounded-lg font-orbitron font-bold bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ⚡ DEPLOY MATCH
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
