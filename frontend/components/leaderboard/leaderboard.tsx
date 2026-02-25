'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Trophy, TrendingUp, Wallet, Target, Loader2, Users, ChevronLeft } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import TycoonABI from '@/context/abi/tycoonabi.json';

/** Map chainId to backend chain name for leaderboard filter. Frontend is Celo-only. */
function chainIdToLeaderboardChain(chainId: number): string {
  switch (chainId) {
    case 42220:
    case 44787:
      return 'CELO';
    case 8453:
    case 84531:
      return 'CELO';
    case 137:
    case 80001:
      return 'POLYGON';
    default:
      return 'CELO';
  }
}

type LeaderboardKind = 'wins' | 'earnings' | 'stakes' | 'winrate';

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

const TABS: { id: LeaderboardKind; label: string; icon: React.ElementType }[] = [
  { id: 'wins', label: 'Wins', icon: Trophy },
  { id: 'earnings', label: 'Earnings', icon: TrendingUp },
  { id: 'stakes', label: 'Stakes', icon: Wallet },
  { id: 'winrate', label: 'Win rate', icon: Target },
];

const LIMIT = 20;

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

export default function Leaderboard() {
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const chainParam = chainIdToLeaderboardChain(chainId);
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];

  const [activeTab, setActiveTab] = useState<LeaderboardKind>('wins');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wins, setWins] = useState<WinsRow[]>([]);
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [stakes, setStakes] = useState<StakesRow[]>([]);
  const [winrate, setWinrate] = useState<WinRateRow[]>([]);

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

  const fetchLeaderboard = useCallback(async (kind: LeaderboardKind) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/users/leaderboard', {
        chain: chainParam,
        type: kind,
        limit: LIMIT,
      });
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
    } finally {
      setLoading(false);
    }
  }, [chainParam]);

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab, fetchLeaderboard]);

  const currentList = activeTab === 'wins' ? wins : activeTab === 'earnings' ? earnings : activeTab === 'stakes' ? stakes : winrate;
  const showContractFallback = !loading && !error && currentList.length === 0 && isConnected && currentUserFromContract;
  const displayList = showContractFallback && currentUserFromContract
    ? [currentUserFromContract]
    : currentList;

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
          Leaderboard
        </h1>
        <div className="w-16 md:w-20" />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <p className="text-center text-white/60 text-sm mb-2">Top players on this chain</p>
        <p className="text-center text-cyan-400/90 text-xs font-medium mb-6">Chain: {chainParam}</p>
        {showContractFallback && (
          <p className="text-center text-cyan-400/80 text-xs mb-4">Showing your stats from chain (same as profile)</p>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                activeTab === id
                  ? 'bg-cyan-500/25 border-2 border-cyan-500/60 text-cyan-200'
                  : 'bg-white/5 border border-white/10 text-white/70 hover:border-white/20 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
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
                  key="wins"
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
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Games</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Wins</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider hidden sm:table-cell">Losses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayList as WinsRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-cyan-400">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
                          <td className="py-3 px-4 font-medium text-white">{row.username || '—'}</td>
                          <td className="py-3 px-4 text-right text-white/80">{row.games_played ?? 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-cyan-300">{row.game_won ?? 0}</td>
                          <td className="py-3 px-4 text-right text-white/60 hidden sm:table-cell">{row.game_lost ?? 0}</td>
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
                          <td className="py-3 px-4 font-medium text-white">{row.username || '—'}</td>
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
                          <td className="py-3 px-4 font-medium text-white">{row.username || '—'}</td>
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
                  key="winrate"
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
                          <td className="py-3 px-4 font-medium text-white">{row.username || '—'}</td>
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
            </AnimatePresence>
          )}

          {!loading && !error && displayList.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-2 text-white/50">
              <Users className="w-12 h-12 text-cyan-400/50" />
              <p>No entries yet. Connect and play games to climb the board!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
