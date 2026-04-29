'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { CalendarDays, ChevronLeft, Loader2, Sparkles, Trophy, Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import TycoonABI from '@/context/abi/tycoonabi.json';

interface BountyRow {
  id: number;
  username: string;
  games_played: number;
}

const LIMIT = 20;
type TimeScope = 'all' | 'month' | 'bounty';

function chainIdToLeaderboardChain(chainId: number): string {
  switch (chainId) {
    case 137:
    case 80001:
      return 'POLYGON';
    case 42220:
    case 44787:
      return 'CELO';
    case 8453:
    case 84531:
      return 'BASE';
    default:
      return 'CELO';
  }
}

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

function profileHrefForUsername(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

function normalizeLeaderboardArray(res: any): BountyRow[] {
  const raw = res?.data;
  const list = Array.isArray(raw) ? raw : raw?.data;
  if (!Array.isArray(list)) return [];
  return list.map((row: any) => ({
    id: Number(row.id ?? 0),
    username: String(row.username ?? '—'),
    games_played: Number(row.games_played ?? 0),
  }));
}

export default function Leaderboard() {
  const { address: walletAddress } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUsername = guestAuth?.guestUser?.username?.trim() || '';
  const chainId = useChainId();
  const chainParam = chainIdToLeaderboardChain(chainId);
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BountyRow[]>([]);
  const [timeScope, setTimeScope] = useState<TimeScope>('bounty');
  const [monthKey, setMonthKey] = useState<string>(() => utcYearMonthNow());

  const bountyRange = useMemo(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endExclusive = new Date(Date.UTC(year, 5, 1, 0, 0, 0, 0));
    return { startIso: start.toISOString(), endIso: endExclusive.toISOString(), endLabel: `${year}-05-31` };
  }, []);

  const { data: username } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!tycoonAddress },
  });

  const myLeaderboardUsernames = useMemo(() => {
    const names = new Set<string>();
    const walletUsername = typeof username === 'string' ? username.trim() : '';
    if (walletUsername) names.add(walletUsername);
    if (guestUsername) names.add(guestUsername);
    return names;
  }, [username, guestUsername]);

  const monthOptions = useMemo(() => utcYearMonthOptions(12), []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        chain: chainParam,
        type: 'played',
        limit: LIMIT,
      };

      if (timeScope === 'month') {
        params.period = 'month';
        params.month = monthKey;
      } else if (timeScope === 'bounty') {
        params.period = 'range';
        params.start = bountyRange.startIso;
        params.end = bountyRange.endIso;
      }

      const res = await apiClient.get('/users/leaderboard', params);
      const normalized = normalizeLeaderboardArray(res);
      const filtered = timeScope === 'month' ? normalized.filter((row) => !row.username.includes('AI_')) : normalized;
      setRows(filtered);
    } catch (err: any) {
      setError(err?.message || 'Failed to load leaderboard');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [bountyRange.endIso, bountyRange.startIso, chainParam, monthKey, timeScope]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const myPosition =
    myLeaderboardUsernames.size > 0
      ? rows.findIndex((row) => row.username && myLeaderboardUsernames.has(row.username)) + 1
      : 0;

  const podium = rows.slice(0, 3);
  const others = rows.slice(3);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#10343b_0%,#061416_45%,#020a0b_100%)] text-white">
      <header className="sticky top-0 z-50 border-b border-cyan-400/15 bg-[#031012]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-cyan-300 hover:text-cyan-200 text-sm font-semibold">
            <ChevronLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="flex items-center gap-2 text-lg md:text-2xl font-bold text-cyan-200">
            <Trophy className="h-6 w-6 text-amber-300" />
            {timeScope === 'bounty' ? 'May Bounty Leaderboard' : 'Leaderboard'}
          </h1>
          <div className="w-14" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/15 via-cyan-400/10 to-transparent p-4 md:p-5">
          <p className="text-cyan-100 font-semibold">Ranked by games played</p>
          <p className="mt-1 text-sm text-cyan-100/75">
            {timeScope === 'bounty'
              ? `Window: ${chainParam} · ${bountyRange.startIso.slice(0, 10)} to ${bountyRange.endLabel} (UTC)`
              : timeScope === 'month'
                ? `Window: ${chainParam} · ${formatMonthLabelUtc(monthKey)} (UTC)`
                : `Window: ${chainParam} · all-time`}
          </p>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setTimeScope('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                timeScope === 'all' ? 'bg-cyan-500/30 text-cyan-100 shadow-sm' : 'text-white/60 hover:text-white/90'
              }`}
            >
              All-time
            </button>
            <button
              type="button"
              onClick={() => setTimeScope('month')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-1.5 ${
                timeScope === 'month' ? 'bg-cyan-500/30 text-cyan-100 shadow-sm' : 'text-white/60 hover:text-white/90'
              }`}
            >
              <CalendarDays className="h-4 w-4 opacity-80" />
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setTimeScope('bounty')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                timeScope === 'bounty' ? 'bg-cyan-500/30 text-cyan-100 shadow-sm' : 'text-white/60 hover:text-white/90'
              }`}
            >
              May bounty
            </button>
          </div>
          {timeScope === 'month' ? (
            <label className="flex items-center gap-2 text-xs text-white/70">
              <span className="text-white/50 uppercase tracking-wide">Month</span>
              <select
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="rounded-lg border border-white/15 bg-[#0a1214] text-white text-sm px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {myLeaderboardUsernames.size > 0 && !loading && (
          <div className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-center">
            {myPosition > 0 ? (
              <p className="font-semibold text-amber-100">
                Your position: <span className="tabular-nums text-white">#{myPosition}</span>
              </p>
            ) : (
              <p className="text-sm text-amber-100/90">You are not on the board yet. Complete more games to appear.</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/20 py-20">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-300" />
            <p className="text-white/70">Loading leaderboard...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-8 text-center">
            <p className="mb-4 text-red-200">{error}</p>
            <button
              type="button"
              onClick={fetchLeaderboard}
              className="rounded-xl bg-cyan-400/20 px-4 py-2 font-semibold text-cyan-100 hover:bg-cyan-400/30"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/20 py-16 text-white/60">
            <Users className="h-10 w-10 text-cyan-300/70" />
            <p>{timeScope === 'bounty' ? 'No games played in the May bounty window yet.' : 'No entries yet for this scope.'}</p>
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-3 md:grid-cols-3">
              {podium.map((row, index) => (
                <Link
                  key={`${row.id}-${row.username}-${index}`}
                  href={profileHrefForUsername(row.username)}
                  className="group rounded-2xl border border-cyan-300/20 bg-gradient-to-b from-cyan-400/15 to-black/30 p-4 transition hover:border-cyan-200/40 hover:shadow-[0_0_28px_rgba(34,211,238,0.22)]"
                >
                  <p className="mb-1 text-xs uppercase tracking-widest text-cyan-100/70">Top {index + 1}</p>
                  <p className="truncate text-lg font-bold text-white group-hover:text-cyan-100">{row.username}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-200">
                    <Sparkles className="h-4 w-4" /> #{index + 1}
                  </p>
                </Link>
              ))}
            </section>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#081517]/80 backdrop-blur-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">Tycoon</th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((row, idx) => {
                    const rank = idx + 4;
                    return (
                      <tr key={`${row.id}-${rank}`} className="border-b border-white/5 transition hover:bg-cyan-500/5">
                        <td className="px-4 py-3 font-semibold text-cyan-200">#{rank}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={profileHrefForUsername(row.username)}
                            className="font-medium text-white transition hover:text-cyan-200 hover:underline underline-offset-2"
                          >
                            {row.username || '—'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
