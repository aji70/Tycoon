"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiClient } from "@/lib/api";

type Period = "all" | "day" | "week" | "month";

type PublicStatsData = {
  period: Period;
  generatedAt: string;
  totals: {
    totalTransactions: number;
    totalTokenTransfers: number;
    totalGames: number;
    totalTrades: number;
    totalPlayHistoryEvents: number;
    totalPropertiesOwned: number;
  };
};

function periodLabel(period: Period) {
  return period === "all" ? "All time" : `Last ${period}`;
}

function metricLabel(key: keyof PublicStatsData["totals"]) {
  switch (key) {
    case "totalTransactions":
      return "Transactions";
    case "totalTokenTransfers":
      return "Token transfers";
    case "totalGames":
      return "Games created";
    case "totalTrades":
      return "Accepted trades";
    case "totalPlayHistoryEvents":
      return "Play history events";
    case "totalPropertiesOwned":
      return "Property ownership rows";
    default:
      return key;
  }
}

export default function PublicStatsPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<PublicStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<{ success: boolean; data?: PublicStatsData }>(
          "public/stats",
          { period },
        );
        const body = res.data;
        if (!cancelled) {
          if (!body?.success || !body.data) {
            setError("Unexpected response");
            setData(null);
            return;
          }
          setData(body.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load stats");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Tycoon Stats</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Public totals for on-chain contract activity and core game activity metrics.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            View leaderboard
          </Link>
        </div>

        {loading && (
          <div className="mt-8 text-sm text-slate-400">Loading stats…</div>
        )}

        {error && !loading && (
          <div className="mt-8 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            <p className="mt-6 text-xs text-slate-500">
              Range: {periodLabel(data.period)} · Generated {data.generatedAt}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(data.totals).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {metricLabel(key as keyof PublicStatsData["totals"])}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-cyan-100 tabular-nums">
                    {value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
