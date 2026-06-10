"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

type GamesOverDay = { date: string; started: number; finished: number };

type DashboardData = {
  games: {
    total: number;
    byStatus: Record<string, number>;
    createdToday: number;
    finishedToday: number;
    createdThisWeek: number;
  };
  gamesOverTime: GamesOverDay[];
  events: Record<string, number>;
  generatedAt: string;
};

type ActivityRow = {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  payload: unknown;
  created_at: string;
};

export default function AdminAnalyticsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const [dRes, aRes] = await Promise.all([
        adminApi.get<{ success: boolean; data?: DashboardData }>("admin/analytics/dashboard", { params }),
        adminApi.get<{ success: boolean; data?: { events: ActivityRow[] } }>("admin/analytics/activity", {
          params: { limit: 100 },
        }),
      ]);

      const dBody = dRes.data;
      const aBody = aRes.data;
      if (!dBody?.success || !dBody.data) throw new Error("Dashboard response invalid");
      if (!aBody?.success || !aBody.data) throw new Error("Activity response invalid");

      setDash(dBody.data);
      setActivity(aBody.data.events || []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
      setDash(null);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const maxDayTotal = dash?.gamesOverTime?.length
    ? Math.max(
        1,
        ...dash.gamesOverTime.map((x) => x.started + x.finished)
      )
    : 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Analytics</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Same aggregates as <code className="text-slate-500">/api/analytics/dashboard</code>, authorized by the admin secret. Optional date range narrows the games-over-time window (max ~31-day span in the service).
      </p>

      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50"
        >
          Apply range
        </button>
      </div>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      {dash && !loading && (
        <>
          <p className="mt-4 text-xs text-slate-600">Generated {dash.generatedAt}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Games total</p>
              <p className="text-2xl font-semibold text-cyan-100 tabular-nums mt-1">{dash.games.total.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Created today</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">{dash.games.createdToday}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Finished today</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">{dash.games.finishedToday}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Created this week</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">{dash.games.createdThisWeek}</p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Games by status</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(dash.games.byStatus).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300"
                >
                  {k}: <strong className="text-cyan-200/90 tabular-nums">{v}</strong>
                </span>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Event type counts</h2>
            <div className="flex flex-wrap gap-2">
              {Object.keys(dash.events).length === 0 && (
                <span className="text-xs text-slate-500">No analytics_events aggregates in range.</span>
              )}
              {Object.entries(dash.events).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300"
                >
                  {k}: <strong className="tabular-nums">{v}</strong>
                </span>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Games started / finished by day</h2>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30 max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/90 text-slate-500 text-left sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium text-right">Started</th>
                    <th className="px-3 py-2 font-medium text-right">Finished</th>
                    <th className="px-3 py-2 font-medium">Mix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {dash.gamesOverTime.map((row) => {
                    const t = row.started + row.finished;
                    const barW = Math.max(8, Math.round((t / maxDayTotal) * 100));
                    return (
                      <tr key={row.date} className="text-slate-400">
                        <td className="px-3 py-1.5 font-mono text-slate-300">{row.date}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{row.started}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{row.finished}</td>
                        <td className="px-3 py-1.5">
                          <div
                            className="h-2 rounded bg-slate-800 overflow-hidden flex max-w-[140px]"
                            style={{ width: `${barW}%` }}
                            title={`${row.started} started, ${row.finished} finished`}
                          >
                            {t > 0 && (
                              <>
                                <div
                                  className="h-full bg-cyan-700/80 shrink-0"
                                  style={{ width: `${(row.started / t) * 100}%` }}
                                />
                                <div
                                  className="h-full bg-emerald-700/70 shrink-0"
                                  style={{ width: `${(row.finished / t) * 100}%` }}
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent analytics events</h2>
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30 max-h-96 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/90 text-slate-500 sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Entity</th>
                <th className="px-3 py-2 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {activity.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    No rows (analytics_events table missing or empty).
                  </td>
                </tr>
              )}
              {activity.map((ev) => (
                <tr key={ev.id} className="text-slate-400">
                  <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[10px]">
                    {ev.created_at ? String(ev.created_at).slice(0, 19).replace("T", " ") : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-cyan-200/80">{ev.event_type}</td>
                  <td className="px-3 py-1.5">
                    {ev.entity_type ?? "—"} {ev.entity_id != null ? `#${ev.entity_id}` : ""}
                  </td>
                  <td className="px-3 py-1.5 max-w-xs truncate font-mono text-[10px] text-slate-500">
                    {ev.payload != null ? JSON.stringify(ev.payload) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
