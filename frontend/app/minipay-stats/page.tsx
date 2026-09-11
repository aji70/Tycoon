"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api";
import {
  Activity,
  Bot,
  Gamepad2,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

type SeriesPoint = { date: string; count: number };

type Trends = {
  usersThisWeek?: number;
  usersToday?: number;
  gamesThisWeek?: number;
  gamesToday?: number;
  agentsThisWeek?: number;
  revenueThisWeekUsd?: number;
  transactionsThisWeek?: number;
  activeToday?: number;
  series?: {
    users?: SeriesPoint[];
    games?: SeriesPoint[];
  };
};

type Headline = {
  users: number;
  transactions: number;
  gamesCreated: number;
  agents: number;
  onchainRevenueUsd: number;
  activeToday?: number;
  trends?: Trends;
};

type MinipayStatsData = {
  headline?: Headline;
  users?: {
    registeredSinceCutoff?: number;
    distinctHumanPlayers?: number;
    distinctPlayers?: number;
  };
  transactions?: { total?: number };
  minipayGames?: { total?: number; createdToday?: number; createdThisWeek?: number };
  gamesOverTime?: { date: string; started?: number }[];
  usersOverTime?: SeriesPoint[];
  agents?: { total?: number; createdThisWeek?: number };
  generatedAt?: string;
};

function formatInt(n: number) {
  return Math.round(n).toLocaleString();
}

function formatUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function useCountUp(target: number, durationMs = 800) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setDisplay(0);
      return;
    }
    const start = performance.now();
    const from = 0;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return display;
}

function Sparkline({ points, className = "" }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const w = 72;
  const h = 22;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(max - min, 1);
  const coords = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 3) - 1.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-5 w-[4.5rem] overflow-visible ${className}`}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
      />
    </svg>
  );
}

function Delta({
  value,
  prefix = "+",
  suffix = " this week",
  money = false,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  money?: boolean;
}) {
  if (!Number.isFinite(value) || value <= 0) {
    return <span className="text-[11px] text-[#5d8589]">No change this week</span>;
  }
  const label = money ? formatUsd(value) : formatInt(value);
  return (
    <span className="text-[11px] font-medium text-[#00F0FF]/90">
      {prefix}
      {label}
      {suffix}
    </span>
  );
}

function StatCard({
  label,
  rawValue,
  format = formatInt,
  delta,
  series,
  icon: Icon,
  featured = false,
}: {
  label: string;
  rawValue: number;
  format?: (n: number) => string;
  delta: ReactNode;
  series?: number[];
  icon: LucideIcon;
  featured?: boolean;
}) {
  const animated = useCountUp(rawValue);
  const shown = format(animated);

  return (
    <div
      className={`group rounded-xl border bg-[#0A1A1C]/80 transition-all duration-200 ${
        featured
          ? "border-[#00F0FF]/25 px-5 py-5 shadow-[0_0_0_1px_rgba(0,240,255,0.04)] hover:-translate-y-0.5 hover:border-[#00F0FF]/45 hover:shadow-[0_8px_28px_-12px_rgba(0,240,255,0.35)]"
          : "border-[#003B3E]/70 px-4 py-4 hover:-translate-y-0.5 hover:border-[#00F0FF]/30 hover:shadow-[0_8px_24px_-14px_rgba(0,240,255,0.28)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center rounded-lg border ${
              featured
                ? "h-8 w-8 border-[#00F0FF]/25 bg-[#00F0FF]/10 text-[#00F0FF]"
                : "h-7 w-7 border-[#003B3E] bg-[#061012] text-[#7aa8ad] group-hover:border-[#00F0FF]/20 group-hover:text-[#00F0FF]"
            }`}
          >
            <Icon className={featured ? "h-4 w-4" : "h-3.5 w-3.5"} />
          </span>
          <p className="text-[11px] uppercase tracking-wide text-[#7aa8ad]">{label}</p>
        </div>
        {series && series.length > 1 ? (
          <Sparkline points={series} className="text-[#00F0FF]/70" />
        ) : null}
      </div>
      <p
        className={`mt-3 font-orbitron font-semibold tabular-nums text-white ${
          featured ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {shown}
      </p>
      <div className="mt-2">{delta}</div>
    </div>
  );
}

