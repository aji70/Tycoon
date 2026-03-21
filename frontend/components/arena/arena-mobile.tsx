"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ARENA_TOURNAMENTS_COMING_SOON } from "@/constants/arena";
import { useRouter } from "next/navigation";
import { apiClient, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS, ApiError } from "@/lib/api";
import { ArenaOnchainModal, type ArenaOnchainBusyPayload } from "@/components/arena/arena-onchain-modal";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useRegisterAgentERC8004, useVerifyErc8004AgentId } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";
import styles from "./arena-mobile.module.css";
import AgentsPageMobile from "@/components/agents/agents-page-mobile";
import { Swords, Search, Trophy, Target, UserRound, Zap, Wallet } from "lucide-react";

const MAX_DISCOVER_OPPONENTS = 7;
const MAX_CHALLENGES_OPPONENTS = 1;

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
  max_entry_fee_usdc?: string | null;
  daily_cap_usdc?: string | null;
  chain?: string | null;
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

export default function ArenaMobile() {
  const router = useRouter();
  const guestCtx = useGuestAuthOptional();
  const guestUser = guestCtx?.guestUser ?? null;
  const authLoading = guestCtx?.isLoading ?? false;
  const isAuthed = Boolean(guestUser);
  const [activeTab, setActiveTab] = useState<"discover" | "challenges" | "leaderboard" | "tournaments" | "my-agents">("discover");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);
  const [challengerAgentId, setChallengerAgentId] = useState<number | null>(null);
  const [stakeAmountUsdc, setStakeAmountUsdc] = useState("");
  const [arenaStarting, setArenaStarting] = useState(false);
  const [humanVsOpponentId, setHumanVsOpponentId] = useState<number | null>(null);
  const [humanVsStakeUsdc, setHumanVsStakeUsdc] = useState("");
  const [humanVsStarting, setHumanVsStarting] = useState(false);
  const [challengesSubTab, setChallengesSubTab] = useState<"agentVsAgent" | "youVsAgent">("agentVsAgent");
  const [arenaTxModalOpen, setArenaTxModalOpen] = useState(false);
  const [arenaTxBusy, setArenaTxBusy] = useState<ArenaOnchainBusyPayload | null>(null);
  const [openTournaments, setOpenTournaments] = useState<ArenaTournamentRow[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);
  const [myAgentsSubTab, setMyAgentsSubTab] = useState<"overview" | "manage">("overview");
  const [openTournamentSpendingJumpAgentId, setOpenTournamentSpendingJumpAgentId] = useState<number | null>(null);
  const clearTournamentSpendingJump = useCallback(() => {
    setOpenTournamentSpendingJumpAgentId(null);
  }, []);
  const [tournamentPerms, setTournamentPerms] = useState<Record<number, { enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }>>({});
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [registeringErc8004Id, setRegisteringErc8004Id] = useState<number | null>(null);
  const { register: registerOnCelo, isPending: isRegisteringErc8004 } = useRegisterAgentERC8004();
  const { isCelo } = useVerifyErc8004AgentId();

  const maxOpponentPicks = activeTab === "discover" ? MAX_DISCOVER_OPPONENTS : MAX_CHALLENGES_OPPONENTS;

  useEffect(() => {
    const max = activeTab === "discover" ? MAX_DISCOVER_OPPONENTS : MAX_CHALLENGES_OPPONENTS;
    setSelectedOpponents((prev) => (prev.length > max ? prev.slice(0, max) : prev));
  }, [activeTab]);

  const mergeTournamentPermsFromApiResponse = useCallback((permsRes: unknown) => {
    const list =
      (permsRes as { data?: { data?: unknown } })?.data?.data ?? (permsRes as { data?: unknown })?.data ?? [];
    const arr = Array.isArray(list) ? list : [];
    const map: Record<number, { enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }> = {};
    for (const p of arr as Array<{ user_agent_id?: number; enabled?: boolean; max_entry_fee_usdc?: string; daily_cap_usdc?: string | null; chain?: string | null }>) {
      if (p?.user_agent_id != null) {
        map[Number(p.user_agent_id)] = {
          enabled: !!p.enabled,
          max_entry_fee_usdc: p.max_entry_fee_usdc ?? "0",
          daily_cap_usdc: p.daily_cap_usdc ?? null,
          chain: p.chain ?? null,
        };
      }
    }
    setTournamentPerms(map);
  }, []);

  const refreshArenaTournamentPerms = useCallback(async () => {
    try {
      const permsRes = await apiClient.get("/agents/tournament-permissions");
      mergeTournamentPermsFromApiResponse(permsRes);
    } catch (e) {
      console.error("Refresh tournament permissions:", e);
    }
  }, [mergeTournamentPermsFromApiResponse]);

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
    if ((activeTab === "discover" || activeTab === "challenges") && isAuthed) {
      fetchMyAgents();
    }
  }, [activeTab, isAuthed]);

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
    if (ARENA_TOURNAMENTS_COMING_SOON) return;
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
          apiClient.get("/agents/tournament-permissions"),
        ]);
        if (cancelled) return;
        if (agentsRes?.data?.success && agentsRes.data.data) setMyAgents(agentsRes.data.data);
        mergeTournamentPermsFromApiResponse(permsRes);
      } catch (e) {
        console.error("Challenges fetch:", e);
      } finally {
        if (!cancelled) setChallengesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuthed, mergeTournamentPermsFromApiResponse]);

  useEffect(() => {
    if (activeTab !== "discover" || !isAuthed) return;
    let cancelled = false;
    (async () => {
      try {
        const permsRes = await apiClient.get("/agents/tournament-permissions");
        if (!cancelled) mergeTournamentPermsFromApiResponse(permsRes);
      } catch (e) {
        console.error("Discover tournament permissions:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuthed, mergeTournamentPermsFromApiResponse]);

  useEffect(() => {
    if (activeTab !== "my-agents" || !isAuthed) return;
    let cancelled = false;
    (async () => {
      try {
        const [agentsRes, permsRes] = await Promise.all([
          apiClient.get<ApiResponse<Agent[]>>("/agents"),
          apiClient.get("/agents/tournament-permissions"),
        ]);
        if (cancelled) return;
        if (agentsRes?.data?.success && agentsRes.data.data) {
          setMyAgents(agentsRes.data.data);
        }
        mergeTournamentPermsFromApiResponse(permsRes);
      } catch (e) {
        console.error("Refresh my agents (overview):", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, myAgentsSubTab, isAuthed, mergeTournamentPermsFromApiResponse]);

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
        alert(updatedAgent.is_public ? "Now public in Discover" : "Hidden from Discover");
      } else {
        throw new Error("Failed to update");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const handleRegisterOnCelo = async (agent: Agent) => {
    if (!isCelo) {
      alert("Switch to Celo for ERC-8004.");
      return;
    }
    const existingId = agent.erc8004_agent_id ? String(agent.erc8004_agent_id).trim() : "";
    if (existingId) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          `Replace ERC-8004 ID ${existingId} with a new on-chain identity? The old ID will no longer be linked to this Tycoon agent.`
        );
      if (!ok) return;
    }
    setRegisteringErc8004Id(agent.id);
    try {
      const newAgentId = await registerOnCelo(agent.id);
      if (newAgentId == null) throw new Error("Could not read on-chain ID");
      await apiClient.patch(`/agents/${agent.id}`, { erc8004_agent_id: String(newAgentId) });
      await fetchMyAgents({ silent: true });
      if (activeTab === "discover") await fetchPublicAgents(page);
      if (activeTab === "leaderboard") await fetchLeaderboard();
      alert(existingId ? `Re-linked. New ID: ${newAgentId}` : `Celo ID: ${newAgentId}`);
    } catch (err) {
      alert(`Failed: ${(err as Error)?.message || "Unknown"}`);
    } finally {
      setRegisteringErc8004Id(null);
    }
  };

  const toggleOpponentSelect = (agentId: number) => {
    setSelectedOpponents((prev) => {
      if (prev.includes(agentId)) return prev.filter((id) => id !== agentId);
      if (prev.length >= maxOpponentPicks) {
        alert(
          maxOpponentPicks === 1
            ? "Challenges allow only one opponent. Clear your pick or use Discover for up to 7."
            : `Up to ${maxOpponentPicks} opponents in Discover.`
        );
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
    setArenaTxModalOpen(true);
    setArenaTxBusy(null);
    setArenaStarting(true);
    try {
      const stakeNum = stakeAmountUsdc.trim() ? parseFloat(stakeAmountUsdc) : 0;
      const res = await apiClient.post<any>(
        "/arena/start-game",
        {
          challenger_agent_id: challengerAgentId,
          opponent_agent_ids: selectedOpponents,
          arena_tab: activeTab,
          ...(stakeNum > 0 && { stake_amount_usdc: stakeNum }),
        },
        { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
      );
      const code = res?.data?.game_code as string | undefined;
      if (code) {
        setArenaTxModalOpen(false);
        setSelectedOpponents([]);
        router.push(`/board-3d-mobile?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code");
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409 && e.data?.code === "AGENT_BUSY_IN_ARENA") {
        setArenaTxBusy({ message: e.message });
      } else {
        setArenaTxModalOpen(false);
        alert(`Error: ${e.message || (err as Error).message}`);
      }
    } finally {
      setArenaStarting(false);
    }
  };

  const startHumanVsAgentGame = async () => {
    if (!isAuthed || !humanVsOpponentId) {
      alert("Sign in and pick an opponent (You play vs).");
      return;
    }
    setArenaTxModalOpen(true);
    setArenaTxBusy(null);
    setHumanVsStarting(true);
    try {
      const stakeNum = humanVsStakeUsdc.trim() ? parseFloat(humanVsStakeUsdc) : 0;
      const res = await apiClient.post<any>(
        "/arena/start-human-vs-agent",
        {
          opponent_agent_id: humanVsOpponentId,
          ...(stakeNum > 0 && { stake_amount_usdc: stakeNum }),
        },
        { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
      );
      const code = res?.data?.game_code as string | undefined;
      if (code) {
        setArenaTxModalOpen(false);
        setHumanVsOpponentId(null);
        setHumanVsStakeUsdc("");
        router.push(`/board-3d-mobile?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code");
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409 && e.data?.code === "AGENT_BUSY_IN_ARENA") {
        setArenaTxBusy({ message: e.message });
      } else {
        setArenaTxModalOpen(false);
        alert(`Error: ${e.message || (err as Error).message}`);
      }
    } finally {
      setHumanVsStarting(false);
    }
  };

  const discoverList = agents.filter((a) => !myAgents.some((m) => m.id === a.id));
  const selectedChallenger = myAgents.find((a) => a.id === challengerAgentId) ?? null;

  return (
    <div className={styles.pageShell}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.heroBadge}>
              <Swords className="w-3 h-3" aria-hidden />
              Arena
            </span>
            <h1 className={styles.heroTitle}>Agent Arena</h1>
            <p className={styles.heroSubtitle}>Challenge agents, climb ranks, join tournaments — create agents in Mine.</p>
            {isAuthed ? (
              <button
                type="button"
                className={styles.heroLink}
                onClick={() => {
                  setActiveTab("my-agents");
                  setMyAgentsSubTab("overview");
                }}
              >
                My agents
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
            <span className={styles.tabLabel}>Discover</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "challenges" ? styles.active : ""}`}
            onClick={() => setActiveTab("challenges")}
          >
            <span className={styles.tabIcon}>
              <Zap className="w-4 h-4" aria-hidden />
            </span>
            <span className={styles.tabLabel}>Challenges</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "leaderboard" ? styles.active : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            <span className={styles.tabIcon}>
              <Trophy className="w-4 h-4" aria-hidden />
            </span>
            <span className={styles.tabLabel}>Ranks</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "tournaments" ? styles.active : ""}`}
            onClick={() => setActiveTab("tournaments")}
          >
            <span className={styles.tabIcon}>
              <Target className="w-4 h-4" aria-hidden />
            </span>
            <span className={styles.tabLabel}>Tourneys</span>
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
            <span className={styles.tabLabel}>Mine</span>
          </button>
        </nav>

        {error && activeTab !== "my-agents" && activeTab !== "challenges" && <div className={styles.error}>{error}</div>}
        {loading && activeTab !== "my-agents" && activeTab !== "challenges" && <div className={styles.loading}>Loading</div>}

      {activeTab === "discover" && isAuthed && myAgents.length > 0 && (
        <section className={styles.challengePanel} aria-label="Challenge setup">
          <div className={styles.challengePanelHead}>
            <h2 className={styles.challengePanelTitle}>Challenges</h2>
            <span className={styles.challengeCountPill}>
              {selectedOpponents.length}/{maxOpponentPicks}
            </span>
          </div>
          <p className={styles.challengeHint}>
            <strong style={{ color: "#e8fbff" }}>Pick</strong> up to {maxOpponentPicks} opponent{maxOpponentPicks === 1 ? "" : "s"}, then{" "}
            <strong style={{ color: "#e8fbff" }}>Start</strong>. We register{" "}
            <strong style={{ color: "#e8fbff" }}>every seat on-chain</strong> (create, then each join), one confirmation
            at a time — often <strong style={{ color: "#e8fbff" }}>1–3 min</strong>. Matches run{" "}
            <strong style={{ color: "#e8fbff" }}>30 minutes</strong>; at time-up the winner is set by net worth and results
            are saved.{" "}
            <a href="/agent-battles" style={{ color: "#7ee8ff" }}>
              Agent Battles
            </a>{" "}
            uses a lobby first and often feels quicker. Wallet spending caps only apply to{" "}
            <strong style={{ color: "#e8fbff" }}>tournament entries</strong> and the <strong style={{ color: "#e8fbff" }}>Challenges</strong> tab — not required to start games here.
          </p>
          <label className={styles.challengeFieldLabel} htmlFor="arena-mobile-agent">
            Playing as
          </label>
          <select
            id="arena-mobile-agent"
            className={styles.agentSelect}
            value={challengerAgentId ?? ""}
            onChange={(e) => setChallengerAgentId(Number(e.target.value))}
          >
            {myAgents.map((a) => {
              const tp = tournamentPerms[a.id];
              const capHint =
                tp?.enabled === true
                  ? ` — ${formatUsdcDisplay(tp.max_entry_fee_usdc)}/match${
                      tp.daily_cap_usdc ? `, ${formatUsdcDisplay(tp.daily_cap_usdc)}/day` : ""
                    }`
                  : " — spending off";
              return (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {capHint}
                </option>
              );
            })}
          </select>
          {selectedChallenger && (
            <p className={styles.challengeHint} style={{ marginTop: -2, marginBottom: 10 }}>
              <strong style={{ color: "#e8fbff" }}>{selectedChallenger.name}</strong> · XP {xpOf(selectedChallenger)}
            </p>
          )}
          <div className={styles.challengeHint} style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <span>
              Caps: <strong style={{ color: "#e8fbff" }}>Mine</strong> → <strong style={{ color: "#e8fbff" }}>Tournament wallet spending</strong> on each card, or{" "}
              <strong style={{ color: "#e8fbff" }}>Manage</strong>.
            </span>
            {challengerAgentId != null && (
              <button
                type="button"
                className={styles.tournamentLinkBtn}
                style={{ alignSelf: "flex-start" }}
                onClick={() => {
                  setActiveTab("my-agents");
                  setMyAgentsSubTab("manage");
                  setOpenTournamentSpendingJumpAgentId(challengerAgentId);
                }}
              >
                Edit spending for selected agent
              </button>
            )}
          </div>
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

      {activeTab === "challenges" && (
        <>
          <section className={styles.challengePanel} aria-label="Approved agents and challenges">
            <div className={styles.challengePanelHead}>
              <h2 className={styles.challengePanelTitle}>Challenges</h2>
            </div>
            <p className={styles.challengeHint}>
              Agents approved to spend: <strong style={{ color: "#e8fbff" }}>max per match</strong> and optional{" "}
              <strong style={{ color: "#e8fbff" }}>daily total</strong>. Opponents in the pool also enabled spending.
            </p>
            <div className={styles.challengeSubTabs} role="tablist" aria-label="Challenge type">
              <button
                type="button"
                role="tab"
                aria-selected={challengesSubTab === "agentVsAgent"}
                className={`${styles.challengeSubTab} ${challengesSubTab === "agentVsAgent" ? styles.challengeSubTabActive : ""}`}
                onClick={() => setChallengesSubTab("agentVsAgent")}
              >
                Agent vs agent
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={challengesSubTab === "youVsAgent"}
                className={`${styles.challengeSubTab} ${challengesSubTab === "youVsAgent" ? styles.challengeSubTabActive : ""}`}
                onClick={() => setChallengesSubTab("youVsAgent")}
              >
                You vs agent
              </button>
            </div>

            {challengesSubTab === "agentVsAgent" && (
              <>
                {challengesLoading ? (
                  <p className={styles.challengeHint}>Loading…</p>
                ) : !isAuthed ? (
                  <p className={styles.challengeHint}>Sign in.</p>
                ) : approvedAgentsForChallenges.length === 0 ? (
                  <div className={styles.emptyState} style={{ padding: 16 }}>
                    <strong>No approved agents</strong>
                    <p style={{ marginTop: 8, fontSize: "0.85rem" }}>
                      Enable in{" "}
                      <button
                        type="button"
                        className={styles.tournamentLinkBtn}
                        style={{ display: "inline", padding: "2px 8px", margin: 0 }}
                        onClick={() => {
                          setActiveTab("my-agents");
                          setMyAgentsSubTab("manage");
                          if (myAgents.length === 1) setOpenTournamentSpendingJumpAgentId(myAgents[0].id);
                        }}
                      >
                        Mine → Manage &amp; spending
                      </button>
                      . Or use <strong style={{ color: "#e8fbff" }}>You vs agent</strong> to play without an agent seat.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={styles.agentsList} style={{ marginBottom: 12 }}>
                      {approvedAgentsForChallenges.map((agent) => {
                        const perm = tournamentPerms[agent.id];
                        return (
                          <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardDiscover}`}>
                            <div className={styles.agentDiscoverTop}>
                              <h3>{agent.name}</h3>
                              <div className={styles.tierbadgeCompact} style={{ backgroundColor: TierColors[agent.tier_color] }}>
                                {tierLabelOf(agent)}
                              </div>
                            </div>
                            <div className={styles.agentDiscoverMeta} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                              <span>Per match: {formatUsdcDisplay(perm?.max_entry_fee_usdc)}</span>
                              <span>Daily total: {formatUsdcDisplay(perm?.daily_cap_usdc)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <h3 className={styles.challengePanelTitle} style={{ fontSize: "0.95rem", marginTop: 8 }}>
                      Create game
                    </h3>
                    <p className={styles.challengeHint} style={{ marginBottom: 8 }}>
                      Select <strong style={{ color: "#e8fbff" }}>one</strong> opponent below. (Discover allows up to {MAX_DISCOVER_OPPONENTS}.)
                    </p>
                    <label className={styles.challengeFieldLabel}>Playing as</label>
                    <select
                      className={styles.agentSelect}
                      value={challengerAgentId ?? ""}
                      onChange={(e) => setChallengerAgentId(Number(e.target.value))}
                    >
                      {approvedAgentsForChallenges.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    {challengerAgentId != null && (
                      <button
                        type="button"
                        className={styles.tournamentLinkBtn}
                        style={{ marginTop: 8, width: "100%" }}
                        onClick={() => {
                          setActiveTab("my-agents");
                          setMyAgentsSubTab("manage");
                          setOpenTournamentSpendingJumpAgentId(challengerAgentId);
                        }}
                      >
                        Edit wallet spending for this agent
                      </button>
                    )}
                    <label className={styles.challengeFieldLabel} style={{ marginTop: 8 }}>
                      Stake (USDC)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0 = free"
                      value={stakeAmountUsdc}
                      onChange={(e) => setStakeAmountUsdc(e.target.value)}
                      className={styles.agentSelect}
                    />
                    <p className={styles.challengeHint} style={{ marginTop: 4 }}>
                      Staked 2-player: equal stake. Wins: 95%/5% house. Ties: split after draw house cut (env TOURNAMENT_DRAW_HOUSE_CUT_PERCENT, default 5%). 0 = free.
                    </p>
                    <div className={styles.challengeActionRow}>
                      <button
                        type="button"
                        className={styles.btnSendCompact}
                        onClick={startArenaGame}
                        disabled={arenaStarting || selectedOpponents.length === 0}
                      >
                        {arenaStarting ? "On-chain…" : `Start${selectedOpponents.length > 0 ? ` · ${selectedOpponents.length + 1}` : ""}`}
                      </button>
                      {selectedOpponents.length > 0 && (
                        <button type="button" className={styles.btnClearCompact} onClick={() => setSelectedOpponents([])}>
                          Clear
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {challengesSubTab === "youVsAgent" && (
              <>
                {!isAuthed ? (
                  <p className={styles.challengeHint}>Sign in to play yourself vs an agent.</p>
                ) : (
                  <div
                    className={styles.emptyState}
                    style={{
                      padding: 14,
                      marginBottom: 12,
                      border: "1px solid rgba(0, 255, 255, 0.25)",
                      borderRadius: 12,
                      background: "rgba(0, 40, 50, 0.35)",
                    }}
                  >
                    <h3 className={styles.challengePanelTitle} style={{ fontSize: "0.95rem", marginBottom: 6 }}>
                      You vs agent (play yourself)
                    </h3>
                    <p className={styles.challengeHint} style={{ marginBottom: 10 }}>
                      You take <strong style={{ color: "#e8fbff" }}>seat 1</strong>; the agent auto-plays seat 2. With a stake, USDC is pulled from{" "}
                      <strong style={{ color: "#e8fbff" }}>your smart wallet</strong> and the opponent owner’s (same amount). Contract login + smart wallet; opponent needs tournament spending for staked games.
                    </p>
                    <label className={styles.challengeFieldLabel}>Stake (USDC, optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0 = free"
                      value={humanVsStakeUsdc}
                      onChange={(e) => setHumanVsStakeUsdc(e.target.value)}
                      className={styles.agentSelect}
                    />
                    <p className={styles.challengeHint} style={{ marginBottom: 8, fontSize: "0.8rem" }}>
                      Pick one opponent below, then start.
                    </p>
                    <div className={styles.challengeActionRow} style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className={styles.btnSendCompact}
                        onClick={startHumanVsAgentGame}
                        disabled={humanVsStarting || humanVsOpponentId == null || challengesLoading}
                      >
                        {humanVsStarting ? "On-chain…" : "Start — I play"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {challengesSubTab === "agentVsAgent" && approvedAgentsForChallenges.length > 0 && (
            <div className={styles.agentsList}>
              <div className={styles.sectionHead}>
                <h2>Opponents (approved to spend)</h2>
                <span>{discoverList.length}</span>
              </div>
              {discoverList.map((agent) => (
                <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardDiscover}`}>
                  <div className={styles.agentDiscoverTop}>
                    <h3>{agent.name}</h3>
                    <div className={styles.tierbadgeCompact} style={{ backgroundColor: TierColors[agent.tier_color] }}>
                      {tierLabelOf(agent)}
                    </div>
                  </div>
                  <div className={styles.agentDiscoverMeta} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span>
                      XP <strong>{xpOf(agent)}</strong>
                    </span>
                    <span>Max per match: {formatUsdcDisplay(agent.max_entry_fee_usdc)}</span>
                    <span>Daily total cap: {formatUsdcDisplay(agent.daily_cap_usdc)}</span>
                    {agent.chain && <span>Chain: {agent.chain}</span>}
                  </div>
                  <div className={styles.agentDiscoverFooter}>
                    <span className={styles.creatorNameCompact}>by {agent.username}</span>
                    {isAuthed && (
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
                    )}
                  </div>
                </div>
              ))}
              {discoverList.length === 0 && !loading && (
                <div className={styles.emptyState} style={{ padding: 16 }}>
                  <strong>No approved opponents yet</strong>
                  <p style={{ marginTop: 8, fontSize: "0.85rem" }}>
                    Others’ agents appear here when they enable tournament spending (My agents → Tournaments).
                  </p>
                </div>
              )}
            </div>
          )}

          {challengesSubTab === "youVsAgent" && isAuthed && (
            <div className={styles.agentsList}>
              <div className={styles.sectionHead}>
                <h2>Opponents (approved to spend)</h2>
                <span>{discoverList.length}</span>
              </div>
              {challengesLoading ? (
                <p className={styles.challengeHint} style={{ padding: 12 }}>
                  Loading…
                </p>
              ) : (
                <>
                  {discoverList.map((agent) => (
                    <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardDiscover}`}>
                      <div className={styles.agentDiscoverTop}>
                        <h3>{agent.name}</h3>
                        <div className={styles.tierbadgeCompact} style={{ backgroundColor: TierColors[agent.tier_color] }}>
                          {tierLabelOf(agent)}
                        </div>
                      </div>
                      <div className={styles.agentDiscoverMeta} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                        <span>
                          XP <strong>{xpOf(agent)}</strong>
                        </span>
                        <span>Max per match: {formatUsdcDisplay(agent.max_entry_fee_usdc)}</span>
                        <span>Daily total cap: {formatUsdcDisplay(agent.daily_cap_usdc)}</span>
                        {agent.chain && <span>Chain: {agent.chain}</span>}
                      </div>
                      <div className={styles.agentDiscoverFooter}>
                        <span className={styles.creatorNameCompact}>by {agent.username}</span>
                        <div className={styles.agentDiscoverPick}>
                          <button
                            type="button"
                            className={`${styles.pickBtn} ${humanVsOpponentId === agent.id ? styles.pickBtnOn : styles.pickBtnOff}`}
                            onClick={() => setHumanVsOpponentId((id) => (id === agent.id ? null : agent.id))}
                            aria-pressed={humanVsOpponentId === agent.id}
                          >
                            {humanVsOpponentId === agent.id ? "✓ You play" : "You play vs"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {discoverList.length === 0 && !loading && (
                    <div className={styles.emptyState} style={{ padding: 16 }}>
                      <strong>No approved opponents yet</strong>
                      <p style={{ marginTop: 8, fontSize: "0.85rem" }}>
                        Others’ agents appear here when they enable tournament spending.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "discover" && (
        <div className={styles.agentsList}>
          <div className={styles.sectionHead}>
            <h2>Public Agents</h2>
            <span>{discoverList.length}</span>
          </div>
          {discoverList.map((agent) => (
            <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardDiscover}`}>
              <div className={styles.agentDiscoverTop}>
                <div className={styles.nameBlock}>
                  <h3 title={agent.name}>{agent.name}</h3>
                </div>
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
          {discoverList.length === 0 && !loading && (
            <p className={styles.emptyState}>No agents found</p>
          )}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className={styles.leaderboardList}>
          <div className={styles.sectionHead}>
            <h2>Top Agents</h2>
            <span>{leaderboard.length}</span>
          </div>
          {leaderboard.map((entry) => (
            <div key={entry.id} className={styles.leaderboardItem}>
              <div className={styles.rankSection}>
                <span className={styles.rank}>#{entry.rank}</span>
                <div
                  className={styles.tierBadge}
                  style={{ backgroundColor: TierColors[entry.tier_color] }}
                >
                  {tierLabelOf(entry)}
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
          {ARENA_TOURNAMENTS_COMING_SOON ? (
            <>
              <p className={styles.tournamentComingSoonBadge} role="status">
                Coming soon
              </p>
              <p className={styles.tournamentExplainer}>
                Bracket tournaments and registration aren&apos;t available in the Arena yet. We&apos;ll turn on browse,
                create, and join here in a future update.
              </p>
              <div className={styles.tournamentActions}>
                <button type="button" disabled className={`${styles.tournamentLinkBtn} ${styles.tournamentBtnDisabled}`}>
                  <span>Browse all</span>
                  <span className={styles.tournamentBtnSoon}>Coming soon</span>
                </button>
                <button type="button" disabled className={`${styles.tournamentLinkBtn} ${styles.tournamentBtnDisabled}`}>
                  <span>Create one</span>
                  <span className={styles.tournamentBtnSoon}>Coming soon</span>
                </button>
              </div>
              <p className={styles.tournamentEmpty}>Full tournament flows will show here when we launch.</p>
            </>
          ) : (
            <>
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
            </>
          )}
        </section>
      )}

      {activeTab === "my-agents" && (
        <div className={styles.myAgentsEmbed}>
          {authLoading ? (
            <p className={styles.emptyState}>Loading session…</p>
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
                  Quick
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={myAgentsSubTab === "manage"}
                  className={`${styles.myAgentsSubTab} ${myAgentsSubTab === "manage" ? styles.myAgentsSubTabActive : ""}`}
                  onClick={() => setMyAgentsSubTab("manage")}
                >
                  Manage
                </button>
              </div>
              {myAgentsSubTab === "overview" ? (
                <div className={styles.myAgentsList}>
                  <div className={styles.myAgentsQuickIntro}>
                    <p className={styles.myAgentsQuickIntroTitle}>At a glance</p>
                    <p className={styles.myAgentsQuickIntroText}>
                      Wallet caps limit USDC for tournaments and staked games. <strong style={{ color: "#b8f7ff" }}>Manage</strong> for API keys and new agents.
                    </p>
                  </div>
                  {myAgents.length > 0 ? (
                    myAgents.map((agent) => {
                      const tp = tournamentPerms[agent.id];
                      const spendOn = Boolean(tp?.enabled);
                      return (
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
                            {tierLabelOf(agent)}
                          </div>
                        </div>
                        <div className={styles.spendChipRow}>
                          <span className={`${styles.spendChip} ${spendOn ? styles.spendChipOn : styles.spendChipOff}`}>
                            <Wallet className="w-3 h-3 shrink-0" aria-hidden />
                            {spendOn ? "Caps on" : "Caps off"}
                          </span>
                          {spendOn && tp ? (
                            <span className={`${styles.spendChip} ${styles.spendChipOn}`} style={{ opacity: 0.92 }}>
                              {formatUsdcDisplay(tp.max_entry_fee_usdc)}/match
                              {tp.daily_cap_usdc ? ` · ${formatUsdcDisplay(tp.daily_cap_usdc)}/d` : ""}
                            </span>
                          ) : null}
                        </div>
                        <div className={styles.statsRow}>
                          <div className={styles.stat}>
                            <span className={styles.label}>XP</span>
                            <span className={styles.value}>{xpOf(agent)}</span>
                          </div>
                          <div className={styles.stat}>
                            <span className={styles.label}>Discover</span>
                            <span className={styles.value}>{agent.is_public ? "On" : "Off"}</span>
                          </div>
                        </div>
                        <p className={styles.creator} style={{ marginTop: 6 }}>
                          ERC-8004: {agent.erc8004_agent_id ? String(agent.erc8004_agent_id) : "—"}
                        </p>
                        {agent.erc8004_agent_id ? (
                          <p className={styles.challengeHint} style={{ fontSize: "0.7rem", marginTop: 4 }}>
                            Linked: higher shown XP + extra activity XP from play.
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className={agent.is_public ? styles.btnSecondary : styles.btnPrimary}
                          onClick={() => toggleAgentPublic(agent.id, agent.is_public || false)}
                          style={{ width: "100%" }}
                        >
                          {agent.is_public ? "Hide from Discover" : "Show in Discover"}
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => handleRegisterOnCelo(agent)}
                          style={{ width: "100%", marginTop: 8 }}
                          disabled={!isCelo || (isRegisteringErc8004 && registeringErc8004Id === agent.id)}
                        >
                          {isRegisteringErc8004 && registeringErc8004Id === agent.id
                            ? "Registering…"
                            : agent.erc8004_agent_id
                              ? "Re-link on Celo (wallet)"
                              : "Register on Celo (browser wallet)"}
                        </button>
                        <button
                          type="button"
                          className={styles.walletCapsCta}
                          onClick={() => {
                            setMyAgentsSubTab("manage");
                            setOpenTournamentSpendingJumpAgentId(agent.id);
                          }}
                        >
                          <Trophy className="w-4 h-4 shrink-0" aria-hidden />
                          {spendOn ? "Edit wallet spending caps" : "Set up wallet spending"}
                        </button>
                      </div>
                      );
                    })
                  ) : (
                    <p className={styles.emptyState}>No agents — use Manage to create one.</p>
                  )}
                </div>
              ) : (
                <AgentsPageMobile
                  embeddedInArena
                  onSpendingCapsSaved={refreshArenaTournamentPerms}
                  openTournamentSpendingForAgentId={openTournamentSpendingJumpAgentId}
                  onTournamentSpendingModalOpened={clearTournamentSpendingJump}
                />
              )}
            </>
          ) : (
            <p className={styles.emptyState}>Sign in to create and manage agents.</p>
          )}
        </div>
      )}
      </div>

      <ArenaOnchainModal
        open={arenaTxModalOpen}
        busy={arenaTxBusy}
        isMobile
        onClose={() => {
          setArenaTxModalOpen(false);
          setArenaTxBusy(null);
        }}
      />
    </div>
  );
}
