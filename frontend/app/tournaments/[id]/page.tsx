"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { useFundPrizePool } from "@/hooks/useFundPrizePool";
import { useTournament } from "@/context/TournamentContext";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useRegisterForTournamentOnChain } from "@/hooks/useRegisterForTournamentOnChain";
import {
  ChevronLeft,
  Loader2,
  Swords,
  Users,
  Trophy,
  UserPlus,
  Lock,
  Play,
  AlertCircle,
  Wallet,
  WalletMinimal,
  CheckCircle2,
  CircleDashed,
  Eye,
  Sparkles,
  Radio,
} from "lucide-react";
import type { Bracket, BracketRound, TournamentDetail, TournamentEntry } from "@/types/tournament";
import { symbols as symbolOptions } from "@/lib/types/symbol";
import { apiClient } from "@/lib/api";
import { useUserRegistryWallet } from "@/context/ContractProvider";
import type { ApiResponse } from "@/types/api";

function formatEntryFee(wei: string | number): string {
  const n = Number(wei);
  if (n === 0) return "Free";
  const usd = n / 1e6;
  if (usd >= 0.01) return `$${usd.toFixed(2)} USDC`;
  if (usd > 0) return `$${usd.toFixed(4)} USDC`;
  return `${n} wei`;
}

const USDC_DECIMALS = 6;

function chainIdToBackendChain(chainId: number): string {
  if (chainId === 137 || chainId === 80001) return "POLYGON";
  if (chainId === 42220 || chainId === 44787) return "CELO";
  if (chainId === 8453 || chainId === 84531) return "BASE";
  return "CELO";
}

function statusColor(status: string): string {
  switch (status) {
    case "REGISTRATION_OPEN":
      return "text-emerald-400";
    case "BRACKET_LOCKED":
    case "IN_PROGRESS":
      return "text-amber-400";
    case "COMPLETED":
      return "text-cyan-400";
    case "CANCELLED":
      return "text-red-400";
    default:
      return "text-white/70";
  }
}

function tournamentEntryDisplay(e: {
  agent_name?: string | null;
  username?: string | null;
  address?: string | null;
} | null | undefined): string {
  if (!e) return "";
  const n = e.agent_name != null && String(e.agent_name).trim() !== "" ? String(e.agent_name).trim() : "";
  return n || (e.username ?? "") || (e.address ?? "") || "";
}

