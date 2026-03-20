"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS } from "@/lib/api";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useRegisterAgentERC8004, useVerifyErc8004AgentId } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";
import styles from "./arena.module.css";
import ArenaMobile from "@/components/arena/arena-mobile";
import AgentsPage from "@/components/agents/agents-page";
import {
  Swords,
  Search,
  Trophy,
  Target,
  UserRound,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

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
  xp?: number;
  arena_wins: number;
  arena_losses: number;
  arena_draws: number;
  tier: string;
  tier_color: string;
  total_games: number;
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

/** Format USDC stored as integer string (6 decimals) for display. */
function formatUsdcDisplay(stored: string | null | undefined): string {
  if (stored == null || String(stored).trim() === "") return "—";
  try {
    const n = BigInt(String(stored));
    if (n === 0n) return "$0";
    const whole = n / 1_000_000n;
    const frac = n % 1_000_000n;
    const fracStr = frac === 0n ? "" : "." + frac.toString().padStart(6, "0").replace(/0+$/, "");
    return `$${whole}${fracStr}`;
  } catch {
    return "—";
  }
}

export default function ArenaPage() {
  const router = useRouter();
  const guestCtx = useGuestAuthOptional();
  const guestUser = guestCtx?.guestUser ?? null;
  const authLoading = guestCtx?.isLoading ?? false;
  /** Backend JWT session (guest, wallet login, or after Privy → privy-signin). Not the same as usePrivy().authenticated. */
  const isAuthed = Boolean(guestUser);
  const [activeTab, setActiveTab] = useState<"discover" | "challenges" | "leaderboard" | "tournaments" | "my-agents">("discover");
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
  const [myAgentsSubTab, setMyAgentsSubTab] = useState<"overview" | "manage">("overview");
  const [tournamentPerms, setTournamentPerms] = useState<Record<number, { enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }>>({});
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [registeringErc8004Id, setRegisteringErc8004Id] = useState<number | null>(null);
  const { register: registerOnCelo, isPending: isRegisteringErc8004 } = useRegisterAgentERC8004();
  const { isCelo } = useVerifyErc8004AgentId();

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
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const tab = q.get("tab");
    if (tab === "my-agents") {
      setActiveTab("my-agents");
      setMyAgentsSubTab(q.get("sub") === "manage" ? "manage" : "overview");
      router.replace("/arena", { scroll: false });
    } else if (tab === "challenges") {
      setActiveTab("challenges");
      router.replace("/arena", { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    if (activeTab === "discover" && isAuthed) {
      fetchMyAgents();
    }
  }, [activeTab, isAuthed]);

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
          public_arena: true,
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

  const approvedAgentIds = Object.keys(tournamentPerms).map(Number).filter((id) => tournamentPerms[id]?.enabled);
  const approvedAgentsForChallenges = myAgents.filter((a) => approvedAgentIds.includes(a.id));
  useEffect(() => {
    if (activeTab === "challenges" && approvedAgentsForChallenges.length > 0) {
      const valid = approvedAgentsForChallenges.some((a) => a.id === challengerAgentId);
      if (!valid) setChallengerAgentId(approvedAgentsForChallenges[0].id);
    }
  }, [activeTab, approvedAgentsForChallenges, challengerAgentId]);

  useEffect(() => {
    if (activeTab === "discover" || activeTab === "challenges") {
      fetchPublicAgents(page, { approvedToSpend: activeTab === "challenges" });
    }
  }, [activeTab, page]);

  useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "challenges" || !isAuthed) return;
    let cancelled = false;
    setChallengesLoading(true);
    (async () => {
      try {
        const [agentsRes, permsRes] = await Promise.all([
          apiClient.get<ApiResponse<Agent[]>>("/agents"),
          apiClient.get<{ success: boolean; data?: { data?: Array<{ user_agent_id: number; enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }> } }>("/agents/tournament-permissions"),
        ]);
        if (cancelled) return;
        if (agentsRes?.data?.success && agentsRes.data.data) setMyAgents(agentsRes.data.data);
        const list = (permsRes as any)?.data?.data ?? (permsRes as any)?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        const map: Record<number, { enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }> = {};
        for (const p of arr) {
          if (p?.user_agent_id != null && p?.enabled) {
            map[Number(p.user_agent_id)] = {
              enabled: true,
              max_entry_fee_usdc: p.max_entry_fee_usdc ?? "0",
              daily_cap_usdc: p.daily_cap_usdc ?? null,
              chain: p.chain ?? null,
            };
          }
        }
        setTournamentPerms(map);
      } catch (e) {
        console.error("Challenges fetch:", e);
      } finally {
        if (!cancelled) setChallengesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuthed]);

  useEffect(() => {
    if (activeTab !== "my-agents" || myAgentsSubTab !== "overview" || !isAuthed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<ApiResponse<Agent[]>>("/agents");
        if (cancelled) return;
        if (res?.data?.success && res.data.data) {
          setMyAgents(res.data.data);
        }
      } catch (e) {
        console.error("Refresh my agents (overview):", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, myAgentsSubTab, isAuthed]);

  const fetchPublicAgents = async (pageNum: number, opts?: { approvedToSpend?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), page_size: "20" });
      if (opts?.approvedToSpend) params.set("approved_to_spend", "1");
      const res = await apiClient.get<any>(`/arena/agents?${params.toString()}`);
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

  const fetchMyAgents = async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const res = await apiClient.get<ApiResponse<Agent[]>>("/agents");
      if (res?.data?.success && res.data.data) {
        setMyAgents(res.data.data);
      } else {
        throw new Error("Failed to fetch agents");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      if (!silent) {
        setError(`Failed to fetch your agents: ${(err as Error).message}`);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const toggleAgentPublic = async (agentId: number, currentValue: boolean) => {
    try {
      const res = await apiClient.patch<any>(`/agents/${agentId}`, {
        is_public: !currentValue,
      });
      if (res?.success && res?.data?.data) {
        const updatedAgent = res.data.data;
        setMyAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, is_public: updatedAgent.is_public } : a))
        );
        alert(`Agent is now ${updatedAgent.is_public ? "public in Discover" : "private"}!`);
      } else {
        throw new Error("Failed to update agent");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const handleRegisterOnCelo = async (agent: Agent) => {
    if (!isCelo) {
      alert("Switch to Celo to register this agent on ERC-8004.");
      return;
    }
    const existingId = agent.erc8004_agent_id ? String(agent.erc8004_agent_id).trim() : "";
    if (existingId) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          `Replace ERC-8004 ID ${existingId} with a new on-chain identity? Use this if you minted a new agent or fixed a wrong ID. The old ID will no longer be linked to this Tycoon agent.`
        );
      if (!ok) return;
    }
    setRegisteringErc8004Id(agent.id);
    try {
      const newAgentId = await registerOnCelo(agent.id);
      if (newAgentId == null) throw new Error("Registration succeeded but could not read on-chain agent ID");
      await apiClient.patch(`/agents/${agent.id}`, { erc8004_agent_id: String(newAgentId) });
      await fetchMyAgents({ silent: true });
      if (activeTab === "discover") await fetchPublicAgents(page);
      if (activeTab === "leaderboard") await fetchLeaderboard();
      alert(
        existingId
          ? `Re-linked on Celo. New agent ID: ${newAgentId}`
          : `Registered on Celo. Agent ID: ${newAgentId}`
      );
    } catch (err) {
      alert(`Registration failed: ${(err as Error)?.message || "Unknown error"}`);
    } finally {
      setRegisteringErc8004Id(null);
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
  const hasNextDiscoverPage = agents.length >= 20;
  const showDiscoverPagination = activeTab === "discover" && (page > 1 || hasNextDiscoverPage);

  return (
    <div className={styles.pageShell}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.heroBadge}>
              <Swords className="w-3.5 h-3.5" aria-hidden />
              PvP agents
            </span>
            <h1 className={styles.heroTitle}>Agent Arena</h1>
            <p className={styles.heroSubtitle}>
              Challenge public agents, climb ranks, and join tournaments — create your agents in the My agents tab.
            </p>
            {isAuthed ? (
              <button
                type="button"
                className={styles.heroLink}
                onClick={() => {
                  setActiveTab("my-agents");
                  setMyAgentsSubTab("overview");
                }}
              >
                My agents — quick view &amp; manager
              </button>
            ) : null}
          </div>
        </header>

        <nav className={styles.tabBar} aria-label="Arena sections">
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "discover" ? styles.active : ""}`}
            onClick={() => {
              setActiveTab("discover");
              setPage(1);
            }}
          >
            <span className={styles.tabIcon}>
              <Search className="w-4 h-4" aria-hidden />
            </span>
            Discover
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "challenges" ? styles.active : ""}`}
            onClick={() => setActiveTab("challenges")}
          >
            <span className={styles.tabIcon}>
              <Zap className="w-4 h-4" aria-hidden />
            </span>
            Challenges
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "leaderboard" ? styles.active : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            <span className={styles.tabIcon}>
              <Trophy className="w-4 h-4" aria-hidden />
            </span>
            Leaderboard
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "tournaments" ? styles.active : ""}`}
            onClick={() => setActiveTab("tournaments")}
          >
            <span className={styles.tabIcon}>
              <Target className="w-4 h-4" aria-hidden />
            </span>
            Tournaments
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "my-agents" ? styles.active : ""}`}
            onClick={() => {
              setActiveTab("my-agents");
              setMyAgentsSubTab("overview");
            }}
          >
            <span className={styles.tabIcon}>
              <UserRound className="w-4 h-4" aria-hidden />
            </span>
            My agents
          </button>
        </nav>

      {error && activeTab !== "my-agents" && activeTab !== "challenges" && <div className={styles.error}>{error}</div>}
      {loading && activeTab !== "my-agents" && activeTab !== "challenges" && <div className={styles.loading}>Loading</div>}

      {activeTab === "discover" && isAuthed && myAgents.length > 0 && (
        <section className={styles.challengePanel} aria-label="Challenge setup">
          <div className={styles.challengePanelHead}>
            <h2 className={styles.challengePanelTitle}>Challenge setup</h2>
            <span className={styles.challengeCountPill}>
              {selectedOpponents.length}/{MAX_CHALLENGE_TARGETS} picked
            </span>
          </div>
          <p className={styles.challengeHint}>
            <strong style={{ color: "#e8fbff" }}>Pick</strong> up to {MAX_CHALLENGE_TARGETS} opponents, then{" "}
            <strong style={{ color: "#e8fbff" }}>Start</strong>. On-chain setup often takes{" "}
            <strong style={{ color: "#e8fbff" }}>1–3 minutes</strong>; keep this tab open. Matches run{" "}
            <strong style={{ color: "#e8fbff" }}>30 minutes</strong>. Faster lobby flow:{" "}
            <a href="/agent-battles" style={{ color: "#7ee8ff" }}>
              Agent Battles
            </a>
            .
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
              Confirmations are queued one after another — this is normal.{" "}
              <strong style={{ color: "#e8fbff" }}>Don’t close this tab</strong> until the board opens.
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
        <>
          <div className={styles.agentsGrid}>
            {discoverList.map((agent) => (
              <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardDiscover}`}>
                <div className={styles.agentDiscoverTop}>
                  <h3 title={agent.name}>{agent.name}</h3>
                  <div
                    className={styles.tierbadgeCompact}
                    style={{ backgroundColor: TierColors[agent.tier_color] }}
                  >
                    {tierLabelOf(agent)}
                  </div>
                </div>
                <div className={styles.agentDiscoverMeta}>
                  <span>
                    XP <strong>{xpOf(agent)}</strong>
                  </span>
                  <span>
                    8004 <strong>{agent.erc8004_agent_id ? String(agent.erc8004_agent_id) : "—"}</strong>
                  </span>
                </div>
                <div className={styles.agentDiscoverFooter}>
                  <span className={styles.creatorNameCompact} title={`by ${agent.username}`}>
                    by {agent.username}
                  </span>
                  {isAuthed && myAgents.length > 0 && (
                    <div className={styles.agentDiscoverPick}>
                      <button
                        type="button"
                        className={`${styles.pickBtn} ${
                          selectedOpponents.includes(agent.id) ? styles.pickBtnOn : styles.pickBtnOff
                        }`}
                        onClick={() => toggleOpponentSelect(agent.id)}
                        aria-pressed={selectedOpponents.includes(agent.id)}
                      >
                        {selectedOpponents.includes(agent.id) ? "✓" : "+ Pick"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!loading && discoverList.length === 0 && (
            <div className={styles.emptyDiscover}>
              <strong>No public agents on this page</strong>
              Try another page, make your agent public in My agents, or check back later.
            </div>
          )}
          {showDiscoverPagination && (
            <div className={styles.paginationBar}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden />
                Previous
              </button>
              <span className={styles.pageIndicator}>Page {page}</span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={!hasNextDiscoverPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "challenges" && (
        <section className={styles.challengePanel} aria-label="Approved agents and challenges">
          <div className={styles.challengePanelHead}>
            <h2 className={styles.challengePanelTitle}>Challenges</h2>
          </div>
          <p className={styles.challengeHint}>
            Agents you’ve <strong style={{ color: "#e8fbff" }}>approved to spend</strong> from your smart wallet (max entry fee + daily cap). Use them to create Arena matches below.
          </p>

          {challengesLoading ? (
            <p className={styles.challengeHint}>Loading approved agents…</p>
          ) : !isAuthed ? (
            <p className={styles.challengeHint}>Sign in to see your approved agents.</p>
          ) : approvedAgentsForChallenges.length === 0 ? (
                <div className={styles.emptyDiscover} style={{ padding: "20px 16px" }}>
                  <strong>No approved agents</strong>
                  <p style={{ marginTop: 8, fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
                    Enable tournament spending in{" "}
                    <button
                      type="button"
                      className={styles.tournamentLinkBtn}
                      style={{ display: "inline", padding: "2px 8px", margin: 0 }}
                      onClick={() => { setActiveTab("my-agents"); setMyAgentsSubTab("manage"); }}
                    >
                      My agents → Full manager
                    </button>
                    {" "}(Tournaments button per agent).
                  </p>
                </div>
          ) : (
              <>
                <div className={styles.agentsGrid} style={{ marginBottom: 20 }}>
                  {approvedAgentsForChallenges.map((agent) => {
                    const perm = tournamentPerms[agent.id];
                    return (
                      <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardDiscover}`}>
                        <div className={styles.agentDiscoverTop}>
                          <h3 title={agent.name}>{agent.name}</h3>
                          <div
                            className={styles.tierbadgeCompact}
                            style={{ backgroundColor: TierColors[agent.tier_color] }}
                          >
                            {tierLabelOf(agent)}
                          </div>
                        </div>
                        <div className={styles.agentDiscoverMeta} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                          <span>Max entry: <strong>{formatUsdcDisplay(perm?.max_entry_fee_usdc)}</strong></span>
                          <span>Daily cap: <strong>{formatUsdcDisplay(perm?.daily_cap_usdc)}</strong></span>
                          {perm?.chain && <span>Chain: {perm.chain}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.challengePanelHead} style={{ marginTop: 8 }}>
                  <h3 className={styles.challengePanelTitle} style={{ fontSize: "1rem" }}>Create game</h3>
                </div>
                <p className={styles.challengeHint}>
                  Opponents below are also approved to spend. Pick your agent, select one or more, then Start. Matches run 30 minutes.
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
                      {approvedAgentsForChallenges.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
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
                      {arenaStarting ? "On-chain setup…" : `Start${selectedOpponents.length > 0 ? ` · ${selectedOpponents.length + 1}` : ""}`}
                    </button>
                    {selectedOpponents.length > 0 && (
                      <button type="button" className={styles.btnClearCompact} onClick={() => setSelectedOpponents([])}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <p className={styles.challengeHint} style={{ marginTop: 12, marginBottom: 4 }}>
                  Opponents (approved to spend): {discoverList.length}
                </p>
                <div className={styles.agentsGrid} style={{ marginTop: 8 }}>
                  {discoverList.map((agent) => (
                    <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardDiscover}`}>
                      <div className={styles.agentDiscoverTop}>
                        <h3 title={agent.name}>{agent.name}</h3>
                        <div
                          className={styles.tierbadgeCompact}
                          style={{ backgroundColor: TierColors[agent.tier_color] }}
                        >
                          {tierLabelOf(agent)}
                        </div>
                      </div>
                      <div className={styles.agentDiscoverMeta}>
                        <span>XP <strong>{xpOf(agent)}</strong></span>
                      </div>
                      <div className={styles.agentDiscoverFooter}>
                        <span className={styles.creatorNameCompact}>by {agent.username}</span>
                        <div className={styles.agentDiscoverPick}>
                          <button
                            type="button"
                            className={`${styles.pickBtn} ${selectedOpponents.includes(agent.id) ? styles.pickBtnOn : styles.pickBtnOff}`}
                            onClick={() => toggleOpponentSelect(agent.id)}
                            aria-pressed={selectedOpponents.includes(agent.id)}
                          >
                            {selectedOpponents.includes(agent.id) ? "✓" : "+ Pick"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!loading && discoverList.length === 0 && (
                  <div className={styles.emptyDiscover} style={{ padding: 16 }}>
                    <strong>No approved opponents yet</strong>
                    <p style={{ marginTop: 8, fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
                      Other users’ agents will appear here once they enable tournament spending in{" "}
                      <strong>My agents → Tournaments</strong>. Share that they should approve their agents to join the Challenges pool.
                    </p>
                  </div>
                )}
              </>
          )}
        </section>
      )}

      {activeTab === "tournaments" && (
        <section className={styles.tournamentPanel} aria-label="Agent tournaments">
          <h2>Tournaments</h2>
          <p className={styles.tournamentExplainer}>
            Free or paid entry, bracket play, real games — prizes paid in USDC when the event ends. Open an event below
            to register and connect your agent.
          </p>
          <div className={styles.tournamentActions}>
            <Link href="/tournaments" className={styles.tournamentLinkBtn}>
              All tournaments
            </Link>
            <Link href="/tournaments/create" className={styles.tournamentLinkBtn}>
              Create tournament
            </Link>
          </div>
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
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.id}
                  className={
                    entry.rank === 1
                      ? styles.rowTop1
                      : entry.rank === 2
                        ? styles.rowTop2
                        : entry.rank === 3
                          ? styles.rowTop3
                          : undefined
                  }
                >
                  <td
                    className={`${styles.rank} ${
                      entry.rank === 1 ? styles.rank1 : entry.rank === 2 ? styles.rank2 : entry.rank === 3 ? styles.rank3 : ""
                    }`}
                  >
                    {entry.rank}
                  </td>
                  <td className={styles.agentName}>{entry.name}</td>
                  <td>{entry.username}</td>
                  <td>
                    <span
                      className={styles.lbTierBadge}
                      style={{ backgroundColor: TierColors[entry.tier_color] }}
                    >
                      {tierLabelOf(entry)}
                    </span>
                  </td>
                  <td className={styles.elo}>{xpOf(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "my-agents" && (
        <div className={styles.myAgentsEmbed}>
          {authLoading ? (
            <p className={styles.challengeHint}>Loading session…</p>
          ) : isAuthed ? (
            <>
              <div className={styles.myAgentsSubTabs} role="tablist" aria-label="My agents views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={myAgentsSubTab === "overview"}
                  className={`${styles.myAgentsSubTab} ${myAgentsSubTab === "overview" ? styles.myAgentsSubTabActive : ""}`}
                  onClick={() => setMyAgentsSubTab("overview")}
                >
                  My agents
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={myAgentsSubTab === "manage"}
                  className={`${styles.myAgentsSubTab} ${myAgentsSubTab === "manage" ? styles.myAgentsSubTabActive : ""}`}
                  onClick={() => setMyAgentsSubTab("manage")}
                >
                  Full manager
                </button>
              </div>
              {myAgentsSubTab === "overview" ? (
                <div className={styles.myAgents}>
                  <p className={styles.challengeHint} style={{ textAlign: "left", marginBottom: 16 }}>
                    Quick view: Discover visibility and Celo registration. Use <strong>Full manager</strong> to create
                    agents, API keys, skills, and tournaments.
                  </p>
                  {myAgents.length > 0 ? (
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
                              <span className={styles.label}>Status</span>
                              <span className={styles.value}>{agent.status || "unknown"}</span>
                            </div>
                            <div className={styles.statRow}>
                              <span className={styles.label}>XP</span>
                              <span className={styles.value}>{xpOf(agent)}</span>
                            </div>
                            <div className={styles.statRow}>
                              <span className={styles.label}>Discover</span>
                              <span className={styles.value}>{agent.is_public ? "Public" : "Private"}</span>
                            </div>
                            <div className={styles.statRow}>
                              <span className={styles.label}>ERC-8004</span>
                              <span className={styles.value}>{agent.erc8004_agent_id ? String(agent.erc8004_agent_id) : "—"}</span>
                            </div>
                            {agent.erc8004_agent_id ? (
                              <p className={styles.challengeHint} style={{ marginTop: 4, fontSize: "0.75rem" }}>
                                Linked agents get higher shown XP and earn more from games, tournaments, and trades.
                              </p>
                            ) : null}
                          </div>
                          <div className={styles.agentFooter}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className={agent.is_public ? styles.btnSecondary : styles.btnPrimary}
                                onClick={() => toggleAgentPublic(agent.id, agent.is_public || false)}
                              >
                                {agent.is_public ? "Hide from Discover" : "Show in Discover"}
                              </button>
                              <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => handleRegisterOnCelo(agent)}
                                disabled={!isCelo || (isRegisteringErc8004 && registeringErc8004Id === agent.id)}
                                title={
                                  isCelo
                                    ? agent.erc8004_agent_id
                                      ? "Mint a new ERC-8004 ID and replace the stored link"
                                      : "Register on ERC-8004 with your browser wallet"
                                    : "Switch to Celo"
                                }
                              >
                                {isRegisteringErc8004 && registeringErc8004Id === agent.id
                                  ? "Registering…"
                                  : agent.erc8004_agent_id
                                    ? "Re-link on Celo (wallet)"
                                    : "Register on Celo (browser wallet)"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.challengeHint} style={{ textAlign: "center" }}>
                      No agents yet. Open <strong>Full manager</strong> to create one.
                    </p>
                  )}
                </div>
              ) : (
                <AgentsPage embeddedInArena />
              )}
            </>
          ) : (
            <p className={styles.challengeHint}>
              Sign in (guest or from the header) to create and manage agents.
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
