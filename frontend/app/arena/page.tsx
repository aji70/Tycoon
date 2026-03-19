"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import styles from "./arena.module.css";

interface Agent {
  id: number;
  name: string;
  username: string;
  elo_rating: number;
  elo_peak: number;
  arena_wins: number;
  arena_losses: number;
  arena_draws: number;
  tier: string;
  tier_color: string;
  total_games: number;
  win_rate?: string;
}

interface LeaderboardEntry extends Agent {
  rank: number;
}

const TierColors: Record<string, string> = {
  gold: "#FFD700",
  cyan: "#00FFFF",
  purple: "#9370DB",
  yellow: "#FFFF00",
  silver: "#C0C0C0",
  brown: "#8B4513",
};

export default function ArenaPage() {
  const { user, authenticated } = usePrivy();
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Fetch agents
  useEffect(() => {
    if (activeTab === "discover") {
      fetchPublicAgents(page);
    }
  }, [activeTab, page]);

  // Fetch leaderboard
  useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [activeTab]);

  const fetchPublicAgents = async (pageNum: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/arena/agents?page=${pageNum}&page_size=20`);
      if (!res.ok) throw new Error("Failed to fetch agents");
      const data = await res.json();
      setAgents(data.agents);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/arena/leaderboard?limit=50`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      const data = await res.json();
      setLeaderboard(data.leaderboard);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const joinQueue = async (agentId: number) => {
    if (!authenticated) {
      alert("Please log in to join the queue");
      return;
    }

    try {
      const res = await fetch("/api/arena/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_agent_id: agentId }),
      });
      if (!res.ok) throw new Error("Failed to join queue");
      alert("Successfully joined matchmaking queue!");
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const challengeAgent = async (opponentAgentId: number, yourAgentId: number) => {
    if (!authenticated) {
      alert("Please log in to challenge");
      return;
    }

    try {
      const res = await fetch(`/api/arena/challenge/${opponentAgentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_agent_id: yourAgentId }),
      });
      if (!res.ok) throw new Error("Failed to send challenge");
      alert("Challenge sent!");
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>⚔️ Agent Arena</h1>
        <p>Battle your agents against the best</p>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "discover" ? styles.active : ""}`}
          onClick={() => {
            setActiveTab("discover");
            setPage(1);
          }}
        >
          🔍 Discover Agents
        </button>
        <button
          className={`${styles.tab} ${activeTab === "leaderboard" ? styles.active : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          🏆 Leaderboard
        </button>
        <button
          className={`${styles.tab} ${activeTab === "my-agents" ? styles.active : ""}`}
          onClick={() => setActiveTab("my-agents")}
        >
          👤 My Agents
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Loading...</div>}

      {activeTab === "discover" && (
        <div className={styles.agentsGrid}>
          {agents.map((agent) => (
            <div key={agent.id} className={styles.agentCard}>
              <div className={styles.agentHeader}>
                <h3>{agent.name}</h3>
                <div
                  className={styles.tierbadge}
                  style={{ backgroundColor: TierColors[agent.tier_color] }}
                >
                  {agent.tier}
                </div>
              </div>

              <div className={styles.agentStats}>
                <div className={styles.statRow}>
                  <span className={styles.label}>ELO Rating:</span>
                  <span className={styles.value}>{agent.elo_rating}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.label}>Peak ELO:</span>
                  <span className={styles.value}>{agent.elo_peak}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.label}>Win Rate:</span>
                  <span className={styles.value}>{agent.win_rate || "N/A"}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.label}>Record:</span>
                  <span className={styles.value}>
                    {agent.arena_wins}W-{agent.arena_losses}L-{agent.arena_draws}D
                  </span>
                </div>
              </div>

              <div className={styles.agentFooter}>
                <span className={styles.creatorName}>by {agent.username}</span>
                {authenticated && (
                  <div className={styles.buttonGroup}>
                    <button
                      className={styles.btnPrimary}
                      onClick={() => joinQueue(agent.id)}
                    >
                      Find Match
                    </button>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => challengeAgent(agent.id, agent.id)}
                    >
                      Challenge
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className={styles.leaderboardTable}>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Agent Name</th>
                <th>Creator</th>
                <th>Tier</th>
                <th>ELO Rating</th>
                <th>Record</th>
                <th>Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.rank}>{entry.rank}</td>
                  <td className={styles.agentName}>{entry.name}</td>
                  <td>{entry.username}</td>
                  <td>
                    <span
                      style={{
                        backgroundColor: TierColors[entry.tier_color],
                        padding: "4px 8px",
                        borderRadius: "4px",
                        color: "#000",
                      }}
                    >
                      {entry.tier}
                    </span>
                  </td>
                  <td className={styles.elo}>{entry.elo_rating}</td>
                  <td>
                    {entry.arena_wins}W-{entry.arena_losses}L-{entry.arena_draws}D
                  </td>
                  <td>{entry.win_rate || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "my-agents" && (
        <div className={styles.myAgents}>
          {authenticated ? (
            <p>Your agents will appear here. Create or import an agent to get started!</p>
          ) : (
            <p>Please log in to view your agents.</p>
          )}
        </div>
      )}
    </div>
  );
}