function extractTournamentPathFromMessage(message: string | null): string | null {
  if (!message) return null;
  const match = message.match(/(\/tournaments\/[A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

/** URL slug is numeric id or tournament invite code — not `Number(id)` (alphanumeric codes become NaN). */
function tournamentMatchesRouteId(t: TournamentDetail, routeId: string): boolean {
  const rid = String(routeId ?? "").trim();
  if (!rid) return false;
  if (String(t.id) === rid) return true;
  return String(t.code ?? "").toUpperCase() === rid.toUpperCase();
}

/** Build bracket from tournament detail (rounds + matches + entries) so players see bracket even if bracket API fails or is slow. */
function buildBracketFromTournament(t: TournamentDetail | null): Bracket | null {
  if (!t?.rounds?.length || !Array.isArray(t.matches)) return null;
  const entryMap = new Map((t.entries ?? []).map((e) => [e.id, e]));
  const rounds: BracketRound[] = t.rounds
    .slice()
    .sort((a, b) => (a.round_index ?? 0) - (b.round_index ?? 0))
    .map((r) => {
      const roundMatches = t.matches.filter((m) => m.round_index === r.round_index);
      return {
        round_index: r.round_index,
        status: r.status,
        scheduled_start_at: r.scheduled_start_at ?? null,
        matches: roundMatches.map((m) => ({
          id: m.id,
          match_index: m.match_index,
          slot_a_entry_id: m.slot_a_entry_id,
          slot_b_entry_id: m.slot_b_entry_id,
          participant_entry_ids: m.participant_entry_ids ?? null,
          slot_a_type: m.slot_a_type,
          slot_b_type: m.slot_b_type,
          winner_entry_id: m.winner_entry_id,
          game_id: m.game_id,
          contract_game_id: m.contract_game_id ?? null,
          status: m.status,
          spectator_token: m.spectator_token ?? null,
          spectator_url: m.spectator_url ?? null,
          slot_a_username: m.slot_a_entry_id
            ? tournamentEntryDisplay(entryMap.get(m.slot_a_entry_id)) || null
            : null,
          slot_b_username: m.slot_b_entry_id
            ? tournamentEntryDisplay(entryMap.get(m.slot_b_entry_id)) || null
            : null,
          winner_username: m.winner_entry_id
            ? tournamentEntryDisplay(entryMap.get(m.winner_entry_id)) || null
            : null,
          match_game_type: m.match_game_type ?? null,
        })),
      };
    });
  return { tournament: { id: t.id, name: t.name, status: t.status }, rounds };
}

type BracketMatchRow = BracketRound["matches"][number];

function bracketMatchParticipantIds(m: BracketMatchRow): number[] {
  const pe = m.participant_entry_ids;
  if (Array.isArray(pe) && pe.length >= 2) {
    return pe;
  }
  return [m.slot_a_entry_id, m.slot_b_entry_id].filter((x): x is number => x != null);
}

/** Match is fully decided — no spectate / play links. */
function isBracketMatchTerminal(m: BracketMatchRow): boolean {
  if (m.status === "BYE") return true;
  if (m.status === "COMPLETED") return true;
  if (m.winner_entry_id != null) return true;
  return false;
}

/** Active table: game exists and match not finished (avoids stale Spectate after finals). */
function bracketMatchIsLiveBoard(m: BracketMatchRow): boolean {
  if (m.game_id == null || isBracketMatchTerminal(m)) return false;
  return m.status === "IN_PROGRESS" || m.status === "AWAITING_PLAYERS";
}

/** Both sides known, not live, not terminal — “next” on the bracket. */
function isUpcomingBracketMatch(m: BracketMatchRow): boolean {
  if (isBracketMatchTerminal(m) || bracketMatchIsLiveBoard(m)) return false;
  return bracketMatchParticipantIds(m).length >= 2;
}

function labelsForMatchParticipants(m: BracketMatchRow, entries: TournamentEntry[] | undefined): string[] {
  const pids = bracketMatchParticipantIds(m);
  return pids.map((pid) => {
    const un =
      m.slot_a_entry_id === pid
        ? m.slot_a_username
        : m.slot_b_entry_id === pid
          ? m.slot_b_username
          : tournamentEntryDisplay(entries?.find((e) => e.id === pid));
    return un || `#${pid}`;
  });
}

export default function TournamentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const inviteQuery = searchParams.get("invite")?.trim() ?? "";
  const inviteParams = inviteQuery ? { invite: inviteQuery } : undefined;
  const { guestUser } = useGuestAuthOptional() ?? {};
  const { address: walletAddress } = useAccount();
  const walletChainId = useChainId();
  const { data: registrySmartWallet } = useUserRegistryWallet(walletAddress ?? undefined);
  const guestSmartWallet =
    guestUser?.smart_wallet_address &&
    String(guestUser.smart_wallet_address).trim() !== "0x0000000000000000000000000000000000000000"
      ? (guestUser.smart_wallet_address as `0x${string}`)
      : undefined;
  const registrySw =
    registrySmartWallet && String(registrySmartWallet).trim() !== "0x0000000000000000000000000000000000000000"
      ? (registrySmartWallet as `0x${string}`)
      : undefined;
  const smartWalletAddress = guestSmartWallet ?? registrySw;
  const { fund: fundPrizePoolOnChain, isPending: fundPoolPending, isReady: fundPoolReady, canUseSmartWallet } =
    useFundPrizePool(smartWalletAddress);
  const [registering, setRegistering] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const {
    tournament,
    bracket,
    leaderboard,
    detailLoading,
    detailError,
    bracketLoading,
    leaderboardLoading,
    fetchTournament,
    fetchBracket,
    fetchLeaderboard,
    registerForTournament,
    closeRegistration,
    startRound,
    requestMatchStart,
    createMatchGame,
    isRegistered,
  } = useTournament();

  const [startNowMatchId, setStartNowMatchId] = useState<number | null>(null);
  const [startNowModalMatchId, setStartNowModalMatchId] = useState<number | null>(null);
  const [selectedStartSymbol, setSelectedStartSymbol] = useState<string>("hat");
  const [creatingRoundIndex, setCreatingRoundIndex] = useState<number | null>(null);
  const [creatingMatchId, setCreatingMatchId] = useState<number | null>(null);
  const [fundPoolUsd, setFundPoolUsd] = useState("");
  const [fundPoolDepositing, setFundPoolDepositing] = useState(false);
  const [fundFromSmartWallet, setFundFromSmartWallet] = useState(true);
  const [registerAgentId, setRegisterAgentId] = useState<number | null>(null);
  /** Agents the user may register as: invite list (BOT_SELECTION) or all agents (OPEN/INVITE agents-only). */
  const [myRegisterAgents, setMyRegisterAgents] = useState<{ id: number; name: string }[]>([]);
  const START_WINDOW_MINUTES = 5;

  const isInMatch = useCallback(
    (m: {
      slot_a_entry_id: number | null;
      slot_b_entry_id: number | null;
      participant_entry_ids?: number[] | null;
    }) => {
      if (!tournament?.entries) return false;
      const uid = guestUser?.id;
      const addr = (walletAddress ?? guestUser?.address)?.toLowerCase();
      const seatIds =
        m.participant_entry_ids && m.participant_entry_ids.length >= 2
          ? m.participant_entry_ids
          : [m.slot_a_entry_id, m.slot_b_entry_id].filter((x): x is number => x != null);
      return tournament.entries.some(
        (e) =>
          seatIds.includes(e.id) &&
          ((uid != null && e.user_id === uid) || (addr != null && e.address?.toLowerCase() === addr))
      );
    },
    [tournament?.entries, guestUser?.id, guestUser?.address, walletAddress]
  );

  const isInStartWindow = useCallback(
    (scheduledStartAt: string | null | undefined) => {
      if (!scheduledStartAt) return false;
      const start = new Date(scheduledStartAt).getTime();
      const end = start + START_WINDOW_MINUTES * 60 * 1000;
      const now = Date.now();
      return now >= start && now <= end;
    },
    []
  );

  const handleOpenStartNowModal = useCallback((matchId: number) => {
    setActionError(null);
    setStartNowModalMatchId(matchId);
    setSelectedStartSymbol("hat");
  }, []);

  const handleConfirmStartNow = useCallback(
    async () => {
      const matchId = startNowModalMatchId;
      if (!id || matchId == null || startNowMatchId != null) return;
      setStartNowMatchId(matchId);
      setActionError(null);
      setActionSuccess(null);
      try {
        const res = await requestMatchStart(id, String(matchId), { symbol: selectedStartSymbol });
        if (!res.success) {
          setActionError(res.message ?? "Start failed");
          return;
        }
        setStartNowModalMatchId(null);
        if (res.data?.redirect_url) {
          setActionSuccess("Starting game...");
          window.location.href = res.data.redirect_url;
          return;
        }
        if (res.data?.forfeit_win) {
          setActionSuccess("You win by forfeit!");
          fetchBracket(id);
          fetchTournament(id);
        } else if (res.data?.waiting) {
          setActionSuccess("Waiting for opponent — they have 5 minutes to click Start now.");
        }
      } catch (e) {
        setActionError((e as Error)?.message ?? "Start failed");
      } finally {
        setStartNowMatchId(null);
      }
    },
    [id, startNowModalMatchId, selectedStartSymbol, requestMatchStart, fetchBracket, fetchTournament, startNowMatchId]
  );

  const handleCloseStartNowModal = useCallback(() => {
    if (startNowMatchId == null) setStartNowModalMatchId(null);
  }, [startNowMatchId]);

  const { register: registerOnChain, isPending: isOnChainPending } = useRegisterForTournamentOnChain();

  const isCreator =
    tournament &&
    (tournament.is_creator === true ||
      (guestUser && tournament.creator_id === guestUser.id) ||
      (walletAddress &&
        tournament.creator_address &&
        walletAddress.toLowerCase() === String(tournament.creator_address).toLowerCase()));
  const entryFeeWei = Number(tournament?.entry_fee_wei ?? 0);
  const isPaidTournament =
    tournament?.prize_source === "ENTRY_FEE_POOL" && entryFeeWei > 0;

  const vis = String(tournament?.visibility ?? "OPEN").toUpperCase();
  const isBotSelection = vis === "BOT_SELECTION";
  const needsAgentChoice =
    Boolean(tournament?.is_agent_only) || isBotSelection;
  const userSmartWalletForAutoJoin = useMemo(() => {
    const sw = guestUser?.smart_wallet_address && String(guestUser.smart_wallet_address).trim();
    if (!sw || /^0x0{40}$/i.test(sw)) return false;
    return true;
  }, [guestUser?.smart_wallet_address]);
  const agentRegisterSelected = registerAgentId != null && registerAgentId > 0;
  const useAgentAutoJoinRegister = Boolean(needsAgentChoice && agentRegisterSelected);
  const canRegister =
    tournament?.status === "REGISTRATION_OPEN" &&
    !isRegistered(tournament.id) &&
    (!needsAgentChoice || agentRegisterSelected) &&
    (useAgentAutoJoinRegister
      ? guestUser != null && userSmartWalletForAutoJoin
      : isPaidTournament
        ? walletAddress != null
        : walletAddress != null || guestUser != null);

  useEffect(() => {
    if (!id) return;
    fetchTournament(id, inviteParams);
  }, [id, inviteQuery, fetchTournament]);

  useEffect(() => {
    if (tournament?.status !== "REGISTRATION_OPEN") {
      setMyRegisterAgents([]);
      return;
    }
    if (!needsAgentChoice) {
      setMyRegisterAgents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<ApiResponse<{ id: number; name: string }[]>>("/agents");
        const list = res?.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
        let choices = list;
        if (isBotSelection && tournament?.allowed_agent_ids?.length) {
          const allowed = new Set(tournament.allowed_agent_ids.map(Number));
          choices = list.filter((a) => allowed.has(a.id));
        }
        if (!cancelled) {
          setMyRegisterAgents(choices);
          if (choices.length === 1) setRegisterAgentId(choices[0].id);
        }
      } catch {
        if (!cancelled) setMyRegisterAgents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    needsAgentChoice,
    isBotSelection,
    tournament?.allowed_agent_ids,
    tournament?.status,
  ]);

  useEffect(() => {
    if (!id || !tournament || !tournamentMatchesRouteId(tournament, id)) return;
    if (
      tournament.status === "BRACKET_LOCKED" ||
      tournament.status === "IN_PROGRESS" ||
      tournament.status === "COMPLETED"
    ) {
      fetchBracket(id, inviteParams);
      fetchLeaderboard(id, tournament.status === "COMPLETED" ? "final" : "live", inviteParams);
    }
  }, [id, tournament, fetchBracket, fetchLeaderboard, inviteQuery]);

  // Poll bracket so the other player sees "Go to board" when the game is created (e.g. after both click "Start now")
  useEffect(() => {
    if (
      !id ||
      !tournament ||
      !tournamentMatchesRouteId(tournament, id) ||
      (tournament.status !== "BRACKET_LOCKED" && tournament.status !== "IN_PROGRESS")
    ) {
      return;
    }
    const interval = setInterval(() => {
      fetchBracket(id, inviteParams);
      fetchLeaderboard(id, "live", inviteParams);
    }, 5000);
    return () => clearInterval(interval);
  }, [id, tournament, fetchBracket, fetchLeaderboard, inviteQuery]);

  // Coming back from a bracket board tab: refresh so the next round / completed matches show without waiting for the poll.
  useEffect(() => {
    if (!id) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void fetchTournament(id, inviteParams);
      void fetchBracket(id, inviteParams);
      const st = tournament?.status;
      if (st === "COMPLETED") {
        void fetchLeaderboard(id, "final", inviteParams);
      } else {
        void fetchLeaderboard(id, "live", inviteParams);
      }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [id, inviteQuery, tournament?.status, fetchTournament, fetchBracket, fetchLeaderboard]);

  const handleRegister = async () => {
    if (!id || !canRegister || !tournament) return;

    const entryFeeWei = Math.max(0, Math.floor(Number(tournament.entry_fee_wei) || 0));
    const isPaid = tournament.prize_source === "ENTRY_FEE_POOL" && entryFeeWei > 0;
    const agentJoin = needsAgentChoice && registerAgentId != null && registerAgentId > 0;

    setRegistering(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      if (agentJoin) {
        await apiClient.post(`/agents/${registerAgentId}/auto-join-tournament`, {
          tournament_id: tournament.id,
          ...(inviteQuery ? { invite_token: inviteQuery } : {}),
        });
        setActionSuccess("Registered! Your agent is in the event.");
        fetchTournament(id, inviteParams);
        return;
      }

      if (isPaid && !walletAddress) {
        setActionError("Connect your wallet to pay the entry fee");
        return;
      }

      let registrationTxHash: string | null = null;

      if (walletAddress && isPaid) {
        const hash = await registerOnChain(tournament.id, entryFeeWei);
        if (!hash) {
          setActionError("On-chain registration failed");
          return;
        }
        registrationTxHash = hash;
      }

      const res = await registerForTournament(id, {
        address: (walletAddress ?? guestUser?.address) ?? undefined,
        chain: tournament.chain,
        payment_tx_hash: registrationTxHash ?? undefined,
        ...(inviteQuery ? { invite_token: inviteQuery } : {}),
      });
      if (res.success) {
        setActionSuccess("Registered!");
        fetchTournament(id, inviteParams);
      } else {
        setActionError(res.message ?? "Registration failed");
      }
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (e as Error)?.message ||
        "Registration failed";
      setActionError(msg);
    } finally {
      setRegistering(false);
    }
  };

  const handleCloseRegistration = async () => {
    if (!id || !isCreator) return;
    setActionError(null);
    setActionSuccess(null);
    const res = await closeRegistration(id, undefined);
    if (res.success) {
      setActionSuccess("Registration closed. Bracket generated.");
      fetchTournament(id, inviteParams);
      fetchBracket(id, inviteParams);
    } else {
      setActionError(res.message ?? "Failed");
    }
  };

  const handleStartRound = async (roundIndex: number) => {
    if (!id || !isCreator) return;
    setActionError(null);
    setActionSuccess(null);
    setCreatingRoundIndex(roundIndex);
    try {
      const res = await startRound(id, roundIndex);
      if (res.success) {
        setActionSuccess(`Round ${roundIndex + 1} started.`);
        fetchTournament(id, inviteParams);
        fetchBracket(id, inviteParams);
      } else {
        setActionError(res.message ?? "Failed");
      }
    } finally {
      setCreatingRoundIndex(null);
    }
  };

  const handleCreateMatchGame = async (matchId: number) => {
    if (!id || !isCreator) return;
    setActionError(null);
    setActionSuccess(null);
    setCreatingMatchId(matchId);
    try {
      const res = await createMatchGame(id, String(matchId));
      if (res.success && res.data?.redirect_url) {
        fetchTournament(id, inviteParams);
        fetchBracket(id, inviteParams);
        router.push(res.data.redirect_url);
        return;
      }
      if (res.success) {
        setActionSuccess("Game created.");
        fetchTournament(id, inviteParams);
        fetchBracket(id, inviteParams);
      } else {
        setActionError(res.message ?? "Failed");
      }
    } finally {
      setCreatingMatchId(null);
    }
  };

  const slugMatches = Boolean(tournament && tournamentMatchesRouteId(tournament, id));

  const displayBracket = useMemo(() => {
    if (!tournament || !slugMatches) return null;
    const fromDetail = buildBracketFromTournament(tournament);
    // After a match ends, GET /tournaments/:id includes updated winners/slots immediately; GET …/bracket can
    // still return a stale snapshot if it wins the race. Prefer detail-derived bracket whenever we have rounds.
    if (fromDetail?.rounds?.length) return fromDetail;
    return bracket;
  }, [bracket, tournament, slugMatches]);

  const nextRoundToStart = useMemo(() => {
    if (!displayBracket?.rounds?.length) return undefined;
    return displayBracket.rounds.find(
      (r) =>
        r.status === "PENDING" &&
        r.matches?.some((m) => m.status === "PENDING" || m.status === "AWAITING_PLAYERS")
    );
  }, [displayBracket]);

  const ongoingMatches = useMemo(() => {
    const out: Array<{
      m: BracketMatchRow;
      round_index: number;
      labels: string[];
      gameCodeForMatch: string;
      isAutonomous: boolean;
    }> = [];
    if (!tournament || !slugMatches) return out;
    const rounds = displayBracket?.rounds;
    if (!rounds?.length) return out;
    for (const r of rounds) {
      for (const m of r.matches ?? []) {
        if (!bracketMatchIsLiveBoard(m)) continue;
        const labels = labelsForMatchParticipants(m, tournament.entries);
        const agentVsAgent = String(m.match_game_type || "") === "TOURNAMENT_AGENT_VS_AGENT";
        out.push({
          m,
          round_index: r.round_index,
          labels,
          gameCodeForMatch: `T${tournament.id}-R${r.round_index}-M${m.match_index}`.toUpperCase(),
          isAutonomous: agentVsAgent || Boolean(tournament.is_agent_only),
        });
      }
    }
    return out;
  }, [displayBracket, tournament, slugMatches]);

  const upcomingPairings = useMemo(() => {
    const out: Array<{ m: BracketMatchRow; round_index: number; labels: string[] }> = [];
    if (!tournament || !slugMatches) return out;
    const rounds = displayBracket?.rounds;
    if (!rounds?.length) return out;
    const sorted = [...rounds].sort((a, b) => (a.round_index ?? 0) - (b.round_index ?? 0));
    for (const r of sorted) {
      for (const m of r.matches ?? []) {
        if (!isUpcomingBracketMatch(m)) continue;
        out.push({
          m,
          round_index: r.round_index,
          labels: labelsForMatchParticipants(m, tournament.entries),
        });
      }
    }
    return out;
  }, [displayBracket, tournament, slugMatches]);

  if (detailLoading && !tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (detailError && !tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white px-4 py-8">
        <p className="text-red-400 text-center">{detailError}</p>
        <Link href="/tournaments" className="block text-center text-cyan-400 mt-4">
          Back to Tournaments
        </Link>
      </div>
    );
  }

  if (!tournament || !slugMatches) {
    return null;
  }

  const entryCount = tournament.entries?.length ?? 0;

  const conflictPath = extractTournamentPathFromMessage(actionError);

  const walletChainOk = walletAddress && chainIdToBackendChain(walletChainId) === String(tournament?.chain || "").toUpperCase();
  const useSmartWalletForDeposit = fundFromSmartWallet && canUseSmartWallet;
  const depositDisabled =
    !fundPoolReady ||
    fundPoolPending ||
    fundPoolDepositing ||
    !walletAddress ||
    !walletChainOk ||
    (useSmartWalletForDeposit && !smartWalletAddress);

  return (
    <div className="min-h-screen bg-[#030a0c] text-white relative overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 211, 238, 0.12), transparent 50%), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(167, 139, 250, 0.08), transparent 45%), radial-gradient(ellipse 50% 30% at 0% 80%, rgba(52, 211, 153, 0.06), transparent 40%)",
        }}
      />
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-4 md:px-8 border-b border-white/[0.08] bg-[#010F10]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#010F10]/75">
        <Link
          href="/tournaments"
          className="flex items-center gap-2 text-cyan-400/90 hover:text-cyan-300 font-medium text-sm transition"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </Link>
        <h1 className="text-base sm:text-lg md:text-xl font-bold text-white truncate max-w-[55%] text-center bg-gradient-to-r from-white via-cyan-100 to-white/90 bg-clip-text text-transparent">
          {tournament.name}
        </h1>
        <div className="w-16" />
      </header>

      <main className="relative max-w-5xl mx-auto px-4 py-6 md:py-10 space-y-8">
        {/* Meta card */}
        <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#061a1d]/95 to-[#030f12]/90 p-6 md:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${statusColor(String(tournament.status ?? ""))} bg-white/5`}>
              {String(tournament.status ?? "UNKNOWN").replace(/_/g, " ")}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-medium">
              <Users className="w-4 h-4" />
              {entryCount} / {tournament.max_players} players
            </span>
            {isCreator && entryCount === 0 && tournament.status === "REGISTRATION_OPEN" && (
              <span className="text-xs text-white/50 italic">Refresh to see Quick start registrations.</span>
            )}
            <span className="inline-flex px-2.5 py-1 rounded-lg bg-white/5 text-white/80 text-sm">
              {formatEntryFee(tournament.entry_fee_wei)}
            </span>
            <span className="inline-flex px-2.5 py-1 rounded-lg bg-white/5 text-white/80 text-sm">
              {tournament.chain}
            </span>
            {tournament.format && (
              <span className="text-white/55 text-sm">
                {String(tournament.format).replace(/_/g, " ")}
              </span>
            )}
          </div>

          {actionError && (
            <p className="mt-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{actionError.replace(/\s*:\s*\/tournaments\/[A-Za-z0-9_-]+/, "")}</span>
              {conflictPath && (
                <Link href={conflictPath} className="text-cyan-300 underline hover:text-cyan-200">
                  Open blocking tournament
                </Link>
              )}
            </p>
          )}
          {actionSuccess && (
            <p className="mt-3 text-emerald-400 text-sm">{actionSuccess}</p>
          )}

          {String(tournament.visibility ?? "OPEN").toUpperCase() === "INVITE_ONLY" &&
            isCreator &&
            tournament.invite_token && (
              <p className="mt-3 text-xs text-white/60 break-all">
                Secret link for human registration (not shown on Arena). To invite specific bots, use an &quot;Invited bots
                only&quot; tournament next time. Link:{" "}
                <span className="text-cyan-300">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/tournaments/${tournament.code ?? tournament.id}?invite=${encodeURIComponent(tournament.invite_token)}`
                    : `…?invite=${tournament.invite_token}`}
                </span>
              </p>
            )}

          {tournament.status === "REGISTRATION_OPEN" && needsAgentChoice && myRegisterAgents.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs text-white/60 mb-1.5">
                {isBotSelection ? "Register as agent (invited)" : "Register as agent (agents-only event)"}
              </label>
              <select
                className="w-full max-w-md px-3 py-2 rounded-lg bg-[#011112] border border-[#0E282A] text-cyan-200 text-sm"
                value={registerAgentId ?? ""}
                onChange={(e) => setRegisterAgentId(Number(e.target.value) || null)}
              >
                <option value="">Choose your agent…</option>
                {myRegisterAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (#{a.id})
                  </option>
                ))}
              </select>
              {!isBotSelection && (
                <p className="mt-1.5 text-[11px] text-white/45">
                  Your agent is bound to this seat for bracket games (callbacks / hosted AI / API key).
                </p>
              )}
            </div>
          )}
          {tournament.status === "REGISTRATION_OPEN" && needsAgentChoice && myRegisterAgents.length === 0 && guestUser && (
            <p className="mt-3 text-sm text-amber-400/90">
              {isBotSelection
                ? "None of your agents are on this tournament's invite list, or you have no agents yet."
                : "Create an agent in My agents before registering for this agents-only tournament."}
            </p>
          )}
          {tournament.status === "REGISTRATION_OPEN" &&
            needsAgentChoice &&
            !isRegistered(tournament.id) &&
            guestUser &&
            !userSmartWalletForAutoJoin && (
              <p className="mt-3 text-sm text-amber-400/90">
                Add a smart wallet in Profile (same as Arena Challenges) so your agent can join and pay entry fees from your
                capped tournament permission.
              </p>
            )}
          {tournament.status === "REGISTRATION_OPEN" &&
            needsAgentChoice &&
            !isRegistered(tournament.id) &&
            !guestUser && (
              <p className="mt-3 text-sm text-amber-400/90">
                Sign in to register an agent for this tournament.
              </p>
            )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-4">
            {canRegister && (
              <button
                type="button"
                onClick={handleRegister}
                disabled={registering || isOnChainPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 font-medium hover:bg-cyan-500/35 disabled:opacity-50"
              >
                {registering || isOnChainPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {needsAgentChoice ? "Register with agent" : "Register"}
              </button>
            )}
            {tournament.status === "REGISTRATION_OPEN" && isCreator && (
              <div className="flex flex-wrap items-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleCloseRegistration}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-medium hover:bg-amber-500/30"
                >
                  <Lock className="w-4 h-4" />
                  Close registration & generate bracket
                </button>
              </div>
            )}
            {nextRoundToStart != null && isCreator && (
              <button
                type="button"
                onClick={() => handleStartRound(nextRoundToStart.round_index)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-medium hover:bg-emerald-500/30"
              >
                <Play className="w-4 h-4" />
                Start round {nextRoundToStart.round_index + 1}
              </button>
            )}
          </div>
        </section>

        {tournament.prize_source === "CREATOR_FUNDED" &&
          isCreator &&
          (tournament.status === "REGISTRATION_OPEN" || tournament.status === "BRACKET_LOCKED") && (
            <section className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-950/20 to-cyan-950/5 p-6 shadow-lg shadow-black/20">
              <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-cyan-400" />
                Fund prize pool
              </h2>
              <p className="text-sm text-white/70 mb-4">
                Deposit USDC on <span className="text-cyan-300 font-medium">{tournament.chain}</span>. Planned pool:{" "}
                <strong className="text-white">
                  {tournament.prize_pool_wei && Number(tournament.prize_pool_wei) > 0
                    ? formatEntryFee(tournament.prize_pool_wei)
                    : "not set"}
                </strong>
                — deposit at least this amount before the event finishes.
              </p>
              {!walletAddress && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-3 mb-4">
                  <p className="text-amber-200 text-sm">Connect your wallet to deposit.</p>
                </div>
              )}
              {walletAddress && !walletChainOk && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-3 mb-4">
                  <p className="text-amber-200 text-sm">Switch your wallet to <strong>{tournament.chain}</strong> to deposit.</p>
                </div>
              )}
              {!fundPoolReady && walletAddress && walletChainOk && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-3 mb-4">
                  <p className="text-amber-200 text-sm">Escrow not configured for this network. Check environment settings.</p>
                </div>
              )}
              {walletAddress && walletChainOk && (
                <div className="mb-4 p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/20">
                  <p className="text-sm font-medium text-cyan-200/95 mb-3 flex items-center gap-2">
                    <WalletMinimal className="w-4 h-4" />
                    Pay from
                  </p>
                  {canUseSmartWallet ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex gap-1 p-0.5 rounded-lg bg-black/20">
                        <button
                          type="button"
                          onClick={() => setFundFromSmartWallet(true)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                            fundFromSmartWallet
                              ? "bg-cyan-500/30 text-cyan-100 border border-cyan-400/40"
                              : "text-white/60 hover:text-white/80 border border-transparent"
                          }`}
                        >
                          Smart wallet
                        </button>
                        <button
                          type="button"
                          onClick={() => setFundFromSmartWallet(false)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                            !fundFromSmartWallet
                              ? "bg-cyan-500/30 text-cyan-100 border border-cyan-400/40"
                              : "text-white/60 hover:text-white/80 border border-transparent"
                          }`}
                        >
                          Connected wallet
                        </button>
                      </div>
                      <span className="text-xs text-white/60">
                        {fundFromSmartWallet ? "USDC in your Tycoon smart wallet" : "USDC in your connected EOA"}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-white/70">
                      Using <strong>connected wallet</strong>. Sign in and create a profile to use your smart wallet for deposits.
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label htmlFor="fund_pool_usd" className="block text-sm font-medium text-white/90 mb-1.5">
                    Amount (USDC)
                  </label>
                  <input
                    id="fund_pool_usd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={fundPoolUsd}
                    onChange={(e) => {
                      setFundPoolUsd(e.target.value);
                      setActionError(null);
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-white placeholder-white/35 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition"
                    placeholder="e.g. 1.00"
                  />
                </div>
                <button
                  type="button"
                  disabled={depositDisabled}
                  onClick={async () => {
                    const usd = parseFloat(fundPoolUsd);
                    if (Number.isNaN(usd) || usd <= 0) {
                      setActionError("Enter a USDC amount greater than 0");
                      return;
                    }
                    setActionError(null);
                    setActionSuccess(null);
                    setFundPoolDepositing(true);
                    try {
                      const wei = BigInt(Math.round(usd * 10 ** USDC_DECIMALS));
                      await fundPrizePoolOnChain(tournament.id, wei, useSmartWalletForDeposit);
                      setActionSuccess("Deposit submitted. Wait for confirmation, then refresh.");
                      setFundPoolUsd("");
                    } catch (e) {
                      const msg = (e as Error)?.message ?? "Deposit failed";
                      const short = msg.replace(/^(User denied|User rejected).*$/i, "Transaction cancelled");
                      setActionError(short);
                    } finally {
                      setFundPoolDepositing(false);
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-200 font-semibold hover:bg-cyan-500/35 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 min-w-[160px]"
                >
                  {(fundPoolPending || fundPoolDepositing) ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {fundPoolDepositing && !fundPoolPending ? "Approve & deposit…" : "Confirming…"}
                    </>
                  ) : (
                    "Deposit to escrow"
                  )}
                </button>
              </div>
              <p className="text-xs text-white/50 mt-3">
                Two steps: approve USDC, then deposit. Winners get 50% / 30% / 15% / 5% for 1st–4th.
              </p>
            </section>
          )}

        {(tournament.status === "IN_PROGRESS" || tournament.status === "BRACKET_LOCKED") && displayBracket && (
          <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-[#051215] to-[#030a0c] p-6 md:p-7 shadow-xl shadow-emerald-950/20">
            <h2 className="text-lg font-bold text-emerald-200 flex items-center gap-2.5 mb-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                <Radio className="w-4 h-4 text-emerald-300 animate-pulse" />
              </span>
              Live tables
            </h2>
            <p className="text-sm text-white/45 mb-4">Games in progress — spectate or open the board. Finished matches stay in the bracket below without watch links.</p>
            {ongoingMatches.length === 0 ? (
              <p className="text-sm text-white/50 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                No live tables right now. When a match starts, it appears here.
              </p>
            ) : (
              <ul className="space-y-3">
                {ongoingMatches.map(({ m, round_index, labels, gameCodeForMatch, isAutonomous }) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-black/35 px-4 py-3.5 text-sm backdrop-blur-sm"
                  >
                    <span className="text-white/90 min-w-0">
                      <span className="text-emerald-400/90 font-semibold">Round {round_index + 1}</span>
                      <span className="text-white/35 mx-2">·</span>
                      <span className="break-words font-medium">{labels.join(" vs ")}</span>
                    </span>
                    <Link
                      href={`/board-3d-multi?gameCode=${encodeURIComponent(gameCodeForMatch)}${isAutonomous ? "&spectate=1" : ""}`}
                      className="inline-flex shrink-0 items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-sm font-semibold hover:bg-emerald-500/30 transition-colors"
                    >
                      {isAutonomous ? <Eye className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isAutonomous ? "Spectate" : "Open board"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(tournament.status === "BRACKET_LOCKED" ||
          tournament.status === "IN_PROGRESS" ||
          tournament.status === "COMPLETED") &&
          upcomingPairings.length > 0 && (
            <section className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-950/25 via-[#0a1214] to-transparent p-6 md:p-7">
              <h2 className="text-lg font-bold text-amber-100 flex items-center gap-2.5 mb-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/25">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </span>
                Next pairings
              </h2>
              <p className="text-sm text-white/45 mb-4">Scheduled after earlier rounds finish — both sides are set.</p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {upcomingPairings.map(({ m, round_index, labels }) => (
                  <li
                    key={m.id}
                    className="rounded-2xl border border-amber-500/15 bg-black/30 px-4 py-3.5 text-sm"
                  >
                    <p className="text-[11px] uppercase tracking-wider text-amber-400/80 font-semibold mb-1">
                      Round {round_index + 1}
                    </p>
                    <p className="text-white font-medium leading-snug">
                      {labels.length === 2 ? (
                        <>
                          <span className="text-cyan-200/95">{labels[0]}</span>
                          <span className="text-white/35 mx-2 font-normal">vs</span>
                          <span className="text-cyan-200/95">{labels[1]}</span>
                        </>
                      ) : (
                        <span className="text-cyan-200/95">{labels.join(" · ")}</span>
                      )}
                    </p>
                    <p className="text-xs text-white/40 mt-2 flex items-center gap-1.5">
                      <CircleDashed className="w-3.5 h-3.5 shrink-0" />
                      Waiting for round / creator start
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

        {/* Bracket */}
        {(tournament.status === "BRACKET_LOCKED" ||
          tournament.status === "IN_PROGRESS" ||
          tournament.status === "COMPLETED") && (
          <section>
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-violet-200 flex items-center gap-3 mb-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/25 text-cyan-300">
                <Swords className="w-5 h-5" />
              </span>
              Bracket & results
            </h2>
            {bracketLoading && !displayBracket && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            )}
            {displayBracket && (
              <div className="space-y-5">
                {[...displayBracket.rounds]
                  .slice()
                  .sort((a, b) => (a.round_index ?? 0) - (b.round_index ?? 0))
                  .map((r: BracketRound) => {
                  const scheduledAt = r.scheduled_start_at
                    ? new Date(r.scheduled_start_at).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : null;
                  const canStartNow =
                    r.scheduled_start_at &&
                    isInStartWindow(r.scheduled_start_at);
                  const roundMatches = r.matches ?? [];
                  const roundComplete =
                    roundMatches.length > 0 && roundMatches.every((m) => isBracketMatchTerminal(m));
                  const roundHasLive = roundMatches.some((m) => bracketMatchIsLiveBoard(m));
                  return (
                    <div
                      key={r.round_index}
                      className={`rounded-2xl border p-5 md:p-6 transition-shadow ${
                        roundHasLive
                          ? "border-emerald-500/35 bg-gradient-to-br from-emerald-950/30 to-[#050f12]/90 shadow-lg shadow-emerald-950/10"
                          : roundComplete
                            ? "border-white/[0.07] bg-[#040d10]/80"
                            : "border-cyan-500/20 bg-[#051216]/70"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <p className="text-base font-bold text-white tracking-tight">
                            Round {r.round_index + 1}
                          </p>
                          <p className="text-xs text-white/45 mt-0.5">
                            {String(r.status ?? "UNKNOWN").replace(/_/g, " ")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {roundComplete ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/25">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Complete
                            </span>
                          ) : roundHasLive ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
                              <Radio className="w-3.5 h-3.5" />
                              Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/12 text-amber-200/90 border border-amber-400/20">
                              <CircleDashed className="w-3.5 h-3.5" />
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>
                      {scheduledAt && (
                        <p className="text-xs text-cyan-400/85 mb-4 flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 shrink-0" />
                          Start window: {scheduledAt} (5 min)
                        </p>
                      )}
                      <div className="space-y-3">
                        {r.matches?.map((m) => {
                          const showStartNow =
                            canStartNow &&
                            !m.game_id &&
                            m.status !== "BYE" &&
                            isInMatch(m);
                          const matchLive = bracketMatchIsLiveBoard(m);
                          const participantIds = bracketMatchParticipantIds(m);
                          const tableNames = labelsForMatchParticipants(m, tournament.entries);
                          const done = isBracketMatchTerminal(m);
                          const winnerId = m.winner_entry_id;
                          const needsGameCreated =
                            !m.game_id &&
                            m.status !== "BYE" &&
                            !m.winner_entry_id &&
                            (participantIds.length >= 2 || (!!m.slot_a_entry_id && !!m.slot_b_entry_id));
                          const canCreateGame = needsGameCreated && isCreator;
                          // Use numeric tournament.id so game code matches backend (e.g. T24-R0-M0), not URL slug (e.g. 9OJXTLE4)
                          const gameCodeForMatch = `T${tournament?.id ?? id}-R${r.round_index}-M${m.match_index}`.toUpperCase();
                          const isAutonomousAgentMatch =
                            String(m.match_game_type || "") === "TOURNAMENT_AGENT_VS_AGENT" ||
                            Boolean(tournament.is_agent_only);
                          return (
                            <div
                              key={m.id}
                              className={`rounded-xl px-4 py-3.5 text-sm space-y-3 border ${
                                done
                                  ? "border-white/[0.06] bg-black/25"
                                  : matchLive
                                    ? "border-emerald-500/25 bg-emerald-950/15"
                                    : "border-white/[0.08] bg-black/35"
                              }`}
                            >
                              {m.status === "BYE" ? (
                                <p className="text-white/70">
                                  <span className="text-white/45">Bye</span>
                                  {tableNames[0] ? ` — ${tableNames[0]}` : ""}
                                </p>
                              ) : tableNames.length === 2 ? (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                                    <span
                                      className={`font-medium min-w-0 break-words ${
                                        winnerId != null && participantIds[0] === winnerId
                                          ? "text-amber-300"
                                          : winnerId != null
                                            ? "text-white/40 line-through decoration-white/20"
                                            : "text-cyan-100/95"
                                      }`}
                                    >
                                      {tableNames[0]}
                                    </span>
                                    <span className="text-white/25 text-xs font-semibold uppercase tracking-wider">vs</span>
                                    <span
                                      className={`font-medium min-w-0 break-words ${
                                        winnerId != null && participantIds[1] === winnerId
                                          ? "text-amber-300"
                                          : winnerId != null
                                            ? "text-white/40 line-through decoration-white/20"
                                            : "text-cyan-100/95"
                                      }`}
                                    >
                                      {tableNames[1]}
                                    </span>
                                  </div>
                                  {done && m.winner_username && (
                                    <span className="inline-flex items-center gap-1.5 shrink-0 text-amber-300/95 text-xs font-semibold">
                                      <Trophy className="w-3.5 h-3.5" />
                                      {m.winner_username}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <p className="text-white/90 text-sm min-w-0 break-words">{tableNames.join(" · ")}</p>
                                  {done && m.winner_username && (
                                    <span className="text-amber-300 text-xs font-semibold shrink-0 flex items-center gap-1">
                                      <Trophy className="w-3.5 h-3.5" />
                                      {m.winner_username}
                                    </span>
                                  )}
                                </div>
                              )}
                              {matchLive && m.spectator_url && (
                                <p className="text-xs text-white/40">
                                  <Link href={m.spectator_url} className="text-violet-300/90 hover:text-violet-200 underline-offset-2 hover:underline">
                                    Share spectator link
                                  </Link>
                                </p>
                              )}
                              {(matchLive || showStartNow || canCreateGame || needsGameCreated) && (
                                <div className="flex flex-wrap justify-end gap-2 pt-1">
                                  {matchLive ? (
                                    <>
                                      <Link
                                        href={`/board-3d-multi?gameCode=${encodeURIComponent(gameCodeForMatch)}${isAutonomousAgentMatch ? "&spectate=1" : ""}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/45 text-cyan-100 font-semibold text-sm hover:bg-cyan-500/30 transition-colors"
                                      >
                                        {isAutonomousAgentMatch ? <Eye className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        {isAutonomousAgentMatch ? "Spectate" : "Play (board)"}
                                      </Link>
                                      {!isAutonomousAgentMatch ? (
                                        <Link
                                          href={`/game-waiting?gameCode=${encodeURIComponent(gameCodeForMatch)}`}
                                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/12 text-white/88 font-medium text-sm hover:bg-white/10 transition-colors"
                                        >
                                          Lobby
                                        </Link>
                                      ) : null}
                                      {m.spectator_url ? (
                                        <Link
                                          href={m.spectator_url}
                                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-400/35 text-violet-200 font-medium text-sm hover:bg-violet-500/25 transition-colors"
                                        >
                                          <Eye className="w-4 h-4" />
                                          Spectate
                                        </Link>
                                      ) : null}
                                    </>
                                  ) : showStartNow ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenStartNowModal(m.id)}
                                      disabled={startNowMatchId != null || startNowModalMatchId != null}
                                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/25 border border-cyan-500/60 text-cyan-300 font-medium hover:bg-cyan-500/35 disabled:opacity-50 transition-colors"
                                    >
                                      {startNowMatchId === m.id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Starting...
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-4 h-4" />
                                          Start now
                                        </>
                                      )}
                                    </button>
                                  ) : canCreateGame ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCreateMatchGame(m.id)}
                                      disabled={creatingMatchId != null}
                                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/25 border border-cyan-500/60 text-cyan-300 font-medium hover:bg-cyan-500/35 disabled:opacity-50 transition-colors"
                                    >
                                      {creatingMatchId === m.id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Creating...
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-4 h-4" />
                                          Create game
                                        </>
                                      )}
                                    </button>
                                  ) : needsGameCreated ? (
                                    <span className="text-xs text-white/50">
                                      Waiting for creator to start match
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Leaderboard */}
        {(tournament.status === "IN_PROGRESS" || tournament.status === "COMPLETED") && (
          <section>
            <h2 className="text-xl font-bold text-cyan-200 flex items-center gap-3 mb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300">
                <Trophy className="w-5 h-5" />
              </span>
              Standings
            </h2>
            {leaderboardLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            )}
            {!leaderboardLoading && leaderboard && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#040d10]/90 overflow-hidden shadow-xl shadow-black/20">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/55 text-xs uppercase tracking-wider">
                      <th className="p-4 font-semibold">#</th>
                      <th className="p-4 font-semibold">Player</th>
                      <th className="p-4 font-semibold">Out</th>
                      <th className="p-4 font-semibold">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(leaderboard.entries) ? leaderboard.entries : []).map((e) => {
                      const rankBadge =
                        e.rank === 1
                          ? "bg-amber-500/15 text-amber-200 border border-amber-400/35"
                          : e.rank === 2
                            ? "bg-slate-400/10 text-slate-200 border border-slate-400/30"
                            : e.rank === 3
                              ? "bg-orange-800/25 text-orange-200 border border-orange-500/30"
                              : "bg-white/5 text-white/80 border border-white/10";
                      const rowAccent =
                        e.rank === 1
                          ? "border-l-2 border-amber-400/45"
                          : e.rank === 2
                            ? "border-l-2 border-slate-400/35"
                            : e.rank === 3
                              ? "border-l-2 border-orange-500/35"
                              : "";
                      return (
                        <tr
                          key={e.entry_id}
                          className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${rowAccent}`}
                        >
                          <td className="p-4">
                            <span
                              className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg text-sm font-bold ${rankBadge}`}
                            >
                              {e.rank}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-white/95">
                            {e.username}
                            {e.is_winner && (
                              <span className="ml-2 text-amber-400 font-semibold">Champion</span>
                            )}
                          </td>
                          <td className="p-4 text-white/55">
                            {e.eliminated_in_round != null
                              ? `R${e.eliminated_in_round + 1}`
                              : "—"}
                          </td>
                          <td className="p-4 text-emerald-200/90 font-medium">
                            {e.payout_wei
                              ? `$${(Number(e.payout_wei) / 1e6).toFixed(2)}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Entries (during registration) */}
        {tournament.status === "REGISTRATION_OPEN" && tournament.entries?.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-cyan-400 flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              Registered ({tournament.entries.length})
            </h2>
            <ul className="rounded-xl border border-[#0E282A] bg-[#011112]/60 divide-y divide-white/5">
              {tournament.entries.map((e) => (
                <li key={e.id} className="px-4 py-3 text-sm">
                  {tournamentEntryDisplay(e) || `Entry #${e.id}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Start now: choose token modal */}
        {startNowModalMatchId != null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-now-modal-title"
          >
            <div className="bg-[#0d1f23] border border-cyan-500/30 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h2 id="start-now-modal-title" className="text-lg font-semibold text-white mb-3">
                Choose your token
              </h2>
              <p className="text-sm text-white/70 mb-4">
                You’re starting this match. Pick the token you’ll use for the game; your opponent will choose theirs in the lobby.
              </p>
              <label className="block text-sm text-white/70 mb-2" htmlFor="start-now-symbol">
                Token
              </label>
              <select
                id="start-now-symbol"
                value={selectedStartSymbol}
                onChange={(e) => setSelectedStartSymbol(e.target.value)}
                className="w-full bg-black/30 border border-cyan-500/40 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 mb-5"
              >
                {symbolOptions.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#0d1f23]">
                    {s.emoji} {s.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseStartNowModal}
                  disabled={startNowMatchId != null}
                  className="flex-1 py-2 rounded-lg border border-white/30 text-white/90 hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStartNow}
                  disabled={startNowMatchId != null}
                  className="flex-1 py-2 rounded-lg bg-cyan-500/80 text-black font-semibold hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                >
                  {startNowMatchId != null ? "Starting…" : "Start game"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
