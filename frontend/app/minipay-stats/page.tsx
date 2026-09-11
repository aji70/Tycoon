"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";

type Headline = {
  users: number;
  transactions: number;
  gamesCreated: number;
  agents: number;
  onchainRevenueUsd: number;
};

type MinipayStatsData = {
  headline?: Headline;
  users?: {
    registeredSinceCutoff?: number;
    distinctHumanPlayers?: number;
    distinctPlayers?: number;
  };
  transactions?: { total?: number };
  minipayGames?: { total?: number };
  agents?: { total?: number };
  generatedAt?: string;
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#003B3E]/70 bg-[#0A1A1C]/80 px-4 py-4">
      <p className="text-[11px] uppercase tracking-wide text-[#7aa8ad]">{label}</p>
      <p className="mt-2 font-orbitron text-3xl font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function formatUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

  const headline: Headline = {
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
  };

  return (
    <div className="min-h-screen bg-[#061012] text-[#E8F6F7]">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Users" value={headline.users} />
            <StatCard label="Transactions" value={headline.transactions} />
            <StatCard label="On-chain revenue" value={formatUsd(headline.onchainRevenueUsd)} />
            <StatCard label="Games created" value={headline.gamesCreated} />
            <StatCard label="Agents" value={headline.agents} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
