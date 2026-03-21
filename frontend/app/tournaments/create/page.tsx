"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useTournament } from "@/context/TournamentContext";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { appChain } from "@/config";
import type {
  PrizeSource,
  CreateTournamentResponse,
  TournamentFormat,
  TournamentVisibility,
} from "@/types/tournament";
import { useFundPrizePool } from "@/hooks/useFundPrizePool";
import { ChevronLeft, Loader2, Swords, Wallet, CheckCircle2, Eye, Trophy, Users, Zap, Link2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

type MyAgentRow = { id: number; name: string };

const USDC_DECIMALS = 6;
const MAX_PLAYERS_ALLOWED = 512;
const MIN_PLAYERS_ALLOWED = 2;

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

function chainIdToBackendChain(chainId: number): string {
  if (chainId === 137 || chainId === 80001) return "POLYGON";
  if (chainId === 42220 || chainId === 44787) return "CELO";
  if (chainId === 8453 || chainId === 84531) return "BASE";
  return "CELO";
}

const PRIZE_SOURCES: { value: PrizeSource; label: string; description: string }[] = [
  { value: "NO_POOL", label: "No prize pool", description: "Free to enter, no prizes" },
  { value: "ENTRY_FEE_POOL", label: "Entry fee pool", description: "Players pay entry; pool goes to winners" },
  {
    value: "CREATOR_FUNDED",
    label: "Creator funded",
    description:
      "Set the pool amount below; after create we prompt your wallet to deposit USDC into escrow (same amount). Payouts use this amount for winner splits.",
  },
];

const PLAYER_PRESETS = [8, 16, 32, 64, 128];

const VISIBILITY_OPTIONS: { value: TournamentVisibility; label: string; description: string }[] = [
  { value: "OPEN", label: "Open", description: "Listed on the Arena → Tournaments tab for everyone." },
  {
    value: "INVITE_ONLY",
    label: "Invite only",
    description: "Hidden from the public list. Share the invite link from the tournament page after create.",
  },
  {
    value: "BOT_SELECTION",
    label: "Invited bots only",
    description: "Pick public agents from Discover (like challenging). Only those agent owners can register.",
  },
];

type DiscoverAgent = { id: number; name: string; username?: string };

export default function CreateTournamentPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { ready, authenticated, login } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const authLoading = guestAuth?.isLoading ?? false;
  const loginByWallet = guestAuth?.loginByWallet;
  const { createTournament } = useTournament();
  const { fund: fundPrizePoolOnChain, isPending: fundPoolPending } = useFundPrizePool();

  const [step, setStep] = useState<"idle" | "signing_in" | "creating" | "success">("idle");
  const [createdResult, setCreatedResult] = useState<CreateTournamentResponse | null>(null);
  const [name, setName] = useState("");
  const chain = appChain ?? "CELO";
  const [prizeSource, setPrizeSource] = useState<PrizeSource>("NO_POOL");
  const [maxPlayers, setMaxPlayers] = useState(32);
  const [minPlayers, setMinPlayers] = useState(2);
  const [entryFeeUsd, setEntryFeeUsd] = useState("");
  const [prizePoolUsd, setPrizePoolUsd] = useState("");
  const [bracketFormat, setBracketFormat] = useState<TournamentFormat>("GROUP_ELIMINATION");
  const [visibility, setVisibility] = useState<TournamentVisibility>("OPEN");
  const [isAgentOnly, setIsAgentOnly] = useState(true);
  const [discoverAgents, setDiscoverAgents] = useState<DiscoverAgent[]>([]);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [selectedDiscoverIds, setSelectedDiscoverIds] = useState<number[]>([]);
  const [autoFillBots, setAutoFillBots] = useState(false);
  const [autoFillCount, setAutoFillCount] = useState(0);
  const [myAgents, setMyAgents] = useState<MyAgentRow[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const isPrivyAuthed = ready && authenticated;
  const isSignedIn = !!guestUser;
  const hasWallet = isConnected && !!address;
  const canCreate = isSignedIn || hasWallet;
  const showAuthGate = !authLoading && !canCreate;
  const canUseWallet = hasWallet && !!loginByWallet;
  const canLoadAgents = isSignedIn;

  useEffect(() => {
    if (!autoFillBots) setSelectedAgentIds([]);
  }, [autoFillBots]);

  useEffect(() => {
    if (visibility !== "BOT_SELECTION") {
      setSelectedDiscoverIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setDiscoverLoading(true);
      try {
        const res = await apiClient.get<{ agents?: DiscoverAgent[] }>(
          `/arena/agents?page=${discoverPage}&page_size=24`
        );
        const agents = res?.data?.agents;
        if (!cancelled) setDiscoverAgents(Array.isArray(agents) ? agents : []);
      } catch {
        if (!cancelled) setDiscoverAgents([]);
      } finally {
        if (!cancelled) setDiscoverLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibility, discoverPage]);

  useEffect(() => {
    if (!autoFillBots || !canLoadAgents) return;
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      try {
        const res = await apiClient.get<ApiResponse<MyAgentRow[]>>("/agents");
        const list = res?.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
        if (!cancelled) setMyAgents(list);
      } catch {
        if (!cancelled) setMyAgents([]);
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoFillBots, canLoadAgents]);

  const toggleAgentPick = (agentId: number) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((x) => x !== agentId) : [...prev, agentId]
    );
  };

  const toggleDiscoverPick = (agentId: number) => {
    setSelectedDiscoverIds((prev) => {
      if (prev.includes(agentId)) return prev.filter((x) => x !== agentId);
      if (prev.length >= 64) return prev;
      return [...prev, agentId];
    });
  };

  const sanitizedMaxPreview = Math.min(MAX_PLAYERS_ALLOWED, Math.max(MIN_PLAYERS_ALLOWED, maxPlayers));
  const sanitizedMinPreview = Math.max(MIN_PLAYERS_ALLOWED, Math.min(sanitizedMaxPreview, minPlayers));
  const isMaxPowerOfTwo = isPowerOfTwo(sanitizedMaxPreview);

  const handleSignInWithWallet = async () => {
    if (!address || !loginByWallet) return;
    setError(null);
    setStep("signing_in");
    try {
      const message = `Sign in to Tycoon at ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      const walletChain = chainIdToBackendChain(chainId);
      const res = await loginByWallet({ address, chain: walletChain, message, signature });
      if (!res.success) {
        setError(res.message ?? "Sign in failed. Register first via Profile.");
        setStep("idle");
      }
    } catch (e) {
      setError((e as Error)?.message ?? "Sign in failed");
      setStep("idle");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!canCreate) {
      setError("Connect your wallet or sign in to create a tournament");
      return;
    }
    setError(null);
    setWarning(null);
    setStep("creating");
    try {
      if (visibility === "BOT_SELECTION" && selectedDiscoverIds.length < 2) {
        setError("Pick at least two public agents from Discover for an invited-bot tournament.");
        setStep("idle");
        return;
      }

      const sanitizedMaxPlayers = Math.min(MAX_PLAYERS_ALLOWED, Math.max(MIN_PLAYERS_ALLOWED, maxPlayers));
      const sanitizedMinPlayers = Math.max(MIN_PLAYERS_ALLOWED, Math.min(sanitizedMaxPlayers, minPlayers));
      if (bracketFormat !== "GROUP_ELIMINATION" && !isPowerOfTwo(sanitizedMaxPlayers)) {
        setError("Max players must be a power of two (2, 4, 8, 16, 32, ... 512).");
        setStep("idle");
        return;
      }

      const body: Parameters<typeof createTournament>[0] & { address?: string; wallet_chain?: string } = {
        name: name.trim(),
        chain,
        format: bracketFormat,
        prize_source: prizeSource,
        max_players: sanitizedMaxPlayers,
        min_players: sanitizedMinPlayers,
        visibility,
        is_agent_only: visibility === "BOT_SELECTION" ? true : isAgentOnly,
        ...(visibility === "BOT_SELECTION" ? { allowed_agent_ids: selectedDiscoverIds } : {}),
      };
      if (!isSignedIn && address) {
        body.address = address;
        body.wallet_chain = chainIdToBackendChain(chainId);
      }
      if (prizeSource === "ENTRY_FEE_POOL") {
        const usd = parseFloat(entryFeeUsd);
        if (Number.isNaN(usd) || usd <= 0) {
          setError("Entry fee must be greater than 0 for entry-fee tournaments.");
          setStep("idle");
          return;
        }
        body.entry_fee_wei = Math.round(usd * 10 ** USDC_DECIMALS);
      }
      if (prizeSource === "CREATOR_FUNDED") {
        const poolUsd = parseFloat(prizePoolUsd);
        if (Number.isNaN(poolUsd) || poolUsd <= 0) {
          setError("Creator-funded tournaments require a prize pool amount (USDC).");
          setStep("idle");
          return;
        }
        body.prize_pool_wei = String(Math.round(poolUsd * 10 ** USDC_DECIMALS));
      }
      const created = await createTournament(body) as CreateTournamentResponse | null;
      const slug = created?.code ?? created?.id;
      if (slug != null) {
        if (prizeSource === "CREATOR_FUNDED" && created?.id && address) {
          const poolUsd = parseFloat(prizePoolUsd);
          if (!Number.isNaN(poolUsd) && poolUsd > 0) {
            try {
              const wei = BigInt(Math.round(poolUsd * 10 ** USDC_DECIMALS));
              await fundPrizePoolOnChain(created.id, wei);
            } catch (fundErr) {
              setWarning(
                `Tournament created, but on-chain deposit failed: ${(fundErr as Error)?.message || "unknown"}. You can fund from the tournament page.`
              );
            }
          }
        }
        if (autoFillBots && created?.id) {
          try {
            const minP = body.min_players ?? 2;
            const inviteIds =
              visibility === "BOT_SELECTION" && selectedDiscoverIds.length > 0 ? selectedDiscoverIds : [];
            const preferredIds =
              inviteIds.length > 0 ? inviteIds : selectedAgentIds.length > 0 ? selectedAgentIds : [];
            const desired = Math.max(
              autoFillCount > 0 ? autoFillCount : minP,
              minP,
              preferredIds.length
            );
            await apiClient.post(`/tournaments/${created.id}/auto-fill-agents`, {
              desired_count: desired,
              ...(preferredIds.length > 0 ? { user_agent_ids: preferredIds } : {}),
            });
            await apiClient.post(`/tournaments/${created.id}/close-registration`, { first_round_start_at: new Date().toISOString() });
            await apiClient.post(`/tournaments/${created.id}/start-round/0`, {});
          } catch (fillErr) {
            const msg =
              (fillErr as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
              (fillErr as Error)?.message ||
              "Auto-fill/start failed after create.";
            setWarning(`Tournament created, but quick-start did not fully complete: ${msg}`);
          }
        }
        setCreatedResult(created ?? null);
        setStep("success");
        setTimeout(() => router.push(`/tournaments/${slug}`), 1200);
        return;
      }
      setError("Failed to create tournament");
      setStep("idle");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as Error)?.message ||
        "Failed to create tournament";
      setError(message);
      setStep("idle");
    }
  };

  function txExplorerUrl(chainName: string, txHash: string): string {
    const chain = String(chainName).toUpperCase();
    if (chain === "POLYGON") return `https://polygonscan.com/tx/${txHash}`;
    if (chain === "BASE") return `https://basescan.org/tx/${txHash}`;
    if (chain === "CELO") return `https://celoscan.io/tx/${txHash}`;
    return `https://celoscan.io/tx/${txHash}`;
  }

  if (step === "success") {
    const onChain = createdResult?.created_on_chain ?? false;
    const onChainError = createdResult?.on_chain_error ?? null;
    const txHash = createdResult?.on_chain_tx_hash ?? null;
    const chainName = createdResult?.chain ?? chain;
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] via-[#0a1618] to-[#0E1415] text-white flex flex-col items-center justify-center px-4">
        <nav aria-label="Breadcrumb" className="absolute top-6 left-4 text-xs text-white/50 flex items-center gap-1.5">
          <Link href="/tournaments" className="text-cyan-400/80 hover:text-cyan-400 transition">Tournaments</Link>
          <span aria-hidden className="text-white/30">›</span>
          <Link href="/tournaments/create" className="text-cyan-400/80 hover:text-cyan-400 transition">Create</Link>
          <span aria-hidden className="text-white/30">›</span>
          <span className="text-white/70">Success</span>
        </nav>
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Tournament created</h2>
        {onChain && (
          <p className="text-emerald-400/90 mb-1">Registered on-chain.</p>
        )}
        {!onChain && onChainError && (
          <p className="text-amber-400/90 text-sm text-center max-w-md mb-1">
            Saved; not on-chain: {onChainError}
          </p>
        )}
        {txHash && (
          <a
            href={txExplorerUrl(chainName, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-sm underline mt-1 transition"
          >
            View transaction
          </a>
        )}
        <div className="flex items-center gap-2 mt-6 text-cyan-400/90">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Taking you to the tournament page…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] via-[#0a1618] to-[#0E1415] text-white pt-[80px] md:pt-0">
      <header className="sticky top-0 z-40 px-4 py-4 pr-20 md:pr-8 md:px-8 border-b border-white/10 bg-[#010F10]/95 backdrop-blur-xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/50 flex items-center gap-1.5 mb-2">
          <Link href="/tournaments" className="text-cyan-400/80 hover:text-cyan-400 transition">
            Tournaments
          </Link>
          <span aria-hidden className="text-white/30">›</span>
          <span className="text-white/70">Create</span>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href="/tournaments"
            className="flex items-center gap-2 text-cyan-400/90 hover:text-cyan-300 font-medium text-sm transition"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30">
              <Swords className="w-5 h-5 text-cyan-400" />
            </span>
            Create tournament
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {authLoading && (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#011112]/90 to-[#011112]/60 p-12 text-center shadow-lg shadow-black/20">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-white/80 font-medium">Checking sign-in…</p>
            <p className="text-white/50 text-sm mt-1">One moment</p>
          </div>
        )}

        {showAuthGate && (
          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#011112]/90 to-[#011112]/60 p-8 shadow-lg shadow-black/20">
            <h2 className="text-xl font-semibold text-white mb-2">Sign in to create a tournament</h2>
            <p className="text-white/60 text-sm mb-6">Connect your account to create and manage tournaments.</p>
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 mb-6">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => login()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-200 font-medium hover:bg-cyan-500/35 transition"
              >
                Sign in with Privy
              </button>
              {canUseWallet && (
                <button
                  type="button"
                  onClick={handleSignInWithWallet}
                  disabled={step === "signing_in"}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/90 font-medium hover:bg-white/10 disabled:opacity-60 transition"
                >
                  {step === "signing_in" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Wallet className="w-5 h-5" />
                  )}
                  {step === "signing_in" ? "Signing in…" : "Sign in with wallet"}
                </button>
              )}
            </div>
            {!isConnected && (
              <p className="text-sm text-amber-400/90 mt-4">
                Or connect your wallet in the menu, then refresh.
              </p>
            )}
          </section>
        )}

        {!authLoading && canCreate && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-medium text-emerald-300/95">
                  {isPrivyAuthed ? "Signed in" : isSignedIn ? `Signed in as ${guestUser?.username ?? "user"}` : "Connected with wallet"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              {/* Left column */}
              <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#011112]/95 to-[#011112]/70 p-6 shadow-xl shadow-black/30 ring-1 ring-white/5">
              <h2 className="text-sm font-semibold text-cyan-200/95 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Swords className="w-4 h-4 text-cyan-400/90" />
                Basics
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white/90 mb-1.5">
                    Tournament name <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Weekend Cup"
                    className="w-full px-4 py-3 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-white placeholder-white/35 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-0 transition"
                    maxLength={200}
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/50">Chain</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold text-sm">
                      {chain}
                    </span>
                  </div>
                  <label className="flex flex-col gap-1.5 min-w-[200px]">
                    <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Bracket format</span>
                    <select
                      value={bracketFormat}
                      onChange={(e) => setBracketFormat(e.target.value as TournamentFormat)}
                      className="px-3 py-2.5 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-cyan-200 text-sm focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
                    >
                      <option value="SINGLE_ELIMINATION">Single elimination (1v1)</option>
                      <option value="GROUP_ELIMINATION">Group tables (2–4 per match, regroup each round)</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#011112]/95 to-[#011112]/70 p-6 shadow-xl shadow-black/30 ring-1 ring-white/5">
              <h2 className="text-sm font-semibold text-cyan-200/95 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400/90" />
                Arena visibility
              </h2>
              <p className="text-xs text-white/50 mb-4">Who can see and join this tournament</p>
              <div className="space-y-2.5">
                {VISIBILITY_OPTIONS.map(({ value: v, label, description }) => (
                  <label
                    key={v}
                    className={`flex flex-col gap-1 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                      visibility === v
                        ? "bg-cyan-500/12 border-cyan-400/50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                        : "bg-[#011112]/40 border-[#0E282A] hover:border-white/15 hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        visibility === v ? "border-cyan-400 bg-cyan-400/30" : "border-white/30"
                      }`}>
                        {visibility === v && <span className="h-2 w-2 rounded-full bg-cyan-300" />}
                      </span>
                      <input
                        type="radio"
                        name="visibility"
                        value={v}
                        checked={visibility === v}
                        onChange={() => setVisibility(v)}
                        className="sr-only"
                      />
                      <span className="font-medium text-white/95">{label}</span>
                    </div>
                    <span className="text-xs text-white/55 pl-7 leading-relaxed">{description}</span>
                  </label>
                ))}
              </div>
              {visibility !== "BOT_SELECTION" && (
                <label className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition">
                  <input
                    type="checkbox"
                    checked={isAgentOnly}
                    onChange={(e) => setIsAgentOnly(e.target.checked)}
                    className="rounded border-white/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-white/85">Agents only — group tables avoid 2-bot games unless the whole event has only two players</span>
                </label>
              )}
            </section>

            {visibility === "BOT_SELECTION" && (
              <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/25 to-amber-950/10 p-6 shadow-xl shadow-black/30 ring-1 ring-amber-500/10">
                <h3 className="text-sm font-semibold text-amber-200/95 flex items-center gap-2 mb-1">
                  <Link2 className="w-4 h-4" />
                  Pick public agents (Discover)
                </h3>
                <p className="text-xs text-white/55 mb-4">
                  Same idea as Arena → Discover → Pick. At least two agents. Their owners are the only ones who can join.
                </p>
                {discoverLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-white/50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading agents…</span>
                  </div>
                ) : (
                  <>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {discoverAgents.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => toggleDiscoverPick(a.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                              selectedDiscoverIds.includes(a.id)
                                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15)]"
                                : "border-[#0E282A] bg-[#011112]/60 text-white/85 hover:border-white/25 hover:bg-white/[0.03]"
                            }`}
                          >
                            <span className="font-medium">{a.name}</span>
                            <span className="block text-[10px] text-white/45 mt-0.5">by {a.username ?? "—"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between text-xs text-white/50 mt-4 pt-3 border-t border-white/5">
                      <span className="font-medium text-white/60">Selected: {selectedDiscoverIds.length}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          disabled={discoverPage <= 1}
                          onClick={() => setDiscoverPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition"
                          onClick={() => setDiscoverPage((p) => p + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

              </div>
              {/* Right column */}
              <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#011112]/95 to-[#011112]/70 p-6 shadow-xl shadow-black/30 ring-1 ring-white/5">
              <h2 className="text-sm font-semibold text-cyan-200/95 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400/90" />
                Bracket size
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {PLAYER_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMaxPlayers(v)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      maxPlayers === v
                        ? "bg-cyan-500/25 border-cyan-400/60 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                        : "bg-white/5 border-white/10 text-white/70 hover:border-cyan-500/30 hover:text-white/90"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="max_players" className="block text-sm font-medium text-white/90 mb-1.5">
                    Max players
                  </label>
                  <input
                    id="max_players"
                    type="number"
                    min={2}
                    max={512}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value) || 32)}
                    className="w-full px-4 py-3 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-white focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-0 transition"
                  />
                  <p className="text-xs text-white/50 mt-1">8, 32, or 512 for single-elimination (max 512)</p>
                </div>
                <div>
                  <label htmlFor="min_players" className="block text-sm font-medium text-white/90 mb-1.5">
                    Min players
                  </label>
                  <input
                    id="min_players"
                    type="number"
                    min={2}
                    max={maxPlayers}
                    value={minPlayers}
                    onChange={(e) => setMinPlayers(Number(e.target.value) || 2)}
                    className="w-full px-4 py-3 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-white focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-0 transition"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/8 p-4">
                <p className="text-xs font-semibold text-cyan-200/95 uppercase tracking-wider mb-1.5">Live preview</p>
                <p className="text-sm text-white/80 leading-relaxed">
                  {bracketFormat === "GROUP_ELIMINATION" ? (
                    <>
                      Group elimination: tables of 2–4, rebalanced each round · max {sanitizedMaxPreview} players · start
                      when at least {sanitizedMinPreview} join.
                    </>
                  ) : (
                    <>
                      Bracket: {sanitizedMaxPreview} players {isMaxPowerOfTwo ? "ready" : "(must be power of two)"} ·
                      start when at least {sanitizedMinPreview} players join.
                    </>
                  )}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#011112]/95 to-[#011112]/70 p-6 shadow-xl shadow-black/30 ring-1 ring-white/5">
              <h2 className="text-sm font-semibold text-cyan-200/95 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400/90" />
                Quick start (bots)
              </h2>
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition">
                <span className="text-sm text-white/90">Auto-fill with available bots and start immediately</span>
                <input
                  type="checkbox"
                  checked={autoFillBots}
                  onChange={(e) => setAutoFillBots(e.target.checked)}
                  className="rounded border-white/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
              </label>
              {autoFillBots && (
                <div className="mt-4 space-y-4 pt-4 border-t border-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr,1.5fr] gap-4">
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Bot count (optional)</label>
                      <input
                        type="number"
                        min={0}
                        max={512}
                        value={autoFillCount}
                        onChange={(e) => setAutoFillCount(Number(e.target.value) || 0)}
                        className="w-full px-4 py-3 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-white focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-0 transition"
                        placeholder="0 = auto"
                      />
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed self-center">
                      Paid entry: agents with tournament permission. Free: any account with smart wallet + agent. Your agents below (optional) are tried first.
                    </p>
                  </div>
                  {canLoadAgents && (
                    <div className="rounded-xl border border-[#0E282A] bg-[#011112]/50 p-4">
                      <p className="text-xs font-medium text-cyan-300/95 mb-3">Your agents (optional)</p>
                      {agentsLoading ? (
                        <div className="flex items-center gap-2 py-4 text-white/50">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs">Loading…</span>
                        </div>
                      ) : myAgents.length === 0 ? (
                        <p className="text-xs text-white/50">
                          No agents yet. Create one in Manage agents. For paid tournaments, enable spending in Profile.
                        </p>
                      ) : (
                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                          {myAgents.map((a) => (
                            <li key={a.id}>
                              <label className="flex items-center gap-3 text-sm text-white/85 cursor-pointer py-1.5 rounded-lg hover:bg-white/[0.03] px-2 -mx-2">
                                <input
                                  type="checkbox"
                                  checked={selectedAgentIds.includes(a.id)}
                                  onChange={() => toggleAgentPick(a.id)}
                                  className="rounded border-white/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                                />
                                <span>{a.name}</span>
                                <span className="text-white/40 text-xs">#{a.id}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {!canLoadAgents && (
                    <p className="text-xs text-amber-400/90 flex items-center gap-2">
                      Sign in to choose specific agents for quick start.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#011112]/95 to-[#011112]/70 p-6 shadow-xl shadow-black/30 ring-1 ring-white/5">
              <h2 className="text-sm font-semibold text-cyan-200/95 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-cyan-400/90" />
                Prize source
              </h2>
              <p className="text-xs text-white/50 mb-4">How prizes are funded (or none for free play)</p>
              <div className="space-y-2.5">
                {PRIZE_SOURCES.map(({ value, label, description }) => (
                  <label
                    key={value}
                    className={`flex flex-col gap-1 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                      prizeSource === value
                        ? "bg-cyan-500/12 border-cyan-400/50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                        : "bg-[#011112]/40 border-[#0E282A] hover:border-white/15 hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        prizeSource === value ? "border-cyan-400 bg-cyan-400/30" : "border-white/30"
                      }`}>
                        {prizeSource === value && <span className="h-2 w-2 rounded-full bg-cyan-300" />}
                      </span>
                      <input
                        type="radio"
                        name="prize_source"
                        value={value}
                        checked={prizeSource === value}
                        onChange={() => setPrizeSource(value)}
                        className="sr-only"
                      />
                      <span className="font-medium text-white/95">{label}</span>
                    </div>
                    <span className="text-xs text-white/55 pl-7 leading-relaxed">{description}</span>
                  </label>
                ))}
              </div>
              {prizeSource === "ENTRY_FEE_POOL" && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <label htmlFor="entry_fee" className="block text-sm font-medium text-white/90 mb-1.5">
                    Entry fee (USDC)
                  </label>
                  <input
                    id="entry_fee"
                    type="number"
                    min={0}
                    step={0.01}
                    value={entryFeeUsd}
                    onChange={(e) => setEntryFeeUsd(e.target.value)}
                    placeholder="e.g. 1 for $1"
                    className="w-full px-4 py-3 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-white placeholder-white/35 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-0 transition"
                  />
                </div>
              )}
              {prizeSource === "CREATOR_FUNDED" && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <label htmlFor="prize_pool" className="block text-sm font-medium text-white/90 mb-1.5">
                    Planned prize pool (USDC)
                  </label>
                  <input
                    id="prize_pool"
                    type="number"
                    min={0}
                    step={0.01}
                    value={prizePoolUsd}
                    onChange={(e) => setPrizePoolUsd(e.target.value)}
                    placeholder="e.g. 100 — fund same amount on-chain after create"
                    className="w-full px-4 py-3 rounded-xl bg-[#010a0b]/80 border border-[#0E282A] text-white placeholder-white/35 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-0 transition"
                  />
                  <p className="text-xs text-white/50 mt-2 leading-relaxed">
                    Default winner split: 50% / 30% / 15% / 5% for 1st–4th. USDC is sent to winners&apos; smart wallets when the tournament completes.
                  </p>
                </div>
              )}
            </section>

              </div>

              <div className="lg:col-span-2 space-y-4 mt-2">
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 mb-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
            {warning && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 mb-4">
                <p className="text-sm text-amber-200">{warning}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={step === "creating" || fundPoolPending}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-gradient-to-r from-cyan-500/35 to-cyan-500/25 border border-cyan-400/50 text-cyan-100 font-semibold text-base hover:from-cyan-500/45 hover:to-cyan-500/35 hover:border-cyan-400/60 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:from-cyan-500/35 disabled:hover:to-cyan-500/25 transition-all shadow-lg shadow-cyan-500/10"
            >
              {step === "creating" || fundPoolPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Swords className="w-5 h-5" />
              )}
              {step === "creating" || fundPoolPending
                ? fundPoolPending
                  ? "Depositing prize pool…"
                  : "Creating tournament…"
                : "Create tournament"}
            </button>
            </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
