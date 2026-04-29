'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { Trophy, TrendingUp, Wallet, Target, Loader2, Users, ChevronLeft, Gift, CalendarDays } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import TycoonABI from '@/context/abi/tycoonabi.json';

/** Map chainId to backend chain name for leaderboard filter. Frontend is Celo-only. */
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

type LeaderboardKind = 'wins' | 'earnings' | 'stakes' | 'winrate' | 'referrals';

interface WinsRow {
  id: number;
  username: string;
  games_played: number;
  game_won: number;
  game_lost: number;
}

interface EarningsRow {
  id: number;
  username: string;
  total_earned: number;
  total_staked: number;
  total_withdrawn: number;
}

interface StakesRow {
  id: number;
  username: string;
  total_staked: number;
  total_earned: number;
  total_withdrawn: number;
}

interface WinRateRow {
  id: number;
  username: string;
  games_played: number;
  game_won: number;
  game_lost: number;
  win_rate: number;
}

interface ReferralRow {
  id: number;
  username: string;
  referral_count: number;
}

const TABS: { id: LeaderboardKind; label: string; icon: React.ElementType }[] = [
  { id: 'wins', label: 'Wins', icon: Trophy },
  { id: 'earnings', label: 'Earnings', icon: TrendingUp },
  { id: 'stakes', label: 'Stakes', icon: Wallet },
  { id: 'winrate', label: 'Win rate', icon: Target },
  { id: 'referrals', label: 'Referrals', icon: Gift },
];

const LIMIT = 20;

type TimeScope = 'all' | 'month' | 'bounty';

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

function formatBigNumber(n: number): string {
  if (n >= 1e18) return (n / 1e18).toFixed(2);
  if (n >= 1e15) return (n / 1e18).toFixed(4);
  return n.toLocaleString();
}

