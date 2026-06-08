'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, Coins, Info, Loader2, Users, Zap } from 'lucide-react';
import type { BountyRow, TimeScope } from './leaderboard-types';
import { BOUNTY_WINNER_COUNT } from './leaderboard-types';

function tabPillClass(active: boolean, bounty = false): string {
  const base =
    'shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold font-orbitron tracking-wide border-2 transition-all duration-300 inline-flex items-center gap-2';
  if (active) {
    if (bounty) {
      return `${base} border-amber-400/80 bg-amber-500/15 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.45)]`;
    }
    return `${base} border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_20px_rgba(0,240,255,0.45)]`;
  }
  return `${base} border-cyan-500/25 bg-slate-900/70 text-white/55 hover:border-cyan-400/50 hover:text-white/90`;
}

type RankCardTier = 'winner' | 'rest' | 'normal';

function RankCard({
  row,
  rank,
  isMe,
  bountyMode,
  bountyCompleted,
  tier = 'normal',
}: {
  row: BountyRow;
  rank: number;
  isMe: boolean;
  bountyMode: boolean;
  bountyCompleted?: boolean;
  tier?: RankCardTier;
}) {
  const isChampion = tier === 'winner' && rank === 1;
  const showPrize = tier === 'winner' && bountyMode;
  const isRest = tier === 'rest';

  let borderClass = 'border-white/10 bg-[#081517]/90';
  let badge: React.ReactNode = null;

  if (tier === 'winner') {
    if (isChampion) {
      borderClass =
        'border-amber-400/70 bg-gradient-to-r from-amber-950/50 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_32px_rgba(251,191,36,0.25)]';
      badge = (
        <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-400/60 bg-amber-500/20 text-amber-200">
          CHAMPION
        </span>
      );
    } else if (rank === 2) {
      borderClass =
        'border-slate-300/50 bg-gradient-to-r from-slate-400/10 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_20px_rgba(203,213,225,0.15)]';
      badge = (
        <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-slate-300/50 bg-slate-400/15 text-slate-200">
          ELITE
        </span>
      );
    } else if (rank === 3) {
      borderClass =
        'border-orange-600/50 bg-gradient-to-r from-orange-950/40 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_18px_rgba(234,88,12,0.12)]';
      badge = (
        <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-orange-500/50 bg-orange-500/15 text-orange-200">
          VETERAN
        </span>
      );
    }
  } else if (!isRest) {
    if (isChampion) {
      borderClass =
        'border-amber-400/70 bg-gradient-to-r from-amber-950/50 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_32px_rgba(251,191,36,0.25)]';
      badge = (
        <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-400/60 bg-amber-500/20 text-amber-200">
          CHAMPION
        </span>
      );
    } else if (rank === 2) {
      borderClass =
        'border-slate-300/50 bg-gradient-to-r from-slate-400/10 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_20px_rgba(203,213,225,0.15)]';
      badge = (
        <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-slate-300/50 bg-slate-400/15 text-slate-200">
          ELITE
        </span>
      );
    } else if (rank === 3) {
      borderClass =
        'border-orange-600/50 bg-gradient-to-r from-orange-950/40 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_18px_rgba(234,88,12,0.12)]';
      badge = (
        <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-orange-500/50 bg-orange-500/15 text-orange-200">
          VETERAN
        </span>
      );
    }
  }

  if (isMe) {
    borderClass =
      'border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_24px_rgba(0,240,255,0.2)] ring-1 ring-cyan-400/30';
  }

  const rankClass = isRest
    ? 'text-base sm:text-lg text-white/70'
    : rank === 1
      ? 'text-xl sm:text-2xl text-amber-300'
      : rank === 2
        ? 'text-lg sm:text-xl text-slate-200'
        : rank === 3
          ? 'text-lg sm:text-xl text-orange-400'
          : 'text-base sm:text-lg text-cyan-300/90';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(rank * 0.04, 0.6) }}
      className={`relative rounded-xl border-2 backdrop-blur-sm ${borderClass}`}
    >
      <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-5 ${isRest ? 'py-2.5 sm:py-3' : 'py-3 sm:py-4'}`}>
        <div className="flex items-center gap-0.5 shrink-0 w-12 sm:w-16">
          {isChampion && <span className="text-lg sm:text-xl" aria-hidden>👑</span>}
          <span className={`font-black tabular-nums ${rankClass}`}>#{rank}</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center sm:items-start gap-1">
          <span
            className={`font-semibold text-white truncate ${isRest ? 'text-sm' : 'text-sm sm:text-base'}`}
          >
            {row.username || '—'}
          </span>
          {(badge || isMe) && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              {badge}
              {isMe && (
                <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-cyan-400/60 bg-cyan-500/25 text-cyan-100">
                  YOU
                </span>
              )}
            </div>
          )}
        </div>
        {showPrize ? (
          <div className="flex flex-col items-end shrink-0 text-right">
            <span className="text-[9px] uppercase tracking-widest text-white/40 font-orbitron">Prize</span>
            <span className="text-base sm:text-lg font-black font-orbitron tabular-nums text-amber-300">
              {bountyCompleted ? '5 USDT ✓' : '5 USDT'}
            </span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function renderRankCard(
  row: BountyRow,
  rank: number,
  isMe: boolean,
  bountyMode: boolean,
  bountyCompleted: boolean,
  tier: RankCardTier
) {
  return (
    <div key={`${row.id}-${rank}`} className="relative">
      {tier === 'winner' && rank === 1 && (
        <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-amber-400/10 blur-2xl opacity-70" aria-hidden />
      )}
      <RankCard
        row={row}
        rank={rank}
        isMe={isMe}
        bountyMode={bountyMode}
        bountyCompleted={bountyCompleted}
        tier={tier}
      />
    </div>
  );
}

function MayBountyActiveCompletedPanel({ monthLabel }: { monthLabel: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mb-8 rounded-2xl border-2 border-amber-500/35 bg-gradient-to-br from-amber-950/30 via-[#081517]/95 to-slate-900/50 p-5 sm:p-8 shadow-[0_0_48px_rgba(251,191,36,0.1)]"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <h2 className="text-lg sm:text-xl font-black font-orbitron uppercase tracking-wide text-white text-center">
          🎯 {monthLabel.toUpperCase()} BOUNTY
        </h2>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-400/60 bg-emerald-500/20 text-emerald-200 text-xs font-bold uppercase tracking-widest shadow-[0_0_12px_rgba(52,211,153,0.25)]">
          ACTIVE
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-400/50 bg-slate-500/20 text-slate-200 text-xs font-bold uppercase tracking-widest">
          COMPLETED
        </span>
      </div>

      <p className="text-center text-lg sm:text-2xl md:text-3xl font-black text-amber-300 mb-2 flex flex-wrap items-center justify-center gap-2 px-2">
        <Coins className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
        TOP 10 PLAYERS WON 5 USDT EACH
      </p>

      <p className="text-center text-sm text-white/55 max-w-xl mx-auto">
        Final standings ranked by games played. All remaining players are listed below.
      </p>
    </motion.div>
  );
}

export type LeaderboardViewProps = {
  chainParam: string;
  timeScope: TimeScope;
  setTimeScope: (scope: TimeScope) => void;
  monthKey: string;
  setMonthKey: (key: string) => void;
  monthOptions: { value: string; label: string }[];
  infoLabel: string;
  loading: boolean;
  error: string | null;
  rows: BountyRow[];
  myPosition: number;
  myLeaderboardUsernames: Set<string>;
  onRetry: () => void;
  bountyMonthLabel: string;
  bountyCompleted: boolean;
  isMayBountyView: boolean;
};

export function LeaderboardView({
  chainParam,
  timeScope,
  setTimeScope,
  monthKey,
  setMonthKey,
  monthOptions,
  infoLabel,
  loading,
  error,
  rows,
  myPosition,
  myLeaderboardUsernames,
  onRetry,
  bountyMonthLabel,
  bountyCompleted,
  isMayBountyView,
}: LeaderboardViewProps) {
  const showRankPill = myLeaderboardUsernames.size > 0 && !loading;
  const bountyMode = isMayBountyView;
  const { eligibleRows, ineligibleRows } = useMemo(() => {
    const eligible = rows.filter((r) => r.leaderboard_eligible !== false);
    const ineligible = rows.filter((r) => r.leaderboard_eligible === false);
    return { eligibleRows: eligible, ineligibleRows: ineligible };
  }, [rows]);

  const gridBgStyle = {
    backgroundImage: `
      linear-gradient(0deg, transparent 24%, rgba(0, 240, 255, 0.04) 25%, rgba(0, 240, 255, 0.04) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.04) 75%, rgba(0, 240, 255, 0.04) 76%, transparent 77%, transparent),
      linear-gradient(90deg, transparent 24%, rgba(0, 240, 255, 0.04) 25%, rgba(0, 240, 255, 0.04) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.04) 75%, rgba(0, 240, 255, 0.04) 76%, transparent 77%, transparent)
    `,
    backgroundSize: '48px 48px',
  } as const;

  return (
    <div className="relative min-h-screen bg-[#020a0b] text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={gridBgStyle} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#10343b_0%,#061416_45%,transparent_70%)]" />

      <header className="relative z-20 border-b border-cyan-400/15 bg-[#031012]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-cyan-300 hover:text-cyan-200 text-sm font-semibold font-orbitron">
            <ChevronLeft className="h-5 w-5" />
            Back
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl lg:max-w-4xl px-4 py-8 md:px-8 md:py-10">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-orbitron uppercase tracking-wider mb-2" style={{ textShadow: '0 0 24px rgba(0, 240, 255, 0.55), 0 0 48px rgba(0, 240, 255, 0.25)' }}>
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-cyan-400 bg-clip-text text-transparent">🏆 HALL OF DOMINANCE</span>
          </h1>
          <p className="text-cyan-300/65 font-dmSans text-xs sm:text-sm tracking-widest uppercase">Ranked by games played · {chainParam} Chain</p>
        </motion.div>

        {showRankPill && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center mb-6">
            {myPosition > 0 ? (
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-amber-400/60 bg-amber-500/15 text-amber-100 font-orbitron font-bold text-sm sm:text-base tracking-wide animate-pulse shadow-[0_0_28px_rgba(251,191,36,0.35)]">
                <Zap className="w-4 h-4 text-amber-300" />
                YOUR RANK: #{myPosition}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-100/90 text-sm text-center max-w-md">Not on the board yet — complete more games to rank.</span>
            )}
          </motion.div>
        )}

        <div className="mb-6 -mx-1 px-1 overflow-x-auto scrollbar-none">
          <div className="flex flex-nowrap items-center justify-start sm:justify-center gap-2 min-w-min pb-1">
            <button type="button" onClick={() => setTimeScope('bounty')} className={tabPillClass(timeScope === 'bounty', true)}>
              <span className={timeScope === 'bounty' ? 'animate-pulse' : ''}>💰</span> May Bounty
            </button>
            <button type="button" onClick={() => setTimeScope('month')} className={tabPillClass(timeScope === 'month')}>
              <CalendarDays className="h-4 w-4 opacity-90" /> Monthly
            </button>
            <button type="button" onClick={() => setTimeScope('all')} className={tabPillClass(timeScope === 'all')}>All-time</button>
          </div>
        </div>

        {timeScope === 'month' && (
          <div className="flex justify-center mb-6">
            <label className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#0a1214]/90 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-cyan-400/80" />
              <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer pr-6">
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#0a1214]">{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mb-6 flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-[#081517]/80 px-4 py-3 text-xs sm:text-sm text-white/60">
          <Info className="w-4 h-4 text-cyan-400/80 shrink-0" />
          <span className="font-medium tracking-wide">{infoLabel}</span>
        </div>

        {isMayBountyView && bountyCompleted && (
          <MayBountyActiveCompletedPanel monthLabel={bountyMonthLabel} />
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/30 py-20">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-300" />
            <p className="text-white/70 font-orbitron text-sm">Loading rankings…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-8 text-center">
            <p className="mb-4 text-red-200">{error}</p>
            <button type="button" onClick={onRetry} className="rounded-full border-2 border-cyan-400/50 bg-cyan-500/15 px-5 py-2 font-semibold text-cyan-100 hover:shadow-[0_0_16px_rgba(0,240,255,0.35)] transition">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/30 py-16 text-white/60">
            <Users className="h-10 w-10 text-cyan-300/70" />
            <p>No entries yet for this scope.</p>
          </div>
        ) : bountyMode ? (
          <>
            <div className="space-y-3 sm:space-y-4">
              {eligibleRows.slice(0, BOUNTY_WINNER_COUNT).map((row, idx) => {
                const rank = idx + 1;
                const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
                return renderRankCard(row, rank, isMe, bountyMode, bountyCompleted, 'winner');
              })}
            </div>
            {eligibleRows.length > BOUNTY_WINNER_COUNT && (
              <>
                <div className="my-6 border-t border-white/10" aria-hidden />
                <div className="space-y-2">
                  {eligibleRows.slice(BOUNTY_WINNER_COUNT).map((row, idx) => {
                    const rank = BOUNTY_WINNER_COUNT + idx + 1;
                    const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
                    return renderRankCard(row, rank, isMe, bountyMode, bountyCompleted, 'rest');
                  })}
                </div>
              </>
            )}
            {ineligibleRows.length > 0 && (
              <>
                <div className="my-6 border-t border-white/10" aria-hidden />
                <div className="space-y-2">
                  {ineligibleRows.map((row, idx) => {
                    const rank = eligibleRows.length + idx + 1;
                    const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
                    return renderRankCard(row, rank, isMe, bountyMode, bountyCompleted, 'rest');
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4">
              {eligibleRows.map((row, idx) => {
                const rank = idx + 1;
                const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
                return renderRankCard(row, rank, isMe, bountyMode, bountyCompleted, 'normal');
              })}
            </div>
            {ineligibleRows.length > 0 && (
              <>
                <div className="my-6 border-t border-white/10" aria-hidden />
                <div className="space-y-2">
                  {ineligibleRows.map((row, idx) => {
                    const rank = eligibleRows.length + idx + 1;
                    const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
                    return renderRankCard(row, rank, isMe, bountyMode, bountyCompleted, 'rest');
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
