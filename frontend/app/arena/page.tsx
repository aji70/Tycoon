"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import styles from "./arena.module.css";
import ArenaMobile from "@/components/arena/arena-mobile";

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

export default function ArenaPage() {
  const router = useRouter();
  const { user, authenticated } = usePrivy();
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load user's agents on mount if authenticated
  useEffect(() => {
    if (authenticated) {
      fetchMyAgents();
    }
  }, [authenticated]);

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
      const settings = {
        starting_cash: 1500,
        auction: true,
        rent_in_prison: false,
        mortgage: true,
        even_build: true,
        randomize_play_order: false,
      };

      const yourAgent = myAgents.find(a => a.id === yourAgentId);
      const opponentAgent = agents.find(a => a.id === opponentAgentId);

      const res = await apiClient.post<any>(`/games/create-agent-vs-agent`, {
        duration: 60,
        chain: "CELO",
        settings,
        number_of_players: 2,
        agents: [
          {
            slot: 1,
            user_agent_id: yourAgentId,
            name: yourAgent?.name || "Your Agent",
          },
          {
            slot: 2,
            user_agent_id: opponentAgentId,
            name: opponentAgent?.name || "Opponent Agent",
          },
        ],
      });

      const game = (res as any)?.data?.data;
      const gameCode = game?.code || "";
      if (gameCode) {
        alert("Challenge started! Redirecting to game board...");
        router.push(`/board-3d?gameCode=${encodeURIComponent(gameCode)}`);
      } else {
        throw new Error("Failed to get game code");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  if (isMobile) {
    return <ArenaMobile />;
  }

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
                      disabled={myAgents.length === 0}
                      onClick={() => myAgents.length > 0 && challengeAgent(agent.id, myAgents[0].id)}
                      title={myAgents.length === 0 ? "Create an agent first" : "Challenge this agent"}
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
            myAgents.length > 0 ? (
              <div className={styles.myAgentsGrid}>
                {myAgents.map((agent) => (
                  <div key={agent.id} className={styles.agentCard}>
                    <div className={styles.agentHeader}>
                      <h3>{agent.name}</h3>
                      <div
                        className={styles.tierbadge}
                        style={{ backgroundColor: TierColors[agent.tier_color] }}
                      >
                        {agent.tier || "N/A"}
                      </div>
                    </div>

                    <div className={styles.agentStats}>
                      <div className={styles.statRow}>
                        <span className={styles.label}>Status:</span>
                        <span className={styles.value}>{agent.status || "unknown"}</span>
                      </div>
                      <div className={styles.statRow}>
                        <span className={styles.label}>ELO Rating:</span>
                        <span className={styles.value}>{agent.elo_rating || "N/A"}</span>
                      </div>
                      <div className={styles.statRow}>
                        <span className={styles.label}>Visibility:</span>
                        <span className={styles.value}>
                          {agent.is_public ? "🌐 Public" : "🔒 Private"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.agentFooter}>
                      <button
                        className={agent.is_public ? styles.btnSecondary : styles.btnPrimary}
                        onClick={() => toggleAgentPublic(agent.id, agent.is_public || false)}
                      >
                        {agent.is_public ? "Hide from Arena" : "Make Public"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No agents found. Create or import an agent to get started!</p>
            )
          ) : (
            <p>Please log in to view your agents.</p>
          )}
        </div>
      )}
    </div>
  );
}
