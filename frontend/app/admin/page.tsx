"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, isAdminSecretConfigured } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";

type PlatformMetrics = {
  totalPlayers: number;
  activePlayersToday: number;
  totalGames: number;
  gamesRunningNow: number;
  totalTokensDistributed: number;
  totalTrades: number;
  totalPlayHistoryEvents: number;
  totalPropertiesOwned: number;
  flaggedReports: number;
};

type GamesOverDay = { date: string; started: number; finished: number };

type LeaderboardRow = {
  rank: number;
  userId: number;
  username: string | null;
  address: string | null;
  wins: number;
  gamesPlayed?: number;
};

const metricCards: { key: keyof PlatformMetrics; label: string; hint?: string }[] = [
  { key: "totalPlayers", label: "Total players" },
  { key: "activePlayersToday", label: "Active players today", hint: "Users updated today (UTC)" },
  { key: "totalGames", label: "Total games" },
  { key: "gamesRunningNow", label: "Games running now", hint: "RUNNING or IN_PROGRESS" },
  { key: "totalTokensDistributed", label: "Sum of total_earned", hint: "Across all users (DB)" },
  { key: "totalTrades", label: "Accepted trades" },
  { key: "totalPlayHistoryEvents", label: "Play history events" },
  { key: "totalPropertiesOwned", label: "Property ownership rows", hint: "Rows in game_properties" },
  {
    key: "flaggedReports",
    label: "Open reports",
    hint: "moderation_reports with status open; see /admin/moderation",
  },
];

