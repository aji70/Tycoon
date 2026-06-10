"use client";

import { motion } from "framer-motion";

interface LeaderboardEntry {
  id: number;
  rank: number;
  name: string;
  username: string;
  tier: string;
  tier_color: string;
  xp?: number;
  elo_rating?: number;
  arena_wins: number;
  arena_losses: number;
  arena_draws: number;
  total_games: number;
}

interface LeaderboardTabProps {
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  myAgentId?: number;
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

export function ArenaLeaderboardTab({ leaderboard, loading, myAgentId }: LeaderboardTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-cyan-400 font-orbitron">Loading leaderboard...</div>
      </div>
    );
  }

  const maxXp = 2000;

  return (
    <div className="space-y-4">
      {leaderboard.map((entry, idx) => {
        const isMe = entry.id === myAgentId;
        let glow = "";
        if (entry.rank === 1) glow = "shadow-lg shadow-yellow-500/60 border-yellow-500/80";
        else if (entry.rank === 2) glow = "shadow-lg shadow-gray-400/60 border-gray-400/80";
        else if (entry.rank === 3) glow = "shadow-lg shadow-orange-600/60 border-orange-600/80";

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`bg-black/60 border-2 rounded-lg p-6 transition-all ${
              isMe ? "border-cyan-400 bg-cyan-500/10" : glow || "border-cyan-500/30"
            }`}
          >
            <div className="flex items-center gap-6">
              {/* Rank */}
              <div className="flex-shrink-0">
                <div className="text-4xl font-orbitron font-black" style={{ color: TierColors[entry.tier_color] || "#00FFFF" }}>
                  #{entry.rank}
                </div>
              </div>

              {/* Agent Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-orbitron font-bold text-cyan-300 text-lg">{entry.name}</h3>
                  <div
                    className="px-2 py-1 rounded-full text-xs font-orbitron font-bold"
                    style={{
                      backgroundColor: `${TierColors[entry.tier_color] || "#00FFFF"}33`,
                      color: TierColors[entry.tier_color] || "#00FFFF",
                      border: `1px solid ${TierColors[entry.tier_color] || "#00FFFF"}`,
                    }}
                  >
                    {entry.tier}
                  </div>
                  {isMe && <div className="text-xs px-2 py-1 bg-cyan-500/20 border border-cyan-400 text-cyan-300 rounded-full font-orbitron">YOUR AGENT</div>}
                </div>

                <p className="text-cyan-400/70 text-sm">by {entry.username}</p>

                {/* XP Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-cyan-400/70">XP</span>
                    <span className="font-orbitron font-bold text-cyan-300">{xpOf(entry.elo_rating)}</span>
                  </div>
                  <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${(xpOf(entry.elo_rating) / maxXp) * 100}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-orbitron font-bold text-cyan-300">{entry.arena_wins}</div>
                  <div className="text-xs text-cyan-500/70">Wins</div>
                </div>
                <div>
                  <div className="text-lg font-orbitron font-bold text-cyan-300">{entry.arena_losses}</div>
                  <div className="text-xs text-cyan-500/70">Losses</div>
                </div>
                <div>
                  <div className="text-lg font-orbitron font-bold text-cyan-300">{entry.arena_draws}</div>
                  <div className="text-xs text-cyan-500/70">Draws</div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
