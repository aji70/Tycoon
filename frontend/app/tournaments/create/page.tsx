"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useTournament } from "@/context/TournamentContext";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { appChain } from "@/config";
import type { PrizeSource, CreateTournamentResponse } from "@/types/tournament";
import { ChevronLeft, Loader2, Swords, Wallet, CheckCircle2 } from "lucide-react";
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
      "You deposit USDC into the escrow as the prize pool. Set the planned amount below; after creating, fund on the tournament page (wallet). Payouts use the DB amount for splits — keep it in sync with what you deposit.",
  },
];

const PLAYER_PRESETS = [8, 16, 32, 64, 128];

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

  const [step, setStep] = useState<"idle" | "signing_in" | "creating" | "success">("idle");
  const [createdResult, setCreatedResult] = useState<CreateTournamentResponse | null>(null);
  const [name, setName] = useState("");
  const chain = appChain ?? "CELO";
  const [prizeSource, setPrizeSource] = useState<PrizeSource>("NO_POOL");
  const [maxPlayers, setMaxPlayers] = useState(32);
  const [minPlayers, setMinPlayers] = useState(2);
  const [entryFeeUsd, setEntryFeeUsd] = useState("");
  const [prizePoolUsd, setPrizePoolUsd] = useState("");
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
  const canCreate = isSignedIn || hasWallet || isPrivyAuthed;
  const showAuthGate = !authLoading && !canCreate;
  const canUseWallet = hasWallet && !!loginByWallet;
  const canLoadAgents = isSignedIn || isPrivyAuthed;

  useEffect(() => {
    if (!autoFillBots) setSelectedAgentIds([]);
  }, [autoFillBots]);

  useEffect(() => {
    if (!autoFillBots || !canLoadAgents) return;
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      try {
        const res = await apiClient.get<ApiResponse<MyAgentRow[]>>("/agents");
        const list = res.data?.data;
        if (!cancelled) setMyAgents(Array.isArray(list) ? list : []);
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
      const sanitizedMaxPlayers = Math.min(MAX_PLAYERS_ALLOWED, Math.max(MIN_PLAYERS_ALLOWED, maxPlayers));
      const sanitizedMinPlayers = Math.max(MIN_PLAYERS_ALLOWED, Math.min(sanitizedMaxPlayers, minPlayers));
      if (!isPowerOfTwo(sanitizedMaxPlayers)) {
        setError("Max players must be a power of two (2, 4, 8, 16, 32, ... 512).");
        setStep("idle");
        return;
      }

      const body: Parameters<typeof createTournament>[0] & { address?: string; wallet_chain?: string } = {
        name: name.trim(),
        chain,
        prize_source: prizeSource,
        max_players: sanitizedMaxPlayers,
        min_players: sanitizedMinPlayers,
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
        if (prizePoolUsd.trim() !== "" && !Number.isNaN(poolUsd) && poolUsd > 0) {
          body.prize_pool_wei = String(Math.round(poolUsd * 10 ** USDC_DECIMALS));
        }
      }
      const created = await createTournament(body) as CreateTournamentResponse | null;
      const slug = created?.code ?? created?.id;
      if (slug != null) {
        if (autoFillBots && created?.id) {
          try {
            const desired = autoFillCount > 0 ? autoFillCount : Math.max(0, (body.min_players ?? 2) - 1);
            await apiClient.post(`/tournaments/${created.id}/auto-fill-agents`, {
              desired_count: desired,
              ...(selectedAgentIds.length > 0 ? { user_agent_ids: selectedAgentIds } : {}),
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
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white flex flex-col items-center justify-center px-4">
        <nav aria-label="Breadcrumb" className="absolute top-6 left-4 text-xs text-slate-500 flex items-center gap-1.5">
          <Link href="/tournaments" className="text-cyan-400/80 hover:text-cyan-400 transition">Tournaments</Link>
          <span aria-hidden className="text-slate-600">›</span>
          <Link href="/tournaments/create" className="text-cyan-400/80 hover:text-cyan-400 transition">Create</Link>
          <span aria-hidden className="text-slate-600">›</span>
          <span className="text-slate-400">Success</span>
        </nav>
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Tournament created</h2>
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
            className="text-cyan-400 hover:text-cyan-300 text-sm underline mt-1"
          >
            View transaction
          </a>
        )}
        <p className="text-cyan-400/90 mt-3">Taking you to the tournament page…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white pt-[80px] md:pt-0">
      <header className="sticky top-0 z-40 px-4 py-4 pr-20 md:pr-8 md:px-8 border-b border-white/10 bg-[#010F10]/90 backdrop-blur-md space-y-1">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500 flex items-center gap-1.5">
          <Link href="/tournaments" className="text-cyan-400/80 hover:text-cyan-400 transition">
            Tournaments
          </Link>
          <span aria-hidden className="text-slate-600">›</span>
          <span className="text-slate-400">Create</span>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href="/tournaments"
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm"
          >
            <ChevronLeft className="w-5 h-5" />
            Tournaments
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-cyan-400 flex items-center gap-2">
            <Swords className="w-6 h-6 text-cyan-400" />
            Create tournament
          </h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {authLoading && (
          <div className="rounded-2xl border border-[#0E282A] bg-[#011112]/80 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
            <p className="text-cyan-400/90">Checking sign-in…</p>
          </div>
        )}

        {showAuthGate && (
          <div className="rounded-2xl border border-[#0E282A] bg-[#011112]/80 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white">Sign in to create a tournament</h2>
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="button"
              onClick={() => login()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-medium hover:bg-cyan-500/30 transition"
            >
              Sign in
            </button>

            {canUseWallet && (
              <button
                type="button"
                onClick={handleSignInWithWallet}
                disabled={step === "signing_in"}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0E282A] border border-cyan-500/40 text-cyan-300 font-medium hover:bg-cyan-500/10 disabled:opacity-60 transition"
              >
                {step === "signing_in" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wallet className="w-5 h-5" />
                )}
                {step === "signing_in" ? "Signing in…" : "Sign in with wallet"}
              </button>
            )}

            {!isConnected && (
              <p className="text-sm text-amber-400/90">
                Or connect your wallet in the menu, then refresh.
              </p>
            )}

            <p className="text-sm text-white/60 mt-4">Sign in with Privy (from the app header or home) or connect your wallet to create a tournament.</p>
          </div>
        )}

        {!authLoading && canCreate && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-sm text-emerald-400/90 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {isPrivyAuthed ? "Signed in" : isSignedIn ? `Signed in as ${guestUser?.username ?? "user"}` : "Connected with wallet"}
            </p>

            <div className="rounded-2xl border border-white/10 bg-[#011112]/80 p-5 space-y-4">
              <div>
              <label htmlFor="name" className="block text-sm font-medium text-white/90 mb-1.5">
                Tournament name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend Cup"
                className="w-full px-4 py-3 rounded-xl bg-[#011112] border border-[#0E282A] text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819]"
                maxLength={200}
              />
              </div>

              <div className="flex items-center justify-between text-sm">
                <p className="text-white/50">Chain: <span className="text-cyan-300 font-semibold">{chain}</span></p>
                <p className="text-white/50">Format: <span className="text-cyan-300 font-semibold">Single elimination</span></p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#011112]/70 p-5 space-y-4">
              <label className="block text-sm font-medium text-white/90 mb-2">Prize source</label>
              <div className="space-y-3">
                {PRIZE_SOURCES.map(({ value, label, description }) => (
                  <label
                    key={value}
                    className={`flex flex-col gap-0.5 p-3 rounded-xl border cursor-pointer transition ${
                      prizeSource === value
                        ? "bg-cyan-500/10 border-cyan-500/50"
                        : "bg-[#011112]/50 border-[#0E282A] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="prize_source"
                        value={value}
                        checked={prizeSource === value}
                        onChange={() => setPrizeSource(value)}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="font-medium text-white/95">{label}</span>
                    </div>
                    <span className="text-xs text-white/55 pl-6">{description}</span>
                  </label>
                ))}
              </div>
              {prizeSource === "ENTRY_FEE_POOL" && (
                <div>
                  <label htmlFor="entry_fee" className="block text-sm font-medium text-white/90 mb-1">
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
                    className="w-full px-4 py-3 rounded-xl bg-[#011112] border border-[#0E282A] text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819]"
                  />
                </div>
              )}
              {prizeSource === "CREATOR_FUNDED" && (
                <div>
                  <label htmlFor="prize_pool" className="block text-sm font-medium text-white/90 mb-1">
                    Planned prize pool (USDC, optional)
                  </label>
                  <input
                    id="prize_pool"
                    type="number"
                    min={0}
                    step={0.01}
                    value={prizePoolUsd}
                    onChange={(e) => setPrizePoolUsd(e.target.value)}
                    placeholder="e.g. 100 — used for payout math; fund the same on-chain after create"
                    className="w-full px-4 py-3 rounded-xl bg-[#011112] border border-[#0E282A] text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819]"
                  />
                  <p className="text-xs text-white/50 mt-1.5">
                    Default winner split: 50% / 30% / 15% / 5% for 1st–4th. When the tournament completes, USDC is sent to
                    winners&apos; smart wallets (per backend payout job).
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#011112]/70 p-5 space-y-4">
              <p className="text-sm font-semibold text-white/90">Bracket size</p>
              <div className="flex flex-wrap gap-2">
                {PLAYER_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMaxPlayers(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      maxPlayers === v
                        ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-200"
                        : "bg-white/5 border-white/10 text-white/70 hover:border-cyan-500/40"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="max_players" className="block text-sm font-medium text-white/90 mb-1">
                  Max players
                </label>
                <input
                  id="max_players"
                  type="number"
                  min={2}
                  max={512}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value) || 32)}
                  className="w-full px-4 py-3 rounded-xl bg-[#011112] border border-[#0E282A] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819]"
                />
                <p className="text-xs text-white/50 mt-1">e.g. 8, 32, or 512 for single-elimination (max 512)</p>
              </div>
              <div>
                <label htmlFor="min_players" className="block text-sm font-medium text-white/90 mb-1">
                  Min players
                </label>
                <input
                  id="min_players"
                  type="number"
                  min={2}
                  max={maxPlayers}
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(Number(e.target.value) || 2)}
                  className="w-full px-4 py-3 rounded-xl bg-[#011112] border border-[#0E282A] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819]"
                />
              </div>
            </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs">
                <p className="text-cyan-200 font-semibold">Live setup preview</p>
                <p className="text-white/70 mt-1">
                  Bracket: {sanitizedMaxPreview} players {isMaxPowerOfTwo ? "ready" : "(must be power of two)"} ·
                  start when at least {sanitizedMinPreview} players join.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#011112]/70 p-5 space-y-4">
              <p className="text-sm font-semibold text-white/90">Quick start (bots)</p>
              <label className="flex items-center justify-between gap-3 text-sm text-white/80">
                <span>Auto-fill with available bots and start immediately</span>
                <input
                  type="checkbox"
                  checked={autoFillBots}
                  onChange={(e) => setAutoFillBots(e.target.checked)}
                  className="text-cyan-500 focus:ring-cyan-500"
                />
              </label>
              {autoFillBots && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/60 mb-1.5">Bot count (optional)</label>
                      <input
                        type="number"
                        min={0}
                        max={512}
                        value={autoFillCount}
                        onChange={(e) => setAutoFillCount(Number(e.target.value) || 0)}
                        className="w-full px-4 py-3 rounded-xl bg-[#011112] border border-[#0E282A] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819]"
                        placeholder="0 = auto"
                      />
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Fills with agents that have tournament auto-join enabled and a max entry fee that covers this event.
                      Pick your agents below (optional); they are tried first in order, then any other eligible agents.
                    </p>
                  </div>
                  {canLoadAgents && (
                    <div className="rounded-xl border border-[#0E282A] bg-[#011112]/60 p-3">
                      <p className="text-xs font-medium text-cyan-300/90 mb-2">Your agents (optional)</p>
                      {agentsLoading ? (
                        <p className="text-xs text-white/50">Loading agents…</p>
                      ) : myAgents.length === 0 ? (
                        <p className="text-xs text-white/50">
                          No agents yet. Create one under Manage agents, enable tournament permission in Profile (PIN), then
                          try again.
                        </p>
                      ) : (
                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                          {myAgents.map((a) => (
                            <li key={a.id}>
                              <label className="flex items-center gap-2 text-sm text-white/85 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedAgentIds.includes(a.id)}
                                  onChange={() => toggleAgentPick(a.id)}
                                  className="text-cyan-500 focus:ring-cyan-500 rounded"
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
                    <p className="text-xs text-amber-400/90">
                      Sign in (guest or header) to choose specific agents for quick start.
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {warning && <p className="text-amber-300 text-sm">{warning}</p>}

            <button
              type="submit"
              disabled={step === "creating"}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-500/30 border border-cyan-500/60 text-cyan-200 font-semibold hover:bg-cyan-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {step === "creating" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Swords className="w-5 h-5" />
              )}
              {step === "creating" ? "Creating tournament…" : "Create tournament"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