function formatMetric(key: keyof PlatformMetrics, v: number): string {
  if (key === "totalTokensDistributed") {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return v.toLocaleString();
}

function shortAddr(a: string | null) {
  if (!a) return "—";
  if (a.length < 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function GamesVolumeBars({ series }: { series: GamesOverDay[] }) {
  if (!series.length) {
    return <p className="text-sm text-slate-600 mt-2">No series data for this range.</p>;
  }
  const max = Math.max(1, ...series.map((d) => d.started + d.finished));
  return (
    <div className="mt-4 flex items-end gap-1.5 h-32 px-1">
      {series.map((d) => {
        const pctS = (d.started / max) * 100;
        const pctF = (d.finished / max) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="flex gap-0.5 w-full h-28 items-end justify-center" title={`${d.date}: started ${d.started}, finished ${d.finished}`}>
              <div
                className="bg-cyan-600/75 w-[42%] rounded-t min-h-0 transition-all"
                style={{ height: `${pctS}%` }}
              />
              <div
                className="bg-emerald-600/65 w-[42%] rounded-t min-h-0 transition-all"
                style={{ height: `${pctF}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-600 truncate w-full text-center">{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [gamesOverTime, setGamesOverTime] = useState<GamesOverDay[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [chartNote, setChartNote] = useState<string | null>(null);
  const [leaderboardNote, setLeaderboardNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setChartNote(null);
      setLeaderboardNote(null);
      try {
        const [ovRes, dashRes, lbRes] = await Promise.allSettled([
          adminApi.get<{ success: boolean; data?: { metrics: PlatformMetrics } }>("admin/overview"),
          adminApi.get<{ success: boolean; data?: { gamesOverTime: GamesOverDay[] } }>("admin/analytics/dashboard"),
          adminApi.get<{
            success: boolean;
            data?: { leaderboard: LeaderboardRow[] };
          }>("admin/leaderboard", {
            params: { period: "all", chain: "CELO", limit: 10, source: "profile" },
          }),
        ]);

        if (cancelled) return;

        const ovBody = ovRes.status === "fulfilled" ? ovRes.value.data : null;
        if (ovRes.status !== "fulfilled" || !ovBody?.success || !ovBody?.data?.metrics) {
          const e = ovRes.status === "rejected" ? ovRes.reason : null;
          const msg =
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Unexpected response from admin overview.";
          setError(msg);
          setMetrics(null);
          return;
        }

        setMetrics(ovBody.data.metrics);

        const dashBody = dashRes.status === "fulfilled" ? dashRes.value.data : null;
        if (dashRes.status === "fulfilled" && dashBody?.success && dashBody?.data?.gamesOverTime) {
          setGamesOverTime(dashBody.data.gamesOverTime);
        } else {
          setGamesOverTime(null);
          setChartNote(
            dashRes.status === "rejected"
              ? dashRes.reason instanceof ApiError
                ? dashRes.reason.message
                : "Could not load games-over-time."
              : "Analytics dashboard unavailable."
          );
        }

        const lbBody = lbRes.status === "fulfilled" ? lbRes.value.data : null;
        if (lbRes.status === "fulfilled" && lbBody?.success && lbBody?.data?.leaderboard) {
          setLeaderboard(lbBody.data.leaderboard);
        } else {
          setLeaderboard([]);
          setLeaderboardNote(
            lbRes.status === "rejected"
              ? lbRes.reason instanceof ApiError
                ? lbRes.reason.message
                : "Could not load leaderboard preview."
              : "Leaderboard preview unavailable."
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load overview");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Dashboard overview</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Live platform metrics, a seven-day games volume strip from analytics, and an all-time wins preview (CELO profile
        source). Live alerts load in the right panel on wide screens.
      </p>

      {!isAdminSecretConfigured() && (
        <p className="mt-4 text-sm text-amber-200/90 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 max-w-2xl">
          Without a shared secret, the backend may reject requests (when <code className="text-amber-100">TYCOON_ADMIN_SECRET</code>{" "}
          is set) or allow them open (when unset — avoid in production).
        </p>
      )}

      {loading && (
        <div className="mt-8 flex items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          Loading metrics…
        </div>
      )}

      {error && !loading && (
        <p className="mt-8 text-red-400 text-sm rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      {metrics && !loading && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metricCards.map(({ key, label, hint }) => (
              <div
                key={key}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-100 tabular-nums">
                  {formatMetric(key, metrics[key])}
                </p>
                {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-4">
              <h2 className="text-sm font-semibold text-slate-200">Games volume</h2>
              <p className="text-xs text-slate-500 mt-1">
                Per-day games <span className="text-cyan-400/90">started</span> (create) vs{" "}
                <span className="text-emerald-400/90">finished</span> — same window as{" "}
                <Link href="/admin/analytics" className="text-cyan-400 hover:underline">
                  Analytics
                </Link>
                .
              </p>
              {chartNote && <p className="text-xs text-amber-200/90 mt-2">{chartNote}</p>}
              {gamesOverTime && <GamesVolumeBars series={gamesOverTime} />}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-4 overflow-x-auto">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-200">Leaderboard preview</h2>
                <Link href="/admin/leaderboard" className="text-xs text-cyan-400 hover:underline">
                  Full leaderboard
                </Link>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Top 10 on CELO from the profile table (lifetime wins / games played).
              </p>
              {leaderboardNote && <p className="text-xs text-amber-200/90 mt-2">{leaderboardNote}</p>}
              {leaderboard.length > 0 && (
                <table className="mt-4 w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="text-xs uppercase text-slate-500 border-b border-slate-800">
                      <th className="py-2 pr-2 font-medium">Rank</th>
                      <th className="py-2 pr-2 font-medium">Player</th>
                      <th className="py-2 pr-2 font-medium hidden sm:table-cell">Wallet</th>
                      <th className="py-2 pr-2 font-medium text-right">Games</th>
                      <th className="py-2 font-medium text-right">Won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row) => (
                      <tr key={row.userId} className="border-b border-slate-800/60 text-slate-300">
                        <td className="py-2 pr-2 tabular-nums text-slate-500">{row.rank}</td>
                        <td className="py-2 pr-2">
                          <Link href={`/admin/players/${row.userId}`} className="text-cyan-400 hover:underline">
                            {row.username ?? `User #${row.userId}`}
                          </Link>
                        </td>
                        <td className="py-2 pr-2 font-mono text-xs text-slate-500 hidden sm:table-cell">
                          {shortAddr(row.address)}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{row.gamesPlayed ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{row.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!leaderboardNote && leaderboard.length === 0 && (
                <p className="text-sm text-slate-600 mt-4">No leaderboard rows returned.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
