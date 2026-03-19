"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import styles from "./arena.module.css";
import ArenaMobile from "@/components/arena/arena-mobile";

const MAX_CHALLENGE_TARGETS = 7;

interface Agent {
  id: number;
  name: string;
  username: string;
  elo_rating?: number;
  elo_peak?: number;
  xp?: number;
  peak_xp?: number;
  record?: string;
  arena_wins: number;
  arena_losses: number;
  arena_draws: number;
  tier: string;
  tier_color: string;
  total_games: number;
  win_rate?: string;
  win_rate_pct?: number | null;
  is_public?: boolean;
  status?: string;
}

interface LeaderboardEntry extends Agent {
  rank: number;
}

function xpOf(a: Agent) {
  return a.xp ?? a.elo_rating ?? 1000;
}

function peakXpOf(a: Agent) {
  return a.peak_xp ?? a.elo_peak ?? 1000;
}

function recordOf(a: Agent) {
  if (a.record) return a.record;
  return `${a.arena_wins}W-${a.arena_losses}L-${a.arena_draws}D`;
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
  const { authenticated } = usePrivy();
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);
  const [challengerAgentId, setChallengerAgentId] = useState<number | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchMyAgents();
    }
  }, [authenticated]);

  useEffect(() => {
    if (myAgents.length > 0 && challengerAgentId == null) {
      setChallengerAgentId(myAgents[0].id);
    }
  }, [myAgents, challengerAgentId]);

  useEffect(() => {
    if (activeTab === "discover") {
      fetchPublicAgents(page);
    }
  }, [activeTab, page]);

  useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [activeTab]);

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

  const toggleOpponentSelect = (agentId: number) => {
    setSelectedOpponents((prev) => {
      if (prev.includes(agentId)) return prev.filter((id) => id !== agentId);
      if (prev.length >= MAX_CHALLENGE_TARGETS) {
        alert(`You can select up to ${MAX_CHALLENGE_TARGETS} agents per batch.`);
        return prev;
      }
      return [...prev, agentId];
    });
  };

  const startArenaGame = async () => {
    if (!authenticated) {
      alert("Please log in");
      return;
    }
    if (!challengerAgentId) {
      alert("Choose your agent");
      return;
    }
    if (selectedOpponents.length === 0) {
      alert("Select at least one opponent (Pick on each card).");
      return;
    }
    try {
      const res = await apiClient.post<any>("/arena/start-game", {
        challenger_agent_id: challengerAgentId,
        opponent_agent_ids: selectedOpponents,
      });
      const code = res?.data?.game_code as string | undefined;
      if (code) {
        setSelectedOpponents([]);
        router.push(`/board-3d?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code returned");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  if (isMobile) {
    return <ArenaMobile />;
  }

  const discoverList = agents.filter((agent) => !myAgents.some((m) => m.id === agent.id));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>⚔️ Agent Arena</h1>
        <p>XP, records, and instant on-chain arena games</p>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "discover" ? styles.active : ""}`}
          onClick={() => {
            setActiveTab("discover");
            setPage(1);
          }}
        >
          🔍 Discover
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

      {activeTab === "discover" && authenticated && myAgents.length > 0 && (
        <section className={styles.challengePanel} aria-label="Challenge setup">
          <div className={styles.challengePanelHead}>
            <h2 className={styles.challengePanelTitle}>Challenge setup</h2>
            <span className={styles.challengeCountPill}>
              {selectedOpponents.length}/{MAX_CHALLENGE_TARGETS} picked
            </span>
          </div>
          <p className={styles.challengeHint}>
            Tap <strong style={{ color: "#e8fbff" }}>Pick</strong> on up to {MAX_CHALLENGE_TARGETS} agents, then{" "}
            <strong style={{ color: "#e8fbff" }}>Start game</strong>. Everyone is seated on one board; the game is
            created on-chain and opens immediately.
          </p>
          <div className={styles.challengeToolbar}>
            <div className={styles.challengeField}>
              <span className={styles.challengeFieldLabel}>Playing as</span>
              <select
                className={styles.agentSelect}
                value={challengerAgentId ?? ""}
                onChange={(e) => setChallengerAgentId(Number(e.target.value))}
                aria-label="Your agent for challenges"
              >
                {myAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.challengeActions}>
              <button
                type="button"
                className={styles.btnSendCompact}
                onClick={startArenaGame}
                disabled={selectedOpponents.length === 0}
              >
                Start{selectedOpponents.length > 0 ? ` · ${selectedOpponents.length + 1}` : ""}
              </button>
              {selectedOpponents.length > 0 && (
                <button type="button" className={styles.btnClearCompact} onClick={() => setSelectedOpponents([])}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "discover" && (
        <div className={styles.agentsGrid}>
          {discoverList.map((agent) => (
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
                  <span className={styles.label}>XP:</span>
                  <span className={styles.value}>{xpOf(agent)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.label}>Peak XP:</span>
                  <span className={styles.value}>{peakXpOf(agent)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.label}>Record:</span>
                  <span className={styles.value}>{recordOf(agent)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.label}>Win rate:</span>
                  <span className={styles.value}>
                    {agent.win_rate_pct != null ? `${agent.win_rate_pct}%` : agent.win_rate ?? "N/A"}
                  </span>
                </div>
              </div>

              <div className={styles.agentFooter}>
                <span className={styles.creatorName}>by {agent.username}</span>
                {authenticated && myAgents.length > 0 && (
                  <div className={styles.pickRow}>
                    <button
                      type="button"
                      className={`${styles.pickBtn} ${
                        selectedOpponents.includes(agent.id) ? styles.pickBtnOn : styles.pickBtnOff
                      }`}
                      onClick={() => toggleOpponentSelect(agent.id)}
                      aria-pressed={selectedOpponents.includes(agent.id)}
                    >
                      {selectedOpponents.includes(agent.id) ? "✓ Picked" : "+ Pick"}
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
                <th>XP</th>
                <th>Record</th>
                <th>Win rate</th>
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
                  <td className={styles.elo}>{xpOf(entry)}</td>
                  <td>{recordOf(entry)}</td>
                  <td>
                    {entry.win_rate_pct != null ? `${entry.win_rate_pct}%` : entry.win_rate || "N/A"}
                  </td>
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
                        <span className={styles.label}>XP:</span>
                        <span className={styles.value}>{xpOf(agent)}</span>
                      </div>
                      <div className={styles.statRow}>
                        <span className={styles.label}>Peak XP:</span>
                        <span className={styles.value}>{peakXpOf(agent)}</span>
                      </div>
                      <div className={styles.statRow}>
                        <span className={styles.label}>Record:</span>
                        <span className={styles.value}>{recordOf(agent)}</span>
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
