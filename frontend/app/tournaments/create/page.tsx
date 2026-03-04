"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useTournament } from "@/context/TournamentContext";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { appChain } from "@/config";
import type { PrizeSource, CreateTournamentResponse } from "@/types/tournament";
import { ChevronLeft, Loader2, Swords, Wallet, User, CheckCircle2 } from "lucide-react";

const USDC_DECIMALS = 6;

function chainIdToBackendChain(chainId: number): string {
  if (chainId === 137 || chainId === 80001) return "POLYGON";
  if (chainId === 42220 || chainId === 44787) return "CELO";
  if (chainId === 8453 || chainId === 84531) return "BASE";
  return "CELO";
}

const PRIZE_SOURCES: { value: PrizeSource; label: string; description: string }[] = [
  { value: "NO_POOL", label: "No prize pool", description: "Free to enter, no prizes" },
  { value: "ENTRY_FEE_POOL", label: "Entry fee pool", description: "Players pay entry; pool goes to winners" },
  { value: "CREATOR_FUNDED", label: "Creator funded", description: "You add the prize pool (after creation)" },
];

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
  const loginGuest = guestAuth?.loginGuest;
  const { createTournament } = useTournament();

  const [step, setStep] = useState<"idle" | "signing_in" | "creating" | "success">("idle");
  const [createdResult, setCreatedResult] = useState<CreateTournamentResponse | null>(null);
  const [name, setName] = useState("");
  const chain = appChain ?? "CELO";
  const [prizeSource, setPrizeSource] = useState<PrizeSource>("NO_POOL");
  const [maxPlayers, setMaxPlayers] = useState(32);
  const [minPlayers, setMinPlayers] = useState(2);
  const [entryFeeUsd, setEntryFeeUsd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [guestUsername, setGuestUsername] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

  const isPrivyAuthed = ready && authenticated;
  const isSignedIn = !!guestUser;
  const hasWallet = isConnected && !!address;
  const canCreate = isSignedIn || hasWallet || isPrivyAuthed;
  const showAuthGate = !authLoading && !canCreate;
  const canUseWallet = hasWallet && !!loginByWallet;

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

  const handleSignInAsGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginGuest || !guestUsername.trim() || !guestPassword) {
      setError("Username and password required");
      return;
    }
    setError(null);
    setGuestLoading(true);
    try {
      const res = await loginGuest(guestUsername.trim(), guestPassword);
      if (!res.success) setError(res.message ?? "Login failed");
    } catch (e) {
      setError((e as Error)?.message ?? "Login failed");
    } finally {
      setGuestLoading(false);
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
    setStep("creating");
    try {
      const body: Parameters<typeof createTournament>[0] & { address?: string; wallet_chain?: string } = {
        name: name.trim(),
        chain,
        prize_source: prizeSource,
        max_players: Math.min(512, Math.max(2, maxPlayers)),
        min_players: Math.max(2, Math.min(maxPlayers, minPlayers)),
      };
      if (!isSignedIn && address) {
        body.address = address;
        body.wallet_chain = chainIdToBackendChain(chainId);
      }
      if (prizeSource === "ENTRY_FEE_POOL") {
        const usd = parseFloat(entryFeeUsd);
        body.entry_fee_wei = !Number.isNaN(usd) && usd >= 0 ? Math.round(usd * 10 ** USDC_DECIMALS) : 0;
      }
      const created = await createTournament(body) as CreateTournamentResponse | null;
      const slug = created?.code ?? created?.id;
      if (slug != null) {
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

            <div className="border-t border-white/10 pt-6">
              <p className="text-sm text-white/70 mb-3">Or continue as guest</p>
              <form onSubmit={handleSignInAsGuest} className="space-y-3">
                <input
                  type="text"
                  placeholder="Username"
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0E282A] border border-white/10 text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819] text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={guestPassword}
                  onChange={(e) => setGuestPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0E282A] border border-white/10 text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819] text-sm"
                />
                <button
                  type="submit"
                  disabled={guestLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 text-white/90 font-medium hover:bg-white/15 disabled:opacity-50 text-sm"
                >
                  {guestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                  Sign in as guest
                </button>
              </form>
              <p className="text-xs text-white/50 mt-2">No account? Use any username and password to create one.</p>
            </div>
          </div>
        )}

        {!authLoading && canCreate && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-sm text-emerald-400/90 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {isPrivyAuthed ? "Signed in" : isSignedIn ? `Signed in as ${guestUser?.username ?? "user"}` : "Connected with wallet"}
            </p>

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

            <p className="text-sm text-white/50">Chain: {chain}</p>

            <div>
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
                  placeholder="0 for free, e.g. 1 for $1"
                  className="w-full px-4 py-3 rounded-xl bg-[#011112] border border-[#0E282A] text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1819]"
                />
                <p className="text-xs text-white/50 mt-1">Amount in USDC (e.g. 1 = $1)</p>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

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
