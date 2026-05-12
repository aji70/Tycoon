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
import styles from "./arena.module.css";
import ArenaMobile from "@/components/arena/arena-mobile";
import AgentsPage from "@/components/agents/agents-page";
import { isAgentStyleTournament, tournamentDetailPath } from "@/lib/tournamentRoutes";
import { ArenaStage1NoAgent } from "@/components/arena/arena-stage-1-no-agent";
import { ArenaStage3NoCaps } from "@/components/arena/arena-stage-3-no-caps";
import { ArenaTabBar } from "@/components/arena/arena-tab-bar";
import { ArenaDiscoverTab } from "@/components/arena/arena-discover-tab";
import { ArenaLeaderboardTab } from "@/components/arena/arena-leaderboard-tab";
import { ArenaMyAgentsTab } from "@/components/arena/arena-my-agents-tab";
import { ArenaChallengesTab } from "@/components/arena/arena-challenges-tab";
import { Swords } from "lucide-react";

/** Multi-opponent batch games from Discover tab. */
const MAX_DISCOVER_OPPONENTS = 7;
/** Challenges tab (approved pool) is one opponent per game. */
const MAX_CHALLENGES_OPPONENTS = 1;

interface ArenaTournamentRow {
  id: number;
  code?: string | null;
  name: string;
  status: string;
  chain: string;
  entry_fee_wei: string | number;
  prize_source?: string;
  visibility?: string;
  is_agent_only?: boolean;
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
  return tournamentDetailPath({
    id: t.id,
    code: t.code ?? undefined,
    visibility: t.visibility as "OPEN" | "INVITE_ONLY" | "BOT_SELECTION" | undefined,
    is_agent_only: t.is_agent_only,
  });
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
  const [stakeAmountUsdc, setStakeAmountUsdc] = useState("");
  const [arenaStarting, setArenaStarting] = useState(false);
  /** You play seat 1 vs one opponent agent (seat 2 auto-plays). */
  const [humanVsOpponentId, setHumanVsOpponentId] = useState<number | null>(null);
  const [humanVsStakeUsdc, setHumanVsStakeUsdc] = useState("");
  const [humanVsStarting, setHumanVsStarting] = useState(false);
  /** Sub-mode under Challenges tab */
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
          tournament_kind: "agent",
        });
        const body = res?.data as unknown;
        const raw: ArenaTournamentRow[] = Array.isArray(body)
          ? body
          : body != null && typeof body === "object" && "data" in body && Array.isArray((body as { data: ArenaTournamentRow[] }).data)
            ? (body as { data: ArenaTournamentRow[] }).data
            : [];
        // Arena tab: bot/agent events only (never show human brackets, even if API omits tournament_kind).
        const list = raw.filter((t) =>
          isAgentStyleTournament({
            visibility: t.visibility as "OPEN" | "INVITE_ONLY" | "BOT_SELECTION" | undefined,
            is_agent_only: t.is_agent_only,
          })
        );
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
      if (prev.length >= maxOpponentPicks) {
        alert(
          maxOpponentPicks === 1
            ? "Challenges allow only one opponent per game. Clear your pick or use Discover for multi-opponent games."
            : `You can select up to ${maxOpponentPicks} opponents per batch in Discover.`
        );
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
        router.push(`/board-3d?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code returned");
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
    if (!isAuthed) {
      alert("Please log in first.");
      return;
    }
    if (!humanVsOpponentId) {
      alert("Pick an opponent agent below.");
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
        router.push(`/board-3d?gameCode=${encodeURIComponent(code)}`);
      } else {
        throw new Error("No game code returned");
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

  if (isMobile) {
    return <ArenaMobile />;
  }

  // STAGE DETECTION
  const hasAgents = myAgents.length > 0;
  const hasSpendingCaps = approvedAgentIds.length > 0;

  // STAGE 1: No agents
  if (!hasAgents && isAuthed) {
    return <ArenaStage1NoAgent />;
  }

  // STAGE 3: Agent exists but no spending caps
  if (hasAgents && !hasSpendingCaps && activeTab !== "discover" && activeTab !== "leaderboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 p-8">
        <ArenaStage3NoCaps
          myAgents={myAgents}
          onTabChange={setActiveTab}
          onOpenManageCaps={(agentId) => {
            setActiveTab("my-agents");
            setMyAgentsSubTab("manage");
            setOpenTournamentSpendingJumpAgentId(agentId);
          }}
        />
      </div>
    );
  }

  const discoverList = agents.filter((agent) => !myAgents.some((m) => m.id === agent.id));
  const hasNextDiscoverPage = agents.length >= 20;

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

        <ArenaTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasSpendingCaps={hasSpendingCaps}
        />

        {activeTab === "discover" && (
          <ArenaDiscoverTab
            agents={agents}
            myAgents={myAgents}
            selectedOpponents={selectedOpponents}
            onToggleSelect={toggleOpponentSelect}
            onStartMatch={startArenaGame}
            challengerAgentId={challengerAgentId}
            onChangeChallengerAgent={setChallengerAgentId}
            stakeAmount={stakeAmountUsdc}
            onStakeChange={setStakeAmountUsdc}
            isStarting={arenaStarting}
            page={page}
            onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => p + 1)}
            hasNextPage={agents.length >= 20}
          />
        )}

        {activeTab === "challenges" && (
          <ArenaChallengesTab
            agents={discoverList}
            myAgents={myAgents}
            tournamentPerms={tournamentPerms}
            subMode={challengesSubTab}
            onSubModeChange={setChallengesSubTab}
            challengerAgentId={challengerAgentId}
            onChangeChallengerAgent={setChallengerAgentId}
            selectedOpponent={humanVsOpponentId}
            onSelectOpponent={(id) => setHumanVsOpponentId((curr) => (curr === id ? null : id))}
            stakeAmount={challengesSubTab === "agentVsAgent" ? stakeAmountUsdc : humanVsStakeUsdc}
            onStakeChange={challengesSubTab === "agentVsAgent" ? setStakeAmountUsdc : setHumanVsStakeUsdc}
            onDeploy={challengesSubTab === "agentVsAgent" ? startArenaGame : startHumanVsAgentGame}
            isDeploying={challengesSubTab === "agentVsAgent" ? arenaStarting : humanVsStarting}
          />
        )}

        {activeTab === "leaderboard" && (
          <ArenaLeaderboardTab
            leaderboard={leaderboard}
            loading={loading}
            myAgentId={challengerAgentId ?? undefined}
          />
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
                  Bracket tournaments, registration, and prize pools are not available in the Arena yet. We&apos;ll enable
                  browsing, creating events, and joining from here in a future release.
                </p>
                <div className={styles.tournamentActions}>
                  <button type="button" disabled className={`${styles.tournamentLinkBtn} ${styles.tournamentBtnDisabled}`}>
                    <span>All tournaments</span>
                    <span className={styles.tournamentBtnSoon}>Coming soon</span>
                  </button>
                  <button type="button" disabled className={`${styles.tournamentLinkBtn} ${styles.tournamentBtnDisabled}`}>
                    <span>Create tournament</span>
                    <span className={styles.tournamentBtnSoon}>Coming soon</span>
                  </button>
                </div>
                <p className={styles.tournamentEmpty}>Open registration and full tournament flows will appear here when we launch.</p>
              </>
            ) : (
              <>
                <p className={styles.tournamentExplainer}>
                  Agent tournaments only: your bot represents you (same smart-wallet flow as Challenges). Invited-bots events
                  only allow the Discover agents the organizer picked; open agent-only events accept any registered agent. Open
                  an event to pick your agent and join.
                </p>
                <div className={styles.tournamentActions}>
                  <Link href="/agent-tournaments" className={styles.tournamentLinkBtn}>
                    All agent tournaments
                  </Link>
                  <Link href="/agent-tournaments/create?from=arena" className={styles.tournamentLinkBtn}>
                    Create agent tournament
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
                            {String(t.visibility || "").toUpperCase() === "BOT_SELECTION"
                              ? " · invited bots"
                              : t.is_agent_only
                                ? " · open · agents only"
                                : ""}
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
              </>
            )}
          </section>
        )}

        {activeTab === "my-agents" && (
          myAgentsSubTab === "manage" ? (
            <AgentsPage
              embeddedInArena
              onSpendingCapsSaved={refreshArenaTournamentPerms}
              openTournamentSpendingForAgentId={openTournamentSpendingJumpAgentId}
              onTournamentSpendingModalOpened={clearTournamentSpendingJump}
            />
          ) : (
            <ArenaMyAgentsTab
              myAgents={myAgents}
              tournamentPerms={tournamentPerms}
              subTab={myAgentsSubTab}
              onSubTabChange={setMyAgentsSubTab}
              onTogglePublic={toggleAgentPublic}
              onOpenManageCaps={(agentId) => {
                setMyAgentsSubTab("manage");
                setOpenTournamentSpendingJumpAgentId(agentId);
              }}
              onRegisterOnCelo={handleRegisterOnCelo}
              isRegisteringId={registeringErc8004Id}
            />
          )
        )}
      </div>

      <ArenaOnchainModal
        open={arenaTxModalOpen}
        busy={arenaTxBusy}
        isMobile={false}
        onClose={() => {
          setArenaTxModalOpen(false);
          setArenaTxBusy(null);
        }}
      />
    </div>
  );
}
