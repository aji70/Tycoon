'use client';

import Link from 'next/link';
import { ChevronLeft, Loader2, User } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { celo } from 'wagmi/chains';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import TycoonABI from '@/context/abi/tycoonabi.json';

const CELO_CHAIN_ID = celo.id;

function formatStakeOrEarned(value: number): string {
  if (value >= 1e18) return (value / 1e18).toFixed(2);
  if (value >= 1e15) return (value / 1e18).toFixed(4);
  return String(value);
}

export default function PublicPlayerProfile({ username }: { username: string }) {
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[CELO_CHAIN_ID];
  const { data, isLoading, isError } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username] : undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!username && !!tycoonAddress },
  });

  const parsed = (() => {
    if (!data) return null;
    const t = data as [bigint, string, string, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    const id = t[0];
    if (id === undefined || BigInt(id) === 0n) return null;
    const playerAddress = String(t[2] ?? '');
    const gamesPlayed = Number(t[4] ?? 0);
    const gamesWon = Number(t[5] ?? 0);
    const gamesLost = Number(t[6] ?? 0);
    const totalStaked = Number(t[7] ?? 0);
    const totalEarned = Number(t[8] ?? 0);
    const totalWithdrawn = Number(t[9] ?? 0);
    const registeredAt = Number(t[3] ?? 0);
    return {
      username: String(t[1] ?? username),
      playerAddress,
      shortAddress:
        playerAddress && playerAddress.length > 10
          ? `${playerAddress.slice(0, 6)}…${playerAddress.slice(-4)}`
          : playerAddress || '—',
      gamesPlayed,
      gamesWon,
      gamesLost,
      winRate: gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : '0',
      totalStaked,
      totalEarned,
      totalWithdrawn,
      registeredAt,
    };
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-4 md:px-8 border-b border-white/10 bg-[#010F10]/90 backdrop-blur-md">
        <Link
          href="/leaderboard"
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Leaderboard
        </Link>
        <h1 className="text-lg md:text-xl font-bold text-cyan-400 flex items-center gap-2 truncate max-w-[50%]">
          <User className="w-5 h-5 shrink-0 text-cyan-400" />
          <span className="truncate">{username}</span>
        </h1>
        <div className="w-16 shrink-0" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <p className="text-white/60 text-sm">Loading player…</p>
          </div>
        ) : isError || !parsed ? (
          <div className="rounded-2xl border border-white/10 bg-[#0E1415]/80 p-8 text-center">
            <p className="text-white/80 mb-2">No on-chain profile found for this name.</p>
            <p className="text-white/50 text-sm mb-6">Players must be registered on Tycoon (Celo) to appear here.</p>
            <Link href="/leaderboard" className="text-cyan-400 font-semibold hover:text-cyan-300">
              Back to leaderboard
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-500/20 bg-[#0E1415]/90 backdrop-blur-sm overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.06)]">
            <div className="p-6 border-b border-white/10 bg-gradient-to-br from-cyan-500/10 to-transparent">
              <p className="text-cyan-300/90 text-xs uppercase tracking-widest mb-1">Tycoon player</p>
              <h2 className="text-2xl font-bold text-white break-all">{parsed.username}</h2>
              <p className="text-white/50 text-sm font-mono mt-2">{parsed.shortAddress}</p>
            </div>
            <dl className="p-6 grid gap-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">Games played</dt>
                <dd className="font-semibold text-cyan-200 tabular-nums">{parsed.gamesPlayed}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">Wins</dt>
                <dd className="font-semibold text-emerald-300 tabular-nums">{parsed.gamesWon}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">Losses</dt>
                <dd className="font-semibold text-white/70 tabular-nums">{parsed.gamesLost}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">Win rate</dt>
                <dd className="font-semibold text-cyan-200 tabular-nums">{parsed.winRate}%</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">Total staked</dt>
                <dd className="font-semibold text-white tabular-nums">{formatStakeOrEarned(parsed.totalStaked)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">Total earned</dt>
                <dd className="font-semibold text-emerald-200/90 tabular-nums">{formatStakeOrEarned(parsed.totalEarned)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/50">Total withdrawn</dt>
                <dd className="font-semibold text-white/80 tabular-nums">{formatStakeOrEarned(parsed.totalWithdrawn)}</dd>
              </div>
            </dl>
            {parsed.registeredAt > 0 ? (
              <p className="px-6 pb-6 text-xs text-white/40">
                Registered {new Date(parsed.registeredAt * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })} UTC
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
