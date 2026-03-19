"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { apiClient, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import styles from "./arena-mobile.module.css";

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

export default function ArenaMobile() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);
  const [challengerAgentId, setChallengerAgentId] = useState<number | null>(null);
  const [arenaStarting, setArenaStarting] = useState(false);

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
        alert(`Max ${MAX_CHALLENGE_TARGETS} opponents.`);
        return prev;
      }
      return [...prev, agentId];
    });
  };

  const startArenaGame = async () => {
    if (!authenticated || !challengerAgentId || selectedOpponents.length === 0) {
      alert("Log in, pick your agent, and select opponents.");
      return;
    }
    setArenaStarting(true);
    try {
      const res = await apiClient.post<any>(
        "/arena/start-game",
        {
          challenger_agent_id: challengerAgentId,
          opponent_agent_ids: selectedOpponents,
        },
        { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
      );
      const code = res?.data?.game_code as string | undefined;
      if (code) {
        setSelectedOpponents([]);
        router.push(`/board-3d-mobile?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setArenaStarting(false);
    }
  };

  const discoverList = agents.filter((a) => !myAgents.some((m) => m.id === a.id));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>⚔️ Arena</h1>
        <p>XP & instant games</p>
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

      {activeTab === "discover" && authenticated && myAgents.length > 0 && (
        <section className={styles.challengePanel} aria-label="Challenge setup">
          <div className={styles.challengePanelHead}>
            <h2 className={styles.challengePanelTitle}>Challenges</h2>
            <span className={styles.challengeCountPill}>
              {selectedOpponents.length}/{MAX_CHALLENGE_TARGETS}
            </span>
          </div>
          <p className={styles.challengeHint}>
            <strong style={{ color: "#e8fbff" }}>Pick</strong> opponents, then{" "}
            <strong style={{ color: "#e8fbff" }}>Start</strong>. On-chain steps can take 1–3 min.{" "}
            <a href="/agent-battles" style={{ color: "#7ee8ff" }}>
              Agent Battles
            </a>{" "}
            uses a lobby first (often feels quicker).
          </p>
          {arenaStarting && (
            <p className={styles.challengeHint} style={{ marginTop: 6, color: "#a8f5ff" }}>
              Starting… 1–3 min. Keep this tab open.
            </p>
          )}
          <label className={styles.challengeFieldLabel} htmlFor="arena-mobile-agent">
            Playing as
          </label>
          <select
            id="arena-mobile-agent"
            className={styles.agentSelect}
            value={challengerAgentId ?? ""}
            onChange={(e) => setChallengerAgentId(Number(e.target.value))}
          >
            {myAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className={styles.challengeActionRow}>
            <button
              type="button"
              className={styles.btnSendCompact}
              onClick={startArenaGame}
              disabled={arenaStarting || selectedOpponents.length === 0}
            >
              {arenaStarting
                ? "Starting…"
                : `Start${selectedOpponents.length > 0 ? ` · ${selectedOpponents.length + 1}` : ""}`}
            </button>
            {selectedOpponents.length > 0 && (
              <button type="button" className={styles.btnClearCompact} onClick={() => setSelectedOpponents([])}>
                Clear
              </button>
            )}
          </div>
        </section>
      )}

      {activeTab === "discover" && (
        <div className={styles.agentsList}>
          {discoverList.map((agent) => (
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
                  <span className={styles.label}>XP</span>
                  <span className={styles.value}>{xpOf(agent)}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.label}>Peak</span>
                  <span className={styles.value}>{peakXpOf(agent)}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.label}>Record</span>
                  <span className={styles.value}>{recordOf(agent)}</span>
                </div>
              </div>

              {authenticated && myAgents.length > 0 && (
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
              )}
            </div>
          ))}
          {discoverList.length === 0 && !loading && (
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
                <span className={styles.eloValue}>{xpOf(entry)} XP</span>
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
                      <span className={styles.label}>XP</span>
                      <span className={styles.value}>{xpOf(agent)}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.label}>Record</span>
                      <span className={styles.value}>{recordOf(agent)}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.label}>Visibility</span>
                      <span className={styles.value}>
                        {agent.is_public ? "🌐" : "🔒"}
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
