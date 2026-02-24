'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useChainId } from 'wagmi';
import { Trophy, TrendingUp, Wallet, Target, Loader2, Users, ChevronLeft } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

/** Map chainId to backend chain name for leaderboard filter */
function chainIdToLeaderboardChain(chainId: number): string {
  switch (chainId) {
    case 8453:
    case 84531:
      return 'BASE';
    case 42220:
    case 44787:
      return 'CELO';
    case 137:
    case 80001:
      return 'POLYGON';
    default:
      return 'BASE';
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

export default function Leaderboard() {
  const chainId = useChainId();
  const chainParam = chainIdToLeaderboardChain(chainId);
  const [activeTab, setActiveTab] = useState<LeaderboardKind>('wins');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wins, setWins] = useState<WinsRow[]>([]);
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [stakes, setStakes] = useState<StakesRow[]>([]);
  const [winrate, setWinrate] = useState<WinRateRow[]>([]);

  const fetchLeaderboard = useCallback(async (kind: LeaderboardKind) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<unknown[]>('/users/leaderboard', {
        chain: chainParam,
        type: kind,
        limit: LIMIT,
      });
      const data = res.data;
      if (!Array.isArray(data)) throw new Error('Invalid leaderboard response');
      switch (kind) {
        case 'wins':
          setWins(data as WinsRow[]);
          break;
        case 'earnings':
          setEarnings(data as EarningsRow[]);
          break;
        case 'stakes':
          setStakes(data as StakesRow[]);
          break;
        case 'winrate':
          setWinrate(data as WinRateRow[]);
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
        <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-200 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          Leaderboard
        </h1>
        <div className="w-16 md:w-20" />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <p className="text-center text-white/60 text-sm mb-2">Top players on this chain</p>
        <p className="text-center text-cyan-400/90 text-xs font-medium mb-6">Chain: {chainParam}</p>

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
                      {(currentList as WinsRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-amber-400/90">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
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
                      {(currentList as EarningsRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-amber-400/90">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
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
                      {(currentList as StakesRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-amber-400/90">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
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
                      {(currentList as WinRateRow[]).map((row, i) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-amber-400/90">{i + 1 === 1 ? '🏆' : `#${i + 1}`}</td>
                          <td className="py-3 px-4 font-medium text-white">{row.username || '—'}</td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-300">
                            {row.games_played > 0
                              ? `${((Number(row.game_won) / Number(row.games_played)) * 100).toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-white/60 hidden sm:table-cell">
                            {row.game_won ?? 0} / {row.games_played ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {!loading && !error && currentList.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-2 text-white/50">
              <Users className="w-12 h-12" />
              <p>No entries yet. Play games to climb the board!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