export default function MinipayStatsPublicPage() {
  const [data, setData] = useState<MinipayStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success?: boolean; data?: MinipayStatsData }>(
        "/analytics/minipay"
      );
      const backend = res?.data as { success?: boolean; data?: MinipayStatsData } | undefined;
      const stats = backend?.data;
      if (!stats) throw new Error("Failed to load MiniPay stats");
      setData(stats);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to load MiniPay stats";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const headline = useMemo<Headline>(() => {
    const trends = data?.headline?.trends;
    return {
      users:
        data?.headline?.users ??
        data?.users?.registeredSinceCutoff ??
        data?.users?.distinctHumanPlayers ??
        data?.users?.distinctPlayers ??
        0,
      transactions: data?.headline?.transactions ?? data?.transactions?.total ?? 0,
      gamesCreated: data?.headline?.gamesCreated ?? data?.minipayGames?.total ?? 0,
      agents: data?.headline?.agents ?? data?.agents?.total ?? 0,
      onchainRevenueUsd: data?.headline?.onchainRevenueUsd ?? 106,
      activeToday: data?.headline?.activeToday ?? data?.headline?.trends?.activeToday ?? 0,
      trends,
    };
  }, [data]);

  const trends = headline.trends;
  const userSeries =
    trends?.series?.users?.map((p) => p.count) ??
    data?.usersOverTime?.map((p) => p.count) ??
    [];
  const gameSeries =
    trends?.series?.games?.map((p) => p.count) ??
    data?.gamesOverTime?.map((p) => p.started ?? 0) ??
    [];

  return (
    <div className="min-h-screen bg-[#061012] text-[#E8F6F7]">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-orbitron text-[11px] uppercase tracking-[0.2em] text-[#00F0FF]/80">
              Tycoon · Public
            </p>
            <h1 className="mt-1 font-orbitron text-2xl font-bold text-white">MiniPay Stats</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-[#003B3E] px-3 py-2 text-sm text-[#9bc4c8] hover:bg-[#0A1A1C]"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-3 py-2 text-sm text-[#00F0FF] hover:bg-[#00F0FF]/15 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex items-center gap-2 py-16 text-[#9bc4c8]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading MiniPay stats…
          </div>
        ) : null}

        {data ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                featured
                label="On-chain revenue"
                rawValue={headline.onchainRevenueUsd}
                format={formatUsd}
                icon={Wallet}
                delta={
                  <Delta value={trends?.revenueThisWeekUsd ?? 0} money suffix=" this week" />
                }
              />
              <StatCard
                featured
                label="Users"
                rawValue={headline.users}
                icon={Users}
                series={userSeries}
                delta={<Delta value={trends?.usersThisWeek ?? 0} />}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Transactions"
                rawValue={headline.transactions}
                icon={Activity}
                delta={
                  <span className="text-[11px] text-[#5d8589]">Celo explorer lifetime</span>
                }
              />
              <StatCard
                label="Games created"
                rawValue={headline.gamesCreated}
                icon={Gamepad2}
                series={gameSeries}
                delta={<Delta value={trends?.gamesThisWeek ?? data?.minipayGames?.createdThisWeek ?? 0} />}
              />
              <StatCard
                label="Agents"
                rawValue={headline.agents}
                icon={Bot}
                delta={<Delta value={trends?.agentsThisWeek ?? data?.agents?.createdThisWeek ?? 0} />}
              />
              <StatCard
                label="Active today"
                rawValue={headline.activeToday ?? 0}
                icon={Zap}
                delta={<span className="text-[11px] text-[#5d8589]">Accounts active today</span>}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
