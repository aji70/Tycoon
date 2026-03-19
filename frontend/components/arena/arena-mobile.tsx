"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { apiClient } from "@/lib/api";
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

interface PendingChallenge {
  id: number;
  challenger_agent_id: number;
  challenged_agent_id: number;
  challenger_agent_name?: string | null;
  challenged_agent_name?: string | null;
  challenger_username?: string | null;
  challenged_username?: string | null;
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
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "invites" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [incoming, setIncoming] = useState<PendingChallenge[]>([]);
  const [outgoing, setOutgoing] = useState<PendingChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);
  const [challengerAgentId, setChallengerAgentId] = useState<number | null>(null);

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

  const fetchInvites = useCallback(async () => {
    if (!authenticated) return;
    try {
      const [inc, out] = await Promise.all([
        apiClient.get<any>("/arena/pending-challenges/incoming"),
        apiClient.get<any>("/arena/pending-challenges/outgoing"),
      ]);
      if (inc?.data?.challenges) setIncoming(inc.data.challenges);
      if (out?.data?.challenges) setOutgoing(out.data.challenges);
    } catch (e) {
      console.error(e);
    }
  }, [authenticated]);

  useEffect(() => {
    if (activeTab === "invites" && authenticated) {
      fetchInvites();
    }
  }, [activeTab, authenticated, fetchInvites]);

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

  const sendChallengeBatch = async () => {
    if (!authenticated || !challengerAgentId || selectedOpponents.length === 0) {
      alert("Log in, pick your agent, and select opponents.");
      return;
    }
    try {
      const res = await apiClient.post<any>("/arena/pending-challenges", {
        challenger_agent_id: challengerAgentId,
        opponent_agent_ids: selectedOpponents,
      });
      const skipped = res?.data?.skipped as { reason: string }[] | undefined;
      alert(
        skipped?.length
          ? `Sent. Skipped some: ${skipped.map((s) => s.reason).join(", ")}`
          : "Challenges sent. Check Invites."
      );
      setSelectedOpponents([]);
      fetchInvites();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const acceptInvite = async (id: number) => {
    try {
      const res = await apiClient.post<any>(`/arena/pending-challenges/${id}/accept`, {});
      const code = res?.data?.game_code as string | undefined;
      if (code) {
        router.push(`/board-3d-mobile?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const declineInvite = async (id: number) => {
    try {
      await apiClient.post<any>(`/arena/pending-challenges/${id}/decline`, {});
      fetchInvites();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const cancelOutgoing = async (id: number) => {
    try {
      await apiClient.post<any>(`/arena/pending-challenges/${id}/cancel`, {});
      fetchInvites();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const discoverList = agents.filter((a) => !myAgents.some((m) => m.id === a.id));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>⚔️ Arena</h1>
        <p>XP & invites</p>
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
          className={`${styles.tab} ${activeTab === "invites" ? styles.active : ""}`}
          onClick={() => setActiveTab("invites")}
        >
          ✉️
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
        <div style={{ padding: "0.75rem", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
          <select
            value={challengerAgentId ?? ""}
            onChange={(e) => setChallengerAgentId(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
          >
            {myAgents.map((a) => (
              <option key={a.id} value={a.id}>
                Your agent: {a.name}
              </option>
            ))}
          </select>
          <button type="button" className={styles.btnPrimary} style={{ width: "100%" }} onClick={sendChallengeBatch}>
            Send challenges ({selectedOpponents.length}/{MAX_CHALLENGE_TARGETS})
          </button>
        </div>
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
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedOpponents.includes(agent.id)}
                    onChange={() => toggleOpponentSelect(agent.id)}
                  />
                  Challenge
                </label>
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

      {activeTab === "invites" && (
        <div className={styles.myAgentsList}>
          {!authenticated ? (
            <p className={styles.emptyState}>Log in</p>
          ) : (
            <>
              <h4 style={{ margin: "0.5rem 0" }}>Incoming</h4>
              {incoming.length === 0 ? (
                <p className={styles.emptyState}>None</p>
              ) : (
                incoming.map((c) => (
                  <div key={c.id} className={styles.agentCard} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: "0.85rem", margin: 0 }}>
                      {c.challenger_username} → your {c.challenged_agent_name}
                    </p>
                    <button type="button" className={styles.btnPrimary} onClick={() => acceptInvite(c.id)}>
                      Accept
                    </button>
                    <button type="button" className={styles.btnSecondary} onClick={() => declineInvite(c.id)}>
                      Decline
                    </button>
                  </div>
                ))
              )}
              <h4 style={{ margin: "0.5rem 0" }}>Outgoing</h4>
              {outgoing.length === 0 ? (
                <p className={styles.emptyState}>None</p>
              ) : (
                outgoing.map((c) => (
                  <div key={c.id} className={styles.agentCard} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: "0.85rem", margin: 0 }}>
                      Waiting: {c.challenged_agent_name}
                    </p>
                    <button type="button" className={styles.btnSecondary} onClick={() => cancelOutgoing(c.id)}>
                      Cancel
                    </button>
                  </div>
                ))
              )}
            </>
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
