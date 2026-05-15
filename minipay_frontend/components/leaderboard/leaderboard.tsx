'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { celo } from 'wagmi/chains';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { chainIdToLeaderboardChain } from '@/lib/profile-stats-address';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import TycoonABI from '@/context/abi/tycoonabi.json';
import { LeaderboardView } from './LeaderboardView';
import {
  BOUNTY_MONTH_KEY,
  LEADERBOARD_LIMIT,
  MAY_2026_END_UTC,
  type BountyRow,
  type TimeScope,
} from './leaderboard-types';

function defaultLeaderboardMonthKey(): string {
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

function normalizeLeaderboardArray(res: unknown): BountyRow[] {
  const payload = res && typeof res === 'object' && 'data' in (res as object) ? (res as { data?: unknown }).data : res;
  let list: unknown = payload;
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === 'object') {
    const obj = payload as { data?: unknown; leaderboard?: unknown };
    if (Array.isArray(obj.data)) list = obj.data;
    else if (Array.isArray(obj.leaderboard)) list = obj.leaderboard;
  }
  if (!Array.isArray(list)) return [];
  return list.map((row: Record<string, unknown>, index: number) => ({
    id: Number(row.id ?? index),
    username: String(row.username ?? '—'),
    games_played: Number(row.games_played ?? 0),
  }));
}

function useCountdownTo(targetMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, targetMs - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export default function Leaderboard() {
  const [mounted, setMounted] = useState(false);
  const { address: walletAddress } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUsername = guestAuth?.guestUser?.username?.trim() || '';
  const chainId = useChainId();
  const effectiveChainId = chainId ?? celo.id;
  const chainParam = chainIdToLeaderboardChain(effectiveChainId);
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[effectiveChainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BountyRow[]>([]);
  const [timeScope, setTimeScope] = useState<TimeScope>('all');
  const [monthKey, setMonthKey] = useState<string>(() => defaultLeaderboardMonthKey());
  const countdown = useCountdownTo(MAY_2026_END_UTC);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: username } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    query: { enabled: mounted && !!walletAddress && !!tycoonAddress },
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
    if (!mounted) return;

    setRows([]);
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        chain: chainParam,
        type: 'played',
        limit: LEADERBOARD_LIMIT,
      };

      if (timeScope === 'bounty') {
        params.period = 'month';
        params.month = BOUNTY_MONTH_KEY;
      } else if (timeScope === 'month') {
        params.period = 'month';
        params.month = monthKey;
      } else {
        params.period = 'all';
      }

      const res = await apiClient.get('/users/leaderboard', params);
      const normalized = normalizeLeaderboardArray(res);
      const filtered =
        timeScope === 'month' || timeScope === 'bounty'
          ? normalized.filter((row) => !row.username.includes('AI_'))
          : normalized;
      setRows(filtered);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [chainParam, monthKey, mounted, timeScope]);

  useEffect(() => {
    if (!mounted) return;
    fetchLeaderboard();
  }, [fetchLeaderboard, mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020a0b]">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-300" />
      </div>
    );
  }

  const myPosition =
    myLeaderboardUsernames.size > 0
      ? rows.findIndex((row) => row.username && myLeaderboardUsernames.has(row.username)) + 1
      : 0;

  const infoLabel =
    timeScope === 'bounty'
      ? `${chainParam} · May 2026 · Finished games only`
      : timeScope === 'month'
        ? `${chainParam} · ${formatMonthLabelUtc(monthKey)} · Finished games only`
        : `${chainParam} · All-time · Finished games only`;

  return (
    <LeaderboardView
      chainParam={chainParam}
      timeScope={timeScope}
      setTimeScope={setTimeScope}
      monthKey={monthKey}
      setMonthKey={setMonthKey}
      monthOptions={monthOptions}
      infoLabel={infoLabel}
      loading={loading}
      error={error}
      rows={rows}
      myPosition={myPosition}
      myLeaderboardUsernames={myLeaderboardUsernames}
      onRetry={fetchLeaderboard}
      countdown={countdown}
    />
  );
}
