'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, User } from 'lucide-react';
import { apiClient } from '@/lib/api';

function formatStakeOrEarned(value: number): string {
  if (value >= 1e18) return (value / 1e18).toFixed(2);
  if (value >= 1e15) return (value / 1e18).toFixed(4);
  return String(value);
}

type StatsScope = 'all' | 'month';

function utcYearMonthNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabelUtc(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(Date.UTC(y, m - 1, 15, 12, 0, 0, 0)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function utcYearMonthOptions(count: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < count; i += 1) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    const value = `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: formatMonthLabelUtc(value) });
  }
  return out;
}

export default function PublicPlayerProfile({ username }: { username: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [row, setRow] = useState<any>(null);
  const [scope, setScope] = useState<StatsScope>('all');
  const [monthKey, setMonthKey] = useState<string>(() => utcYearMonthNow());
  const monthOptions = useMemo(() => utcYearMonthOptions(12), []);

  useEffect(() => {
    const load = async () => {
      if (!username) {
        setRow(null);
        setIsError(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setIsError(false);
      try {
        const params: Record<string, string> = { chain: 'CELO', period: scope };
        if (scope === 'month') params.month = monthKey;
        const res = await apiClient.get(`/users/by-username/${encodeURIComponent(username)}`, params);
        setRow(res?.data ?? null);
      } catch {
        setRow(null);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [username, scope, monthKey]);

  const parsed = useMemo(() => {
    if (!row) return null;
    const playerAddress = String(row.address ?? '');
    const gamesPlayed = Number(row.games_played ?? 0);
    const gameMemberships = Number(row.game_memberships ?? 0);
    const gamesWon = Number(row.game_won ?? 0);
    const gamesLost = Number(row.game_lost ?? 0);
    const totalStaked = Number(row.total_staked ?? 0);
    const totalEarned = Number(row.total_earned ?? 0);
    const totalWithdrawn = Number(row.total_withdrawn ?? 0);
    const createdAt = row.created_at ? new Date(row.created_at) : null;
    return {
      username: String(row.username ?? username),
      shortAddress:
        playerAddress && playerAddress.length > 10
          ? `${playerAddress.slice(0, 6)}…${playerAddress.slice(-4)}`
          : playerAddress || '—',
      gamesPlayed,
      gameMemberships,
      gamesWon,
      gamesLost,
      winRate: gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : '0',
      totalStaked,
      totalEarned,
      totalWithdrawn,
      createdAt,
    };
  }, [row, username]);

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
            <p className="text-white/80 mb-2">Player profile not found.</p>
            <p className="text-white/50 text-sm mb-6">No database user matches this username on CELO.</p>
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
            <div className="px-6 pt-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      scope === 'all' ? 'bg-cyan-500/30 text-cyan-100' : 'text-white/60 hover:text-white/90'
                    }`}
                  >
                    Overall
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('month')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      scope === 'month' ? 'bg-cyan-500/30 text-cyan-100' : 'text-white/60 hover:text-white/90'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
                {scope === 'month' ? (
                  <select
                    value={monthKey}
                    onChange={(e) => setMonthKey(e.target.value)}
                    className="rounded-lg border border-white/15 bg-[#0a1214] text-white text-xs px-2.5 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  >
                    {monthOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] text-white/45 uppercase tracking-wide">All-time</span>
                )}
              </div>
            </div>
            <dl className="p-6 grid gap-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">
                  Finished games
                  <span className="block text-[10px] font-normal text-white/35 normal-case">
                    {scope === 'month' ? `FINISHED in ${formatMonthLabelUtc(monthKey)} (UTC)` : 'FINISHED on chain'}
                  </span>
                </dt>
                <dd className="font-semibold text-cyan-200 tabular-nums">{parsed.gamesPlayed}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <dt className="text-white/50">
                  Game memberships
                  <span className="block text-[10px] font-normal text-white/35 normal-case">
                    {scope === 'month' ? `Lobbies updated in ${formatMonthLabelUtc(monthKey)} (UTC)` : 'All lobbies joined'}
                  </span>
                </dt>
                <dd className="font-semibold text-cyan-200/90 tabular-nums">{parsed.gameMemberships}</dd>
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
            {parsed.createdAt ? (
              <p className="px-6 pb-6 text-xs text-white/40">
                Joined {parsed.createdAt.toLocaleDateString('en-US', { timeZone: 'UTC' })} UTC
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