/** Parse backend row or contract User tuple into a consistent shape (same source idea as profile). */
function normalizeLeaderboardArray(res: any): unknown[] {
  const raw = res?.data;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

function normalizeReferralLeaderboard(res: any): ReferralRow[] {
  const raw = res?.data;
  const list = Array.isArray(raw) ? raw : raw?.data;
  if (!Array.isArray(list)) return [];
  return list.map((row: any) => ({
    id: Number(row.id),
    username: String(row.username ?? '—'),
    referral_count: Number(row.referral_count ?? row.referralCount ?? 0),
  }));
}

function profileHrefForUsername(name: string): string {
  return `/u/${encodeURIComponent(name)}`;
}

export default function Leaderboard() {
  const { address: walletAddress, isConnected } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUsername = guestAuth?.guestUser?.username?.trim() || '';
  const chainId = useChainId();
  const chainParam = chainIdToLeaderboardChain(chainId);
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];

  const [activeTab, setActiveTab] = useState<LeaderboardKind>('wins');
  const [timeScope, setTimeScope] = useState<TimeScope>('bounty');
  const [monthKey, setMonthKey] = useState<string>(() => utcYearMonthNow());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wins, setWins] = useState<WinsRow[]>([]);
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [stakes, setStakes] = useState<StakesRow[]>([]);
  const [winrate, setWinrate] = useState<WinRateRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);

  const bountyRange = useMemo(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endExclusive = new Date(Date.UTC(year, 5, 1, 0, 0, 0, 0)); // June 1 UTC (end-of-May exclusive)
    return { startIso: start.toISOString(), endIso: endExclusive.toISOString(), endLabel: `${year}-05-31` };
  }, []);

  // Same as profile: get username from contract then getUser(username) for on-chain stats
  const { data: username } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!tycoonAddress },
  });
  const { data: contractUser } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username as string] : undefined,
    query: { enabled: !!username && !!tycoonAddress },
  });

  const currentUserFromContract = useMemo((): WinsRow & EarningsRow & StakesRow & WinRateRow | null => {
    if (!contractUser || !username) return null;
    const t = contractUser as [bigint, string, string, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    const gamesPlayed = Number(t[4] ?? 0);
    const gamesWon = Number(t[5] ?? 0);
    const gamesLost = Number(t[6] ?? 0);
    const totalStaked = Number(t[7] ?? 0);
    const totalEarned = Number(t[8] ?? 0);
    const totalWithdrawn = Number(t[9] ?? 0);
    return {
      id: -1,
      username: String(username),
      games_played: gamesPlayed,
      game_won: gamesWon,
      game_lost: gamesLost,
      total_earned: totalEarned,
      total_staked: totalStaked,
      total_withdrawn: totalWithdrawn,
      win_rate: gamesPlayed > 0 ? gamesWon / gamesPlayed : 0,
    };
  }, [contractUser, username]);

  const fetchLeaderboard = useCallback(
    async (kind: LeaderboardKind) => {
      setLoading(true);
      setError(null);
      try {
        if (kind === 'referrals') {
          const refParams: Record<string, string | number> = { limit: LIMIT };
          if (timeScope === 'month') refParams.month = monthKey;
          const res = await apiClient.get('/referral/leaderboard', refParams);
          setReferrals(normalizeReferralLeaderboard(res));
          return;
        }
        const lbParams: Record<string, string | number> = {
          chain: chainParam,
          type: kind,
          limit: LIMIT,
        };
        if (timeScope === 'month') {
          lbParams.period = 'month';
          lbParams.month = monthKey;
        } else if (timeScope === 'bounty') {
          lbParams.period = 'range';
          lbParams.type = 'played';
          lbParams.start = bountyRange.startIso;
          lbParams.end = bountyRange.endIso;
        }
        const res = await apiClient.get('/users/leaderboard', lbParams);
        const data = normalizeLeaderboardArray(res) as unknown[];
        const list = Array.isArray(data) ? data : [];
        switch (kind) {
          case 'wins':
            setWins(list as WinsRow[]);
            break;
          case 'earnings':
            setEarnings(list as EarningsRow[]);
            break;
          case 'stakes':
            setStakes(list as StakesRow[]);
            break;
          case 'winrate':
            setWinrate(list as WinRateRow[]);
            break;
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load leaderboard');
        setWins([]);
        setEarnings([]);
        setStakes([]);
        setWinrate([]);
        setReferrals([]);
      } finally {
        setLoading(false);
      }
    },
    [chainParam, timeScope, monthKey, bountyRange]
  );

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab, fetchLeaderboard]);

  const currentList =
    activeTab === 'wins'
      ? wins
      : activeTab === 'earnings'
        ? earnings
        : activeTab === 'stakes'
          ? stakes
          : activeTab === 'winrate'
            ? winrate
            : referrals;
  const isAIUser = (u: { username?: string } | null) => u?.username?.includes?.('AI_') ?? false;
  const filteredList =
    activeTab === 'referrals'
      ? currentList
      : Array.isArray(currentList)
        ? currentList.filter((row: { username?: string }) => !isAIUser(row))
        : currentList;
  const showContractFallback =
    timeScope === 'all' &&
    activeTab !== 'referrals' &&
    !loading &&
    !error &&
    currentList.length === 0 &&
    isConnected &&
    currentUserFromContract &&
    !isAIUser(currentUserFromContract);
  const displayList =
    showContractFallback && currentUserFromContract ? [currentUserFromContract] : filteredList;

  const myLeaderboardUsernames = useMemo(() => {
    const u = typeof username === 'string' ? username.trim() : '';
    const names = new Set<string>();
    if (u) names.add(u);
    if (guestUsername) names.add(guestUsername);
    return names;
  }, [username, guestUsername]);

  const myBountyRank =
    timeScope === 'bounty' && activeTab === 'wins' && myLeaderboardUsernames.size > 0
      ? (displayList as WinsRow[]).findIndex((r) => r.username && myLeaderboardUsernames.has(String(r.username))) + 1
      : 0;

  const monthOptions = useMemo(() => utcYearMonthOptions(12), []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-4 md:px-8 border-b border-white/10 bg-[#010F10]/90 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-cyan-400 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-cyan-400" />
          {timeScope === 'bounty' ? 'May bounty' : 'Leaderboard'}
        </h1>
        <div className="w-16 md:w-20" />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <p className="text-center text-white/60 text-sm mb-2">
          {activeTab === 'referrals'
            ? timeScope === 'month'
              ? 'Most new referred sign-ups attributed this month'
              : 'Players who brought the most friends via referral link'
            : timeScope === 'bounty' && activeTab === 'wins'
              ? 'Monthly bounty: most games played in the active campaign window'
            : timeScope === 'month' && (activeTab === 'wins' || activeTab === 'winrate')
              ? 'Top players by finished games this calendar month (UTC)'
              : 'Top players on this chain'}
        </p>
        <p className="text-center text-cyan-400/90 text-xs font-medium mb-3">
          {activeTab === 'referrals'
            ? timeScope === 'month'
              ? `${formatMonthLabelUtc(monthKey)} · UTC`
              : 'App-wide · all-time · not tied to a single chain'
            : timeScope === 'bounty' && activeTab === 'wins'
              ? `${chainParam} · ${bountyRange.startIso.slice(0, 10)} → ${bountyRange.endLabel} · UTC`
            : timeScope === 'month' && (activeTab === 'wins' || activeTab === 'winrate')
              ? `${chainParam} · ${formatMonthLabelUtc(monthKey)} · UTC`
              : `Chain: ${chainParam}`}
        </p>
        {timeScope === 'bounty' && (
          <p className="text-center text-white/45 text-xs mb-4 max-w-lg mx-auto">
            Ranking is by games played from today (UTC) until the end of May (UTC).
          </p>
        )}
        {timeScope === 'month' && (activeTab === 'wins' || activeTab === 'winrate' || activeTab === 'referrals') ? (
          <p className="text-center text-white/45 text-xs mb-4 max-w-lg mx-auto">
            Wins and win rate count finished games whose last update fell in the month (on-chain sync timing may differ
            slightly). Referrals use each invitee&apos;s <span className="text-white/55">referred_at</span> timestamp.
          </p>
        ) : timeScope === 'month' ? (
          <p className="text-center text-amber-200/80 text-xs mb-4 max-w-md mx-auto">
            Earnings and stakes are lifetime on-chain totals — switch to All-time or open Wins / Win rate / Referrals
            for monthly boards.
          </p>
        ) : null}
        {showContractFallback && (
          <p className="text-center text-cyan-400/80 text-xs mb-4">Showing your stats from chain (same as profile)</p>
        )}

        {timeScope === 'bounty' && activeTab === 'wins' && myLeaderboardUsernames.size > 0 && !loading && (
          <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center">
            {myBountyRank > 0 ? (
              <p className="text-cyan-100 font-semibold">
                Your position: <span className="text-white tabular-nums">#{myBountyRank}</span>
              </p>
            ) : (
              <p className="text-cyan-100/90 text-sm">
                You are not on the May bounty board yet — play games in the campaign window to appear.
              </p>
            )}
          </div>
        )}

        {/* All-time vs monthly (UTC) */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 mb-5">
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
              onClick={() => {
                setTimeScope('month');
                setActiveTab((t) => (t === 'earnings' || t === 'stakes' ? 'wins' : t));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-1.5 ${
                timeScope === 'month' ? 'bg-cyan-500/30 text-cyan-100 shadow-sm' : 'text-white/60 hover:text-white/90'
              }`}
            >
              <CalendarDays className="w-4 h-4 opacity-80" aria-hidden />
              Monthly
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeScope('bounty');
                setActiveTab('wins');
              }}
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

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {TABS.map(({ id, label, icon: Icon }) => {
            const disabled =
              (timeScope === 'month' && (id === 'earnings' || id === 'stakes')) ||
              (timeScope === 'bounty' && id !== 'wins');
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  setActiveTab(id);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  disabled ? 'opacity-40 cursor-not-allowed border border-white/5 text-white/35' : ''
                } ${
                  activeTab === id && !disabled
                    ? 'bg-cyan-500/25 border-2 border-cyan-500/60 text-cyan-200'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:border-white/20 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-white/10 bg-[#0E1415]/80 backdrop-blur-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              <p className="text-white/60">Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="py-16 px-4 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                type="button"
                onClick={() => fetchLeaderboard(activeTab)}
                className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 font-semibold hover:bg-cyan-500/30"
              >
                Retry
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'wins' && (
                <motion.div
                  key={`wins-${timeScope}-${monthKey}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-x-auto"
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">#</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Tycoon</th>
                        {!(timeScope === 'bounty') ? (
                          <>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Games</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Wins</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider hidden sm:table-cell">Losses</th>
                          </>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(displayList as WinsRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-cyan-400">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
                          <td className="py-3 px-4 font-medium text-white">
                            {row.username ? (
                              <Link
                                href={profileHrefForUsername(row.username)}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline underline-offset-2"
                              >
                                {row.username}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          {!(timeScope === 'bounty') ? (
                            <>
                              <td className="py-3 px-4 text-right text-white/80">{row.games_played ?? 0}</td>
                              <td className="py-3 px-4 text-right font-semibold text-cyan-300">{row.game_won ?? 0}</td>
                              <td className="py-3 px-4 text-right text-white/60 hidden sm:table-cell">{row.game_lost ?? 0}</td>
                            </>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
              {activeTab === 'earnings' && (
                <motion.div
                  key="earnings"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-x-auto"
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">#</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Tycoon</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Earned</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider hidden sm:table-cell">Staked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayList as EarningsRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-cyan-400">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
                          <td className="py-3 px-4 font-medium text-white">
                            {row.username ? (
                              <Link
                                href={profileHrefForUsername(row.username)}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline underline-offset-2"
                              >
                                {row.username}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-300">{formatBigNumber(Number(row.total_earned ?? 0))}</td>
                          <td className="py-3 px-4 text-right text-white/60 hidden sm:table-cell">{formatBigNumber(Number(row.total_staked ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
              {activeTab === 'stakes' && (
                <motion.div
                  key="stakes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-x-auto"
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">#</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Tycoon</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Staked</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider hidden sm:table-cell">Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayList as StakesRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-cyan-400">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
                          <td className="py-3 px-4 font-medium text-white">
                            {row.username ? (
                              <Link
                                href={profileHrefForUsername(row.username)}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline underline-offset-2"
                              >
                                {row.username}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-cyan-300">{formatBigNumber(Number(row.total_staked ?? 0))}</td>
                          <td className="py-3 px-4 text-right text-white/60 hidden sm:table-cell">{formatBigNumber(Number(row.total_earned ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
              {activeTab === 'winrate' && (
                <motion.div
                  key={`winrate-${timeScope}-${monthKey}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-x-auto"
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">#</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Tycoon</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Win rate</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider hidden sm:table-cell">Wins / Games</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayList as WinRateRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-cyan-400">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
                          <td className="py-3 px-4 font-medium text-white">
                            {row.username ? (
                              <Link
                                href={profileHrefForUsername(row.username)}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline underline-offset-2"
                              >
                                {row.username}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-300">
                            {(row as WinRateRow).games_played > 0
                              ? `${((Number((row as WinRateRow).game_won) / Number((row as WinRateRow).games_played)) * 100).toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-white/60 hidden sm:table-cell">
                            {(row as WinRateRow).game_won ?? 0} / {(row as WinRateRow).games_played ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
              {activeTab === 'referrals' && (
                <motion.div
                  key={`referrals-${timeScope}-${monthKey}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-x-auto"
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">#</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Player</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Direct referrals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayList as ReferralRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-cyan-400">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
                          <td className="py-3 px-4 font-medium text-white">
                            {row.username ? (
                              <Link
                                href={profileHrefForUsername(row.username)}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline underline-offset-2"
                              >
                                {row.username}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-300 tabular-nums">
                            {row.referral_count ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {!loading && !error && displayList.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-2 text-white/50">
              <Users className="w-12 h-12 text-cyan-400/50" />
              <p>
                {activeTab === 'referrals'
                  ? timeScope === 'month'
                    ? 'No referred sign-ups in this month yet.'
                    : 'No referral sign-ups yet. Share your link from Profile when you are signed in.'
                  : timeScope === 'month' && (activeTab === 'wins' || activeTab === 'winrate')
                    ? 'No finished games in this month yet.'
                    : timeScope === 'bounty' && activeTab === 'wins'
                      ? 'No games played in the May bounty window yet.'
                      : 'No entries yet. Connect and play games to climb the board!'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
