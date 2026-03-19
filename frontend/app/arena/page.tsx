"use client";

import { useState, useEffect, useCallback } from "react";
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

interface PendingChallenge {
  id: number;
  challenger_agent_id: number;
  challenged_agent_id: number;
  challenger_agent_name?: string | null;
  challenged_agent_name?: string | null;
  challenger_username?: string | null;
  challenged_username?: string | null;
  expires_at: string;
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
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "my-agents" | "invites">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [incoming, setIncoming] = useState<PendingChallenge[]>([]);
  const [outgoing, setOutgoing] = useState<PendingChallenge[]>([]);
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
        alert(`You can select up to ${MAX_CHALLENGE_TARGETS} agents per batch.`);
        return prev;
      }
      return [...prev, agentId];
    });
  };

  const sendChallengeBatch = async () => {
    if (!authenticated) {
      alert("Please log in");
      return;
    }
    if (!challengerAgentId) {
      alert("Choose your agent");
      return;
    }
    if (selectedOpponents.length === 0) {
      alert("Select at least one opponent (checkbox on each card).");
      return;
    }
    try {
      const res = await apiClient.post<any>("/arena/pending-challenges", {
        challenger_agent_id: challengerAgentId,
        opponent_agent_ids: selectedOpponents,
      });
      const skipped = res?.data?.skipped as { opponent_agent_id: number; reason: string }[] | undefined;
      let msg = `Sent ${selectedOpponents.length} challenge(s). Opponents can accept under Invites.`;
      if (skipped?.length) {
        msg += `\nSkipped: ${skipped.map((s) => `#${s.opponent_agent_id} (${s.reason})`).join(", ")}`;
      }
      alert(msg);
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
        router.push(`/board-3d?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code returned");
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

  if (isMobile) {
    return <ArenaMobile />;
  }

  const discoverList = agents.filter((agent) => !myAgents.some((m) => m.id === agent.id));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>⚔️ Agent Arena</h1>
        <p>XP, records, and challenge invites — one active game per agent</p>
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
          className={`${styles.tab} ${activeTab === "invites" ? styles.active : ""}`}
          onClick={() => setActiveTab("invites")}
        >
          ✉️ Invites
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
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            background: "rgba(0,240,255,0.08)",
            borderRadius: 12,
            border: "1px solid rgba(0,240,255,0.25)",
          }}
        >
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#a8c4c8" }}>
            Select up to {MAX_CHALLENGE_TARGETS} opponents below, choose your agent, then send invites. First
            acceptance starts the match and cancels other pending invites for those agents.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Your agent:</span>
              <select
                value={challengerAgentId ?? ""}
                onChange={(e) => setChallengerAgentId(Number(e.target.value))}
                style={{ padding: "0.35rem 0.5rem", borderRadius: 8 }}
              >
                {myAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={styles.btnPrimary} onClick={sendChallengeBatch}>
              Send challenges ({selectedOpponents.length})
            </button>
            {selectedOpponents.length > 0 && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedOpponents([])}
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
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
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOpponents.includes(agent.id)}
                      onChange={() => toggleOpponentSelect(agent.id)}
                    />
                    Add to challenge list
                  </label>
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

      {activeTab === "invites" && (
        <div className={styles.myAgents}>
          {!authenticated ? (
            <p>Please log in to view invites.</p>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>Incoming</h2>
              {incoming.length === 0 ? (
                <p>No pending challenges.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {incoming.map((c) => (
                    <li
                      key={c.id}
                      style={{
                        padding: "1rem",
                        marginBottom: "0.5rem",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                      }}
                    >
                      <strong>{c.challenger_agent_name || "Agent"}</strong> ({c.challenger_username}) wants to
                      fight your <strong>{c.challenged_agent_name || "agent"}</strong>
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button type="button" className={styles.btnPrimary} onClick={() => acceptInvite(c.id)}>
                          Accept & play
                        </button>
                        <button type="button" className={styles.btnSecondary} onClick={() => declineInvite(c.id)}>
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <h2>Outgoing</h2>
              {outgoing.length === 0 ? (
                <p>No challenges sent.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {outgoing.map((c) => (
                    <li
                      key={c.id}
                      style={{
                        padding: "1rem",
                        marginBottom: "0.5rem",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                      }}
                    >
                      Waiting for <strong>{c.challenged_agent_name || "opponent"}</strong> (
                      {c.challenged_username})
                      <div style={{ marginTop: 8 }}>
                        <button type="button" className={styles.btnSecondary} onClick={() => cancelOutgoing(c.id)}>
                          Cancel
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
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
