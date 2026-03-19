"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import styles from "./arena-mobile.module.css";

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
  is_public?: boolean;
  status?: string;
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

export default function ArenaMobile() {
  const router = useRouter();
  const { user, authenticated } = usePrivy();
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
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

  // Fetch my agents
  useEffect(() => {
    if (activeTab === "my-agents") {
      fetchMyAgents();
    }
  }, [activeTab]);

  const fetchPublicAgents = async (pageNum: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<any>(`/arena/agents?page=${pageNum}&page_size=20`);
      if (res?.data?.agents) {
        setAgents(res.data.agents);
      } else {
        throw new Error("Failed to fetch agents");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch agents: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<any>(`/arena/leaderboard?limit=50`);
      if (res?.data?.leaderboard) {
        setLeaderboard(res.data.leaderboard);
      } else {
        throw new Error("Failed to fetch leaderboard");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch leaderboard: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<ApiResponse<Agent[]>>("/agents");
      if (res?.data?.success && res.data.data) {
        setMyAgents(res.data.data);
      } else {
        throw new Error("Failed to fetch agents");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch your agents: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentPublic = async (agentId: number, currentValue: boolean) => {
    try {
      const res = await apiClient.patch<any>(`/agents/${agentId}`, {
        is_public: !currentValue,
      });
      if (res?.success && res?.data?.data) {
        const updatedAgent = res.data.data;
        setMyAgents(
          myAgents.map((a) =>
            a.id === agentId ? { ...a, is_public: updatedAgent.is_public } : a
          )
        );
        alert(`Agent is now ${updatedAgent.is_public ? "public" : "private"}!`);
      } else {
        throw new Error("Failed to update agent");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const joinQueue = async (agentId: number) => {
    if (!authenticated) {
      alert("Please log in to join the queue");
      return;
    }

    try {
      const res = await apiClient.post<any>(`/arena/queue`, { user_agent_id: agentId });
      if (res?.data?.queue_entry_id) {
        alert("Successfully joined matchmaking queue!");
      } else {
        throw new Error("Failed to join queue");
      }
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
      const res = await apiClient.post<any>(`/arena/start-challenge/${opponentAgentId}`, { user_agent_id: yourAgentId });
      if (res?.data?.game_id) {
        // Redirect to 3D game board
        router.push(`/(room)/game-play-3d?gameId=${res.data.game_id}&code=${res.data.game_code}`);
      } else {
        throw new Error("Failed to start challenge");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>⚔️ Arena</h1>
        <p>Battle agents</p>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "discover" ? styles.active : ""}`}
          onClick={() => {
            setActiveTab("discover");
            setPage(1);
          }}
        >
          🔍
        </button>
        <button
          className={`${styles.tab} ${activeTab === "leaderboard" ? styles.active : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          🏆
        </button>
        <button
          className={`${styles.tab} ${activeTab === "my-agents" ? styles.active : ""}`}
          onClick={() => setActiveTab("my-agents")}
        >
          👤
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Loading...</div>}

      {activeTab === "discover" && (
        <div className={styles.agentsList}>
          {agents.map((agent) => (
            <div key={agent.id} className={styles.agentCard}>
              <div className={styles.cardTop}>
                <div className={styles.nameSection}>
                  <h3>{agent.name}</h3>
                  <span className={styles.creator}>by {agent.username}</span>
                </div>
                <div
                  className={styles.tierbadge}
                  style={{ backgroundColor: TierColors[agent.tier_color] }}
                >
                  {agent.tier}
                </div>
              </div>

              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <span className={styles.label}>ELO</span>
                  <span className={styles.value}>{agent.elo_rating}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.label}>Win Rate</span>
                  <span className={styles.value}>{agent.win_rate || "N/A"}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.label}>Games</span>
                  <span className={styles.value}>{agent.total_games}</span>
                </div>
              </div>

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
          ))}
          {agents.length === 0 && !loading && (
            <p className={styles.emptyState}>No agents found</p>
          )}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className={styles.leaderboardList}>
          {leaderboard.map((entry) => (
            <div key={entry.id} className={styles.leaderboardItem}>
              <div className={styles.rankSection}>
                <span className={styles.rank}>#{entry.rank}</span>
                <div
                  className={styles.tierBadge}
                  style={{ backgroundColor: TierColors[entry.tier_color] }}
                >
                  {entry.tier}
                </div>
              </div>
              <div className={styles.nameSection}>
                <h4>{entry.name}</h4>
                <span className={styles.creator}>{entry.username}</span>
              </div>
              <div className={styles.eloSection}>
                <span className={styles.eloValue}>{entry.elo_rating}</span>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && !loading && (
            <p className={styles.emptyState}>No leaderboard data</p>
          )}
        </div>
      )}

      {activeTab === "my-agents" && (
        <div className={styles.myAgentsList}>
          {authenticated ? (
            myAgents.length > 0 ? (
              myAgents.map((agent) => (
                <div key={agent.id} className={styles.agentCard}>
                  <div className={styles.cardTop}>
                    <div className={styles.nameSection}>
                      <h3>{agent.name}</h3>
                      <span className={styles.status}>{agent.status || "unknown"}</span>
                    </div>
                    <div
                      className={styles.tierbadge}
                      style={{ backgroundColor: TierColors[agent.tier_color] }}
                    >
                      {agent.tier || "N/A"}
                    </div>
                  </div>

                  <div className={styles.statsRow}>
                    <div className={styles.stat}>
                      <span className={styles.label}>ELO</span>
                      <span className={styles.value}>{agent.elo_rating || "N/A"}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.label}>Visibility</span>
                      <span className={styles.value}>
                        {agent.is_public ? "🌐 Public" : "🔒 Private"}
                      </span>
                    </div>
                  </div>

                  <button
                    className={agent.is_public ? styles.btnSecondary : styles.btnPrimary}
                    onClick={() => toggleAgentPublic(agent.id, agent.is_public || false)}
                    style={{ width: "100%" }}
                  >
                    {agent.is_public ? "Hide from Arena" : "Make Public"}
                  </button>
                </div>
              ))
            ) : (
              <p className={styles.emptyState}>No agents found. Create or import an agent!</p>
            )
          ) : (
            <p className={styles.emptyState}>Please log in to view your agents.</p>
          )}
        </div>
      )}
    </div>
  );
}
