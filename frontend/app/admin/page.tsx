"use client";

import { useEffect, useState } from "react";
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

const metricCards: { key: keyof PlatformMetrics; label: string; hint?: string }[] = [
  { key: "totalPlayers", label: "Total players" },
  { key: "activePlayersToday", label: "Active players today", hint: "Users updated today (UTC)" },
  { key: "totalGames", label: "Total games" },
  { key: "gamesRunningNow", label: "Games running now", hint: "RUNNING or IN_PROGRESS" },
  { key: "totalTokensDistributed", label: "Sum of total_earned", hint: "Across all users (DB)" },
  { key: "totalTrades", label: "Accepted trades" },
  { key: "totalPlayHistoryEvents", label: "Play history events" },
  { key: "totalPropertiesOwned", label: "Property ownership rows", hint: "Rows in game_properties" },
  { key: "flaggedReports", label: "Flagged reports", hint: "Moderation table not wired yet" },
];

function formatMetric(key: keyof PlatformMetrics, v: number): string {
  if (key === "totalTokensDistributed") {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return v.toLocaleString();
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: body } = await adminApi.get<{ success: boolean; data?: { metrics: PlatformMetrics } }>(
          "admin/overview"
        );
        if (cancelled) return;
        const m = body?.data?.metrics;
        if (!m) {
          setError("Unexpected response from admin overview.");
          return;
        }
        setMetrics(m);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load overview";
        setError(msg);
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
        Live counts from the database. Charts, leaderboards, and alerts will build on these endpoints in the next steps.
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
      )}
    </div>
  );
}
