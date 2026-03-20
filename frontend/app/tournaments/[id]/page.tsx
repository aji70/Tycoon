"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import type { Bracket, BracketRound, TournamentDetail } from "@/types/tournament";
import { symbols as symbolOptions } from "@/lib/types/symbol";

function formatEntryFee(wei: string | number): string {
  const n = Number(wei);
  if (n === 0) return "Free";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)} USDC`;
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

function extractTournamentPathFromMessage(message: string | null): string | null {
  if (!message) return null;
  const match = message.match(/(\/tournaments\/[A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

/** Build bracket from tournament detail (rounds + matches + entries) so players see bracket even if bracket API fails or is slow. */
function buildBracketFromTournament(t: TournamentDetail | null): Bracket | null {
  if (!t?.rounds?.length || !t?.matches) return null;
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
          slot_a_username: m.slot_a_entry_id ? (entryMap.get(m.slot_a_entry_id)?.username ?? null) : null,
          slot_b_username: m.slot_b_entry_id ? (entryMap.get(m.slot_b_entry_id)?.username ?? null) : null,
          winner_username: m.winner_entry_id ? (entryMap.get(m.winner_entry_id)?.username ?? null) : null,
        })),
      };
    });
  return { tournament: { id: t.id, name: t.name, status: t.status }, rounds };
}

export default function TournamentDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { guestUser } = useGuestAuthOptional() ?? {};
  const { address: walletAddress } = useAccount();
  const walletChainId = useChainId();
  const { fund: fundPrizePoolOnChain, isPending: fundPoolPending, isReady: fundPoolReady } = useFundPrizePool();
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
    isRegistered,
  } = useTournament();

  const [startNowMatchId, setStartNowMatchId] = useState<number | null>(null);
  const [startNowModalMatchId, setStartNowModalMatchId] = useState<number | null>(null);
  const [selectedStartSymbol, setSelectedStartSymbol] = useState<string>("hat");
  const [creatingRoundIndex, setCreatingRoundIndex] = useState<number | null>(null);
  const [fundPoolUsd, setFundPoolUsd] = useState("");
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
    ((guestUser && tournament.creator_id === guestUser.id) ||
      (walletAddress &&
        tournament.creator_address &&
        walletAddress.toLowerCase() === String(tournament.creator_address).toLowerCase()));
  const entryFeeWei = Number(tournament?.entry_fee_wei ?? 0);
  const isPaidTournament =
    tournament?.prize_source === "ENTRY_FEE_POOL" && entryFeeWei > 0;

  const canRegister =
    tournament?.status === "REGISTRATION_OPEN" &&
    !isRegistered(tournament.id) &&
    (isPaidTournament ? walletAddress != null : walletAddress != null || guestUser != null);

  useEffect(() => {
    if (!id) return;
    fetchTournament(id);
  }, [id, fetchTournament]);

  useEffect(() => {
    if (!id || !tournament || tournament.id !== Number(id)) return;
    if (
      tournament.status === "BRACKET_LOCKED" ||
      tournament.status === "IN_PROGRESS" ||
      tournament.status === "COMPLETED"
    ) {
      fetchBracket(id);
      fetchLeaderboard(id, tournament.status === "COMPLETED" ? "final" : "live");
    }
  }, [id, tournament?.id, tournament?.status, fetchBracket, fetchLeaderboard]);

  // Poll bracket so the other player sees "Go to board" when the game is created (e.g. after both click "Start now")
  useEffect(() => {
    if (
      !id ||
      !tournament ||
      tournament.id !== Number(id) ||
      (tournament.status !== "BRACKET_LOCKED" && tournament.status !== "IN_PROGRESS")
    ) {
      return;
    }
    const interval = setInterval(() => {
      fetchBracket(id);
      fetchLeaderboard(id, "live");
    }, 5000);
    return () => clearInterval(interval);
  }, [id, tournament?.id, tournament?.status, fetchBracket, fetchLeaderboard]);

  const handleRegister = async () => {
    if (!id || !canRegister || !tournament) return;

    const entryFeeWei = Math.max(0, Math.floor(Number(tournament.entry_fee_wei) || 0));
    const isPaid = tournament.prize_source === "ENTRY_FEE_POOL" && entryFeeWei > 0;

    // Paid tournaments require wallet for on-chain payment (contract registerForTournament)
    if (isPaid && !walletAddress) {
      setActionError("Connect your wallet to pay the entry fee");
      return;
    }

    setRegistering(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      let registrationTxHash: string | null = null;

      // On-chain: only for PAID tournaments (contract registerForTournament). Free tournaments use backend registerForTournamentFor.
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
      });
      if (res.success) {
        setActionSuccess("Registered!");
        fetchTournament(id);
      } else {
        setActionError(res.message ?? "Registration failed");
      }
    } catch (e) {
      setActionError((e as Error)?.message ?? "Registration failed");
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
      fetchTournament(id);
      fetchBracket(id);
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
        fetchTournament(id);
        fetchBracket(id);
      } else {
        setActionError(res.message ?? "Failed");
      }
    } finally {
      setCreatingRoundIndex(null);
    }
  };

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

  // id from URL can be code (e.g. X6TEUPOE) or numeric id; tournament resolved by API
  const slugMatches =
    tournament &&
    (String(tournament.id) === id ||
      (String(tournament.code ?? "").toUpperCase() === String(id).trim().toUpperCase()));
  if (!tournament || !slugMatches) {
    return null;
  }

  const entryCount = tournament.entries?.length ?? 0;
  const displayBracket = bracket ?? buildBracketFromTournament(tournament);
  const nextRoundToStart =
    displayBracket?.rounds?.find(
      (r) => r.status === "PENDING" && r.matches?.some((m) => m.status === "PENDING" || m.status === "AWAITING_PLAYERS")
    );
  const conflictPath = extractTournamentPathFromMessage(actionError);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-4 md:px-8 border-b border-white/10 bg-[#010F10]/90 backdrop-blur-md">
        <Link
          href="/tournaments"
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Tournaments
        </Link>
        <h1 className="text-lg md:text-xl font-bold text-cyan-400 truncate max-w-[50%]">
          {tournament.name}
        </h1>
        <div className="w-24" />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-8">
        {/* Meta */}
        <section className="rounded-2xl border border-[#0E282A] bg-[#011112]/80 p-5">
          <p className={`font-medium ${statusColor(tournament.status)}`}>
            {tournament.status.replace(/_/g, " ")}
          </p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-white/70">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {entryCount} / {tournament.max_players} players
            </span>
            <span>{formatEntryFee(tournament.entry_fee_wei)}</span>
            <span>{tournament.chain}</span>
            {tournament.format && (
              <span className="text-white/55">
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
                Register
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
            <section className="rounded-2xl border border-violet-500/35 bg-violet-950/15 p-5 space-y-3">
              <h2 className="text-base font-semibold text-violet-300 flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Creator: put USDC in the prize pool
              </h2>
              <p className="text-sm text-white/65">
                On <span className="text-cyan-300">{tournament.chain}</span>, approve USDC for the tournament escrow, then
                call <code className="text-cyan-400/90 text-xs">fundPrizePool(tournamentId, amount)</code>. Amounts use 6
                decimals (USDC). Your planned pool on file:{" "}
                <strong className="text-white">
                  {tournament.prize_pool_wei && Number(tournament.prize_pool_wei) > 0
                    ? formatEntryFee(tournament.prize_pool_wei)
                    : "not set — add when creating or contact support to update DB"}
                </strong>
                . Payout math uses that DB value; deposit at least that much on-chain before the event finishes.
              </p>
              <p className="text-xs text-white/50">
                Winners: default split is 50% / 30% / 15% / 5% for placements 1–4 (see{" "}
                <code className="text-cyan-500/80">prize_distribution</code> on the tournament). On completion, the backend
                records payouts toward entrants&apos; smart wallets.
              </p>
              {walletAddress && chainIdToBackendChain(walletChainId) !== String(tournament.chain || "").toUpperCase() && (
                <p className="text-amber-400/90 text-sm">
                  Switch your wallet to {tournament.chain} before funding.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="fund_pool_usd" className="block text-xs text-white/60 mb-1">
                    Amount (USDC)
                  </label>
                  <input
                    id="fund_pool_usd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={fundPoolUsd}
                    onChange={(e) => setFundPoolUsd(e.target.value)}
                    className="w-40 px-3 py-2 rounded-lg bg-[#011112] border border-[#0E282A] text-white text-sm"
                    placeholder="e.g. 50"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    !fundPoolReady ||
                    fundPoolPending ||
                    !walletAddress ||
                    chainIdToBackendChain(walletChainId) !== String(tournament.chain || "").toUpperCase()
                  }
                  onClick={async () => {
                    const usd = parseFloat(fundPoolUsd);
                    if (Number.isNaN(usd) || usd <= 0) {
                      setActionError("Enter a USDC amount greater than 0");
                      return;
                    }
                    setActionError(null);
                    setActionSuccess(null);
                    try {
                      const wei = BigInt(Math.round(usd * 10 ** USDC_DECIMALS));
                      await fundPrizePoolOnChain(tournament.id, wei);
                      setActionSuccess("Prize pool deposit submitted. Wait for confirmation, then refresh.");
                      setFundPoolUsd("");
                    } catch (e) {
                      setActionError((e as Error)?.message ?? "Fund failed");
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-violet-500/25 border border-violet-500/50 text-violet-200 text-sm font-medium hover:bg-violet-500/35 disabled:opacity-50"
                >
                  {fundPoolPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
                  {fundPoolPending ? " Confirming…" : "Deposit to escrow"}
                </button>
              </div>
            </section>
          )}

        {/* Bracket */}
        {(tournament.status === "BRACKET_LOCKED" ||
          tournament.status === "IN_PROGRESS" ||
          tournament.status === "COMPLETED") && (
          <section>
            <h2 className="text-lg font-semibold text-cyan-400 flex items-center gap-2 mb-4">
              <Swords className="w-5 h-5" />
              Bracket
            </h2>
            {bracketLoading && !displayBracket && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            )}
            {displayBracket && (
              <div className="space-y-6">
                {displayBracket.rounds.map((r: BracketRound) => {
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
                  return (
                    <div
                      key={r.round_index}
                      className="rounded-xl border border-[#0E282A] bg-[#011112]/60 p-4"
                    >
                      <p className="text-sm font-medium text-white/70 mb-1">
                        Round {r.round_index + 1} — {r.status}
                      </p>
                      {scheduledAt && (
                        <p className="text-xs text-cyan-400/80 mb-3">
                          Start window: {scheduledAt} (5 min)
                        </p>
                      )}
                      <div className="space-y-2">
                        {r.matches?.map((m) => {
                          const showStartNow =
                            canStartNow &&
                            !m.game_id &&
                            m.status !== "BYE" &&
                            isInMatch(m);
                          const hasGameForBoard = !!m.game_id;
                          const participantIds =
                            m.participant_entry_ids && m.participant_entry_ids.length >= 2
                              ? m.participant_entry_ids
                              : [m.slot_a_entry_id, m.slot_b_entry_id].filter(
                                  (x): x is number => x != null
                                );
                          const tableNames = participantIds.map((pid) => {
                            const un =
                              m.slot_a_entry_id === pid
                                ? m.slot_a_username
                                : m.slot_b_entry_id === pid
                                  ? m.slot_b_username
                                  : tournament.entries?.find((e) => e.id === pid)?.username;
                            return un ?? `#${pid}`;
                          });
                          const needsGameCreated =
                            !m.game_id &&
                            m.status !== "BYE" &&
                            !m.winner_entry_id &&
                            (participantIds.length >= 2 || (!!m.slot_a_entry_id && !!m.slot_b_entry_id));
                          const canCreateGame = needsGameCreated && isCreator;
                          // Use numeric tournament.id so game code matches backend (e.g. T24-R0-M0), not URL slug (e.g. 9OJXTLE4)
                          const gameCodeForMatch = `T${tournament?.id ?? id}-R${r.round_index}-M${m.match_index}`.toUpperCase();
                          return (
                            <div
                              key={m.id}
                              className="py-2 px-3 rounded-lg bg-black/20 text-sm space-y-2"
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="text-white/90 text-sm min-w-0 break-words">
                                  {tableNames.join(" · ")}
                                </p>
                                {m.winner_username && (
                                  <span className="text-cyan-400 text-xs shrink-0">
                                    Winner: {m.winner_username}
                                  </span>
                                )}
                              </div>
                              {m.spectator_url && (
                                <p className="text-xs text-white/45 break-all">
                                  Watch link:{" "}
                                  <Link href={m.spectator_url} className="text-cyan-400/90 hover:underline">
                                    {m.spectator_url}
                                  </Link>
                                </p>
                              )}
                              {(hasGameForBoard || showStartNow || canCreateGame || needsGameCreated) && (
                                <div className="flex flex-wrap justify-end gap-2">
                                  {hasGameForBoard ? (
                                    <>
                                      <Link
                                        href={`/board-3d-multi?gameCode=${encodeURIComponent(gameCodeForMatch)}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/25 border border-cyan-500/60 text-cyan-300 font-medium hover:bg-cyan-500/35 transition-colors"
                                      >
                                        <Play className="w-4 h-4" />
                                        Play (board)
                                      </Link>
                                      <Link
                                        href={`/game-waiting?gameCode=${encodeURIComponent(gameCodeForMatch)}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/15 text-white/85 font-medium hover:bg-white/10 transition-colors"
                                      >
                                        Lobby
                                      </Link>
                                      {m.spectator_url ? (
                                        <Link
                                          href={m.spectator_url}
                                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/15 border border-violet-500/40 text-violet-200 font-medium hover:bg-violet-500/25 transition-colors"
                                        >
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
                                      onClick={() => handleStartRound(r.round_index)}
                                      disabled={creatingRoundIndex != null}
                                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/25 border border-cyan-500/60 text-cyan-300 font-medium hover:bg-cyan-500/35 disabled:opacity-50 transition-colors"
                                    >
                                      {creatingRoundIndex === r.round_index ? (
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
            <h2 className="text-lg font-semibold text-cyan-400 flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5" />
              Leaderboard
            </h2>
            {leaderboardLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            )}
            {!leaderboardLoading && leaderboard && (
              <div className="rounded-xl border border-[#0E282A] bg-[#011112]/60 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/70">
                      <th className="p-3">#</th>
                      <th className="p-3">Player</th>
                      <th className="p-3">Eliminated</th>
                      <th className="p-3">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.entries?.map((e) => (
                      <tr
                        key={e.entry_id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="p-3">{e.rank}</td>
                        <td className="p-3 font-medium">
                          {e.username}
                          {e.is_winner && (
                            <span className="ml-2 text-amber-400">Winner</span>
                          )}
                        </td>
                        <td className="p-3 text-white/60">
                          {e.eliminated_in_round != null
                            ? `Round ${e.eliminated_in_round + 1}`
                            : "—"}
                        </td>
                        <td className="p-3 text-white/60">
                          {e.payout_wei
                            ? `$${(Number(e.payout_wei) / 1e6).toFixed(2)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
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
                  {e.username ?? e.address ?? `Entry #${e.id}`}
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
