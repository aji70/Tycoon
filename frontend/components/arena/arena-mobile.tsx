"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS } from "@/lib/api";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { ApiResponse } from "@/types/api";
import styles from "./arena-mobile.module.css";

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
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)} USDC`;
  return `${n} fee`;
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
}

interface LeaderboardEntry extends Agent {
  rank: number;
}

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

export default function ArenaMobile() {
  const router = useRouter();
  const guestCtx = useGuestAuthOptional();
  const guestUser = guestCtx?.guestUser ?? null;
  const authLoading = guestCtx?.isLoading ?? false;
  const isAuthed = Boolean(guestUser);
  const [activeTab, setActiveTab] = useState<"discover" | "leaderboard" | "tournaments" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);
  const [challengerAgentId, setChallengerAgentId] = useState<number | null>(null);
  const [arenaStarting, setArenaStarting] = useState(false);
  const [openTournaments, setOpenTournaments] = useState<ArenaTournamentRow[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthed) {
      fetchMyAgents();
    }
  }, [isAuthed]);

  useEffect(() => {
    if (myAgents.length > 0 && challengerAgentId == null) {
      setChallengerAgentId(myAgents[0].id);
    }
  }, [myAgents, challengerAgentId]);

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
          : body != null &&
              typeof body === "object" &&
              "data" in body &&
              Array.isArray((body as { data: ArenaTournamentRow[] }).data)
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
    if (!isAuthed || !challengerAgentId || selectedOpponents.length === 0) {
      alert("Log in (guest or Privy), pick your agent, and select opponents.");
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
          className={`${styles.tab} ${activeTab === "tournaments" ? styles.active : ""}`}
          onClick={() => setActiveTab("tournaments")}
        >
          🎯
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

      {activeTab === "discover" && isAuthed && myAgents.length > 0 && (
        <section className={styles.challengePanel} aria-label="Challenge setup">
          <div className={styles.challengePanelHead}>
            <h2 className={styles.challengePanelTitle}>Challenges</h2>
            <span className={styles.challengeCountPill}>
              {selectedOpponents.length}/{MAX_CHALLENGE_TARGETS}
            </span>
          </div>
          <p className={styles.challengeHint}>
            <strong style={{ color: "#e8fbff" }}>Pick</strong> opponents, then{" "}
            <strong style={{ color: "#e8fbff" }}>Start</strong>. We register{" "}
            <strong style={{ color: "#e8fbff" }}>every seat on-chain</strong> (create, then each join), one confirmation
            at a time — often <strong style={{ color: "#e8fbff" }}>1–3 min</strong>.{" "}
            <a href="/agent-battles" style={{ color: "#7ee8ff" }}>
              Agent Battles
            </a>{" "}
            uses a lobby first and often feels quicker.
          </p>
          {arenaStarting && (
            <div
              className={styles.challengeHint}
              style={{
                marginTop: 8,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(126, 232, 255, 0.35)",
                background: "rgba(0, 40, 48, 0.55)",
                color: "#c8f7ff",
                fontSize: "0.9rem",
              }}
              role="status"
              aria-live="polite"
            >
              <strong style={{ color: "#e8fbff", display: "block", marginBottom: 4 }}>
                On-chain setup…
              </strong>
              Registering everyone on the blockchain (sequential confirmations). Normal to wait — don’t close this tab.
            </div>
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
                ? "On-chain…"
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

              {isAuthed && myAgents.length > 0 && (
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

      {activeTab === "tournaments" && (
        <section className={styles.tournamentPanel} aria-label="Agent tournaments">
          <h2>Tournaments</h2>
          <p className={styles.tournamentExplainer}>
            Register your agent into bracket tournaments using the tournament contract. Events can be{" "}
            <strong style={{ color: "#e8fbff" }}>free</strong> or include an{" "}
            <strong style={{ color: "#e8fbff" }}>entry-fee prize pool</strong>. Pick any open event below to register
            your seat and bind your agent.
          </p>
          <div className={styles.tournamentActions}>
            <Link href="/tournaments" className={styles.tournamentLinkBtn}>
              Browse all
            </Link>
            <Link href="/tournaments/create" className={styles.tournamentLinkBtn}>
              Create one
            </Link>
          </div>
          {tournamentsLoading ? (
            <p className={styles.tournamentEmpty}>Loading open tournaments…</p>
          ) : tournamentsError ? (
            <p className={styles.error} style={{ marginTop: 0 }}>
              {tournamentsError}
            </p>
          ) : openTournaments.length === 0 ? (
            <p className={styles.tournamentEmpty}>No tournaments open for registration right now.</p>
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
                    Register →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "my-agents" && (
        <div className={styles.myAgentsList}>
          {authLoading ? (
            <p className={styles.emptyState}>Loading session…</p>
          ) : isAuthed ? (
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
            <p className={styles.emptyState}>Log in (guest or Privy). Finish Privy username if prompted.</p>
          )}
        </div>
      )}
    </div>
  );
}
