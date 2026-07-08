"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiClient } from "@/lib/api";

type Period = "all" | "day" | "week" | "month";

type MostActivePlayer = {
  username: string | null;
  games: number;
};

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
  engagement?: {
    uniquePlayers: number;
    gamesPerPlayer: number;
    mostActivePlayer: MostActivePlayer | null;
    perkShopRevenueUsdc: number | null;
  };
  dailyGames?: { day: string; count: number }[];
};

function periodLabel(period: Period) {
  return period === "all" ? "All time" : `Last ${period}`;
}

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "2026-07-08" → "Jul 8" for the trend chart axis. */
function shortDayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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

/** 7-day games-created trend. Simple CSS bar chart (no chart lib) matching the dark card theme. */
function ActivityTrend({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          7-day activity trend
        </p>
        <p className="text-xs text-slate-500">
          Games created · {total.toLocaleString()} this week
        </p>
      </div>

      <div className="mt-5 flex h-40 items-end gap-2 sm:gap-3">
        {data.map((d) => {
          const heightPct = Math.round((d.count / max) * 100);
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-cyan-800/60 to-cyan-400/80 transition-all"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                  title={`${d.day}: ${d.count} games`}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-cyan-100">
                {d.count.toLocaleString()}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {shortDayLabel(d.day)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
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

              {data.engagement && (
                <>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Unique players
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-cyan-100 tabular-nums">
                      {data.engagement.uniquePlayers.toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Perk shop revenue
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-cyan-100 tabular-nums">
                      {formatUsd(data.engagement.perkShopRevenueUsdc)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">USDC volume</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Games per player
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-cyan-100 tabular-nums">
                      {data.engagement.gamesPerPlayer.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </p>
                    {data.engagement.mostActivePlayer && (
                      <p className="mt-1 text-xs text-slate-500">
                        Most active:{" "}
                        <span className="text-slate-300">
                          {data.engagement.mostActivePlayer.username ?? "Anonymous"}
                        </span>{" "}
                        · {data.engagement.mostActivePlayer.games.toLocaleString()} games
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {data.dailyGames && data.dailyGames.length > 0 && (
              <ActivityTrend data={data.dailyGames} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
