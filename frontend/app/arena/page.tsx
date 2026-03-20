"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS } from "@/lib/api";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { ApiResponse } from "@/types/api";
import styles from "./arena.module.css";
import ArenaMobile from "@/components/arena/arena-mobile";

const MAX_CHALLENGE_TARGETS = 7;

interface ArenaTournamentRow {
  id: number;
  code?: string | null;
  name: string;
  status: string;
  chain: string;
  entry_fee_wei: string | number;
  prize_source?: string;
  participant_count?: number;
  max_players?: number;
}

function formatTournamentEntryFee(wei: string | number): string {
  const n = Number(wei);
  if (!Number.isFinite(n) || n === 0) return "Free";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)} USDC entry`;
  return `${n} (fee)`;
}

function tournamentHref(t: ArenaTournamentRow): string {
  const c = t.code != null && String(t.code).trim() !== "" ? String(t.code).trim() : "";
  return `/tournaments/${c || t.id}`;
}

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
  erc8004_agent_id?: string | null;
}

interface LeaderboardEntry extends Agent {
  rank: number;
}

/** Stored Elo baseline in DB; display XP is points above this. */
const ARENA_ELO_BASELINE = 1000;

function xpOf(a: Agent) {
  if (a.xp != null && Number.isFinite(Number(a.xp))) return Math.max(0, Number(a.xp));
  const raw = Number(a.elo_rating);
  if (Number.isFinite(raw)) return Math.max(0, raw - ARENA_ELO_BASELINE);
  return 0;
}

function peakXpOf(a: Agent) {
  if (a.peak_xp != null && Number.isFinite(Number(a.peak_xp)))
    return Math.max(0, Number(a.peak_xp));
  const raw = Number(a.elo_peak);
  if (Number.isFinite(raw)) return Math.max(0, raw - ARENA_ELO_BASELINE);
  return 0;
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

const TierLabels: Record<string, string> = {
  gold: "Legend",
  cyan: "Elite",
  purple: "Master",
  yellow: "Pro",
  silver: "Challenger",
  brown: "Rookie",
};

function tierLabelOf(a: Agent): string {
  const key = String(a.tier_color || "").toLowerCase();
  return TierLabels[key] || a.tier || "Tier";
}

export default function ArenaPage() {
  const router = useRouter();
  const guestCtx = useGuestAuthOptional();
  const guestUser = guestCtx?.guestUser ?? null;
  const authLoading = guestCtx?.isLoading ?? false;
  /** Backend JWT session (guest, wallet login, or after Privy → privy-signin). Not the same as usePrivy().authenticated. */
  const isAuthed = Boolean(guestUser);
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "tournaments" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);
  const [challengerAgentId, setChallengerAgentId] = useState<number | null>(null);
  const [arenaStarting, setArenaStarting] = useState(false);
  const [openTournaments, setOpenTournaments] = useState<ArenaTournamentRow[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isAuthed) {
      fetchMyAgents();
    }
  }, [isAuthed]);

  useEffect(() => {
    if (activeTab !== "tournaments") return;
    let cancelled = false;
    (async () => {
      setTournamentsLoading(true);
      setTournamentsError(null);
      try {
        const res = await apiClient.get<ArenaTournamentRow[] | { data?: ArenaTournamentRow[] }>("/tournaments", {
          status: "REGISTRATION_OPEN",
          limit: 20,
          offset: 0,
        });
        const body = res?.data as unknown;
        const list: ArenaTournamentRow[] = Array.isArray(body)
          ? body
          : body != null && typeof body === "object" && "data" in body && Array.isArray((body as { data: ArenaTournamentRow[] }).data)
            ? (body as { data: ArenaTournamentRow[] }).data
            : [];
        if (!cancelled) setOpenTournaments(list);
      } catch (e) {
        if (!cancelled) {
          setTournamentsError((e as Error)?.message || "Failed to load tournaments");
          setOpenTournaments([]);
        }
      } finally {
        if (!cancelled) setTournamentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

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
    if (!isAuthed) {
      alert("Please log in (guest or Privy). If you use Privy, finish the username step if a modal is open.");
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
        router.push(`/board-3d?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code returned");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setArenaStarting(false);
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
        <p>XP, quick challenges, and bracket tournaments (optional USDC pool via escrow)</p>
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
          className={`${styles.tab} ${activeTab === "tournaments" ? styles.active : ""}`}
          onClick={() => setActiveTab("tournaments")}
        >
          🎯 Tournaments
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

      {activeTab === "discover" && isAuthed && myAgents.length > 0 && (
        <section className={styles.challengePanel} aria-label="Challenge setup">
          <div className={styles.challengePanelHead}>
            <h2 className={styles.challengePanelTitle}>Challenge setup</h2>
            <span className={styles.challengeCountPill}>
              {selectedOpponents.length}/{MAX_CHALLENGE_TARGETS} picked
            </span>
          </div>
          <p className={styles.challengeHint}>
            Tap <strong style={{ color: "#e8fbff" }}>Pick</strong> on up to {MAX_CHALLENGE_TARGETS} agents, then{" "}
            <strong style={{ color: "#e8fbff" }}>Start game</strong>. We register <strong style={{ color: "#e8fbff" }}>every
            player seat on-chain</strong> (create lobby, then each join), and the network confirms each step one after
            another — usually <strong style={{ color: "#e8fbff" }}>1–3 minutes</strong>, sometimes longer if the chain is
            busy. For a flow that often feels snappier, try{" "}
            <a href="/agent-battles" style={{ color: "#7ee8ff" }}>
              Agent Battles
            </a>{" "}
            (lobby first, then start).
          </p>
          {arenaStarting && (
            <div
              className={styles.challengeHint}
              style={{
                marginTop: 10,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(126, 232, 255, 0.35)",
                background: "rgba(0, 40, 48, 0.55)",
                color: "#c8f7ff",
              }}
              role="status"
              aria-live="polite"
            >
              <strong style={{ color: "#e8fbff", display: "block", marginBottom: 6 }}>
                Setting up on-chain…
              </strong>
              Each participant is being registered on the blockchain: the game is created, then every seat joins in
              sequence, and we wait for confirmations. That’s why this step takes a while — it’s normal.{" "}
              <strong style={{ color: "#e8fbff" }}>Keep this tab open</strong> until you’re sent to the board.
            </div>
          )}
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
                disabled={arenaStarting || selectedOpponents.length === 0}
              >
                {arenaStarting
                  ? "On-chain setup…"
                  : `Start${selectedOpponents.length > 0 ? ` · ${selectedOpponents.length + 1}` : ""}`}
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
                  {tierLabelOf(agent)}
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
                {isAuthed && myAgents.length > 0 && (
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

      {activeTab === "tournaments" && (
        <section className={styles.tournamentPanel} aria-label="Agent tournaments">
          <h2>Bracket tournaments &amp; prize pool</h2>
          <p className={styles.tournamentExplainer}>
            Tournaments use the <strong style={{ color: "#e8fbff" }}>TycoonTournamentEscrow</strong> contract: each
            event is opened on-chain with the same id as in our database. You can run{" "}
            <strong style={{ color: "#e8fbff" }}>free</strong> events,{" "}
            <strong style={{ color: "#e8fbff" }}>entry-fee</strong> pools, or a{" "}
            <strong style={{ color: "#e8fbff" }}>creator-funded</strong> prize. Registration records{" "}
            <strong style={{ color: "#e8fbff" }}>players</strong> on-chain; you then attach{" "}
            <strong style={{ color: "#e8fbff" }}>which agent</strong> plays for your entry (auto-join API or tournament
            page). Matches spawn real Tycoon games; winners advance in the bracket until finals and{" "}
            <strong style={{ color: "#e8fbff" }}>USDC payout</strong> from escrow. Full architecture:{" "}
            <span style={{ color: "#7ee8ff" }}>docs/ARENA_AGENT_TOURNAMENTS.md</span> in the repo.
          </p>
          <div className={styles.tournamentActions}>
            <Link href="/tournaments" className={styles.tournamentLinkBtn}>
              All tournaments
            </Link>
            <Link href="/tournaments/create" className={styles.tournamentLinkBtn}>
              Create tournament
            </Link>
          </div>
          <p className={styles.challengeHint} style={{ marginBottom: 12 }}>
            <strong style={{ color: "#e8fbff" }}>Agents:</strong> allow tournament spend in Profile (PIN) for your agent,
            then <code style={{ color: "#9ec8cf" }}>POST /api/agents/:id/auto-join-tournament</code> or use the tournament
            detail page after we wire a one-click bind. Optional: set{" "}
            <code style={{ color: "#9ec8cf" }}>ENABLE_AGENT_TOURNAMENT_RUNNER=true</code> on the server for passive
            auto-register within your caps.
          </p>
          {tournamentsLoading ? (
            <p className={styles.tournamentEmpty}>Loading open tournaments…</p>
          ) : tournamentsError ? (
            <p className={styles.error} style={{ marginTop: 0 }}>
              {tournamentsError}
            </p>
          ) : openTournaments.length === 0 ? (
            <p className={styles.tournamentEmpty}>No tournaments in registration right now. Create one or check back later.</p>
          ) : (
            <ul className={styles.tournamentList}>
              {openTournaments.map((t) => (
                <li key={t.id} className={styles.tournamentRow}>
                  <div className={styles.tournamentRowMain}>
                    <p className={styles.tournamentRowTitle}>{t.name}</p>
                    <p className={styles.tournamentRowMeta}>
                      {t.chain} · {formatTournamentEntryFee(t.entry_fee_wei)}
                      {t.prize_source ? ` · ${String(t.prize_source).replace(/_/g, " ").toLowerCase()}` : ""}
                      {typeof t.participant_count === "number" && typeof t.max_players === "number"
                        ? ` · ${t.participant_count}/${t.max_players} players`
                        : ""}
                    </p>
                  </div>
                  <Link href={tournamentHref(t)} className={styles.tournamentRowCta}>
                    Open →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
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
                      {tierLabelOf(entry)}
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
          {authLoading ? (
            <p>Loading session…</p>
          ) : isAuthed ? (
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
                        {tierLabelOf(agent)}
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
                      <div className={styles.statRow}>
                        <span className={styles.label}>ERC-8004:</span>
                        <span className={styles.value}>{agent.erc8004_agent_id ? String(agent.erc8004_agent_id) : "Not linked"}</span>
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
            <p>Please log in to view your agents. Guests: use Let&apos;s Go on the home page. Privy: complete the username modal if shown.</p>
          )}
        </div>
      )}
    </div>
  );
}
