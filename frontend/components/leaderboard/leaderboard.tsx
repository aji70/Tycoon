'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { apiClient } from '@/lib/api';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import TycoonABI from '@/context/abi/tycoonabi.json';
import { LeaderboardView } from './LeaderboardView';
import {
  BOUNTY_MONTH_KEY,
  BOUNTY_MONTH_LABEL,
  LEADERBOARD_LIMIT,
  bountyMonthToApiParams,
  getBountyMonthConfig,
  isBountyMonthKey,
  parseLeaderboardApiResponse,
  transformBountyLeaderboardRows,
  type BountyRow,
  type TimeScope,
} from './leaderboard-types';

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

function formatMonthLabelUtc(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(Date.UTC(y, m - 1, 15, 12, 0, 0, 0)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function monthOptionSuffix(value: string): string {
  const config = getBountyMonthConfig(value);
  if (!config) return '';
  if (config.completed) return ' (Completed)';
  if (config.key === BOUNTY_MONTH_KEY) return ' (Daily)';
  return ' (Bounty)';
}

function utcYearMonthOptions(count: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < count; i += 1) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    const value = `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    const base = formatMonthLabelUtc(value);
    out.push({ value, label: `${base}${monthOptionSuffix(value)}` });
  }
  return out;
}

function buildInfoLabel(chainParam: string, timeScope: TimeScope, monthKey: string): string {
  if (timeScope === 'all') {
    return `${chainParam} · All-time · Daily snapshot · Fair play (UTC)`;
  }

  const config =
    timeScope === 'bounty' ? getBountyMonthConfig(BOUNTY_MONTH_KEY) : getBountyMonthConfig(monthKey);

  if (timeScope === 'month' && !config) {
    return `${chainParam} · ${formatMonthLabelUtc(monthKey)}`;
  }

  if (!config) return `${chainParam} · ${BOUNTY_MONTH_LABEL}`;

  const rangeNote = config.key === '2026-06' ? ' · Jun 1–28' : '';

  if (config.completed) {
    return `${chainParam} · ${config.label}${rangeNote} · Final standings · Prizes awarded`;
  }
  if (timeScope === 'bounty' || config.key === BOUNTY_MONTH_KEY) {
    return `${chainParam} · ${config.label} · Daily snapshot · Fair play (UTC)`;
  }
  return `${chainParam} · ${config.label}${rangeNote} · Bounty · Top ${config.prizeCount}`;
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [timeScope, setTimeScope] = useState<TimeScope>('bounty');
  const [monthKey, setMonthKey] = useState<string>(BOUNTY_MONTH_KEY);

  const activeBountyKey = timeScope === 'bounty' ? BOUNTY_MONTH_KEY : monthKey;
  const activeBountyConfig = getBountyMonthConfig(activeBountyKey);

  const isFeaturedBountyView =
    timeScope === 'bounty' || (timeScope === 'month' && isBountyMonthKey(monthKey));

  const bountyWinnerCount = activeBountyConfig?.prizeCount ?? 10;
  const bountyCompleted = activeBountyConfig?.completed ?? false;
  const bountyMonthLabel = activeBountyConfig?.label ?? BOUNTY_MONTH_LABEL;

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
        const config = getBountyMonthConfig(BOUNTY_MONTH_KEY);
        if (config) Object.assign(params, bountyMonthToApiParams(config));
        else {
          params.period = 'month';
          params.month = BOUNTY_MONTH_KEY;
        }
      } else if (timeScope === 'month') {
        const config = getBountyMonthConfig(monthKey);
        if (config) Object.assign(params, bountyMonthToApiParams(config));
        else {
          params.period = 'month';
          params.month = monthKey;
        }
      } else {
        params.period = 'all';
      }

      const res = await apiClient.get('/users/leaderboard', params);
      const { rows: normalized, meta } = parseLeaderboardApiResponse(res);
      setLastUpdatedAt(meta.lastUpdatedAt);
      const filtered = normalized.filter((row) => !row.username.includes('AI_'));

      const displayConfig =
        timeScope === 'bounty'
          ? getBountyMonthConfig(BOUNTY_MONTH_KEY)
          : timeScope === 'month'
            ? getBountyMonthConfig(monthKey)
            : null;
      setRows(transformBountyLeaderboardRows(filtered, displayConfig));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [chainParam, monthKey, timeScope]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const myPosition =
    myLeaderboardUsernames.size > 0
      ? rows.findIndex((row) => row.username && myLeaderboardUsernames.has(row.username)) + 1
      : 0;

  const infoLabel = buildInfoLabel(chainParam, timeScope, monthKey);

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
      bountyMonthLabel={bountyMonthLabel}
      bountyCompleted={bountyCompleted}
      bountyWinnerCount={bountyWinnerCount}
      isFeaturedBountyView={isFeaturedBountyView}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
