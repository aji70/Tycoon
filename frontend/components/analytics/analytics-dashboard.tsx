"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCallback, useMemo, useState } from "react";

const ANALYTICS_KEY_STORAGE = "tycoon_analytics_key";

export type GamesOverTimeDay = {
  date: string;
  started: number;
  finished: number;
};

export type DashboardData = {
  games: {
    total: number;
    byStatus: Record<string, number>;
    createdToday: number;
    finishedToday: number;
    createdThisWeek: number;
  };
  gamesOverTime: GamesOverTimeDay[];
  events: Record<string, number>;
  generatedAt: string;
};

export type ActivityEvent = {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[#00F0FF]/30 bg-[#0A1A1B]/80 p-5 backdrop-blur-sm">
      <p className="text-sm font-medium uppercase tracking-wider text-[#00F0FF]/80">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold text-[#F0F7F7]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#B0BFC0]">{sub}</p>}
    </div>
  );
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

function exportGamesOverTimeCSV(rows: GamesOverTimeDay[], filename = "analytics-games-over-time.csv") {
  const header = "Date,Games Started,Games Finished\n";
  const body = rows.map((r) => `${r.date},${r.started},${r.finished}`).join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [analyticsKey, setAnalyticsKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(ANALYTICS_KEY_STORAGE) || "";
  });
  const [keyInput, setKeyInput] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "activity">("overview");

  const headers = useMemo(() => {
    if (!analyticsKey) return undefined;
    return { "X-Analytics-Key": analyticsKey };
  }, [analyticsKey]);

  const queryKey = ["analytics-dashboard", dateRange.startDate, dateRange.endDate];
  const queryFn = useCallback(async () => {
    const params: Record<string, string> = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };
    const res = await apiClient.get<{ data: DashboardData }>(
      "analytics/dashboard",
      params,
      { headers }
    );
    if (!res.success || !res.data) throw new Error("Failed to load dashboard");
    const payload = (res.data as { data?: DashboardData })?.data ?? res.data;
    return payload as DashboardData;
  }, [dateRange.startDate, dateRange.endDate, headers]);

  const { data, isLoading, error, refetch, isError } = useQuery({
    queryKey,
    queryFn,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: (failureCount, err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) return false;
      return failureCount < 2;
    },
  });

  const activityQuery = useQuery({
    queryKey: ["analytics-activity", headers],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { events: ActivityEvent[]; errors: ActivityEvent[] } }>(
        "analytics/activity",
        { limit: "50" },
        { headers }
      );
      if (!res.success || !res.data) throw new Error("Failed to load activity");
      const payload = (res.data as { data?: { events: ActivityEvent[]; errors: ActivityEvent[] } })?.data ?? res.data;
      return payload as { events: ActivityEvent[]; errors: ActivityEvent[] };
    },
    enabled: activeTab === "activity" && !!headers && !!analyticsKey,
    staleTime: 30_000,
  });

  const isUnauthorized = isError && (error as { response?: { status?: number } })?.response?.status === 401;

  const submitKey = () => {
    const k = keyInput.trim();
    if (k) {
      sessionStorage.setItem(ANALYTICS_KEY_STORAGE, k);
      setAnalyticsKey(k);
      setKeyInput("");
      refetch();
    }
  };

  if (isUnauthorized && !analyticsKey) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-orbitron text-3xl font-bold text-[#00F0FF]">
          Analytics Dashboard
        </h1>
        <p className="mt-4 text-[#B0BFC0]">
          This dashboard is protected. Enter your analytics API key to continue.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitKey()}
            placeholder="API key"
            className="flex-1 rounded-lg border border-[#00F0FF]/40 bg-[#0A1A1B] px-3 py-2 text-[#F0F7F7] placeholder:text-[#B0BFC0]/60"
          />
          <button
            type="button"
            onClick={submitKey}
            className="rounded-lg bg-[#00F0FF]/20 px-4 py-2 font-medium text-[#00F0FF] hover:bg-[#00F0FF]/30"
          >
            Submit
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-orbitron text-3xl font-bold text-[#00F0FF]">
          Analytics Dashboard
        </h1>
        <p className="mt-4 text-[#B0BFC0]">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-orbitron text-3xl font-bold text-[#00F0FF]">
          Analytics Dashboard
        </h1>
        <p className="mt-4 text-red-400">
          Failed to load: {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-[#00F0FF]/20 px-4 py-2 font-medium text-[#00F0FF] hover:bg-[#00F0FF]/30"
        >
          Retry
        </button>
      </div>
    );
  }

  const d = data!;
  const statusEntries = Object.entries(d.games.byStatus).filter(
    ([status]) => status !== "PENDING" && status !== "FINISHED"
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-orbitron text-3xl font-bold text-[#00F0FF]">
          Analytics Dashboard
        </h1>
        <p className="text-xs text-[#B0BFC0]">
          Updated: {new Date(d.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Date range & export */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#B0BFC0]">From</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange((r) => ({ ...r, startDate: e.target.value }))}
            className="rounded border border-[#00F0FF]/40 bg-[#0A1A1B] px-2 py-1.5 text-sm text-[#F0F7F7]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#B0BFC0]">To</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange((r) => ({ ...r, endDate: e.target.value }))}
            className="rounded border border-[#00F0FF]/40 bg-[#0A1A1B] px-2 py-1.5 text-sm text-[#F0F7F7]"
          />
        </div>
        <button
          type="button"
          onClick={() => exportGamesOverTimeCSV(d.gamesOverTime || [])}
          className="rounded-lg border border-[#00F0FF]/40 px-3 py-1.5 text-sm text-[#00F0FF] hover:bg-[#00F0FF]/10"
        >
          Export CSV
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`rounded-lg px-3 py-1.5 text-sm ${activeTab === "overview" ? "bg-[#00F0FF]/20 text-[#00F0FF]" : "text-[#B0BFC0] hover:text-[#F0F7F7]"}`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`rounded-lg px-3 py-1.5 text-sm ${activeTab === "activity" ? "bg-[#00F0FF]/20 text-[#00F0FF]" : "text-[#B0BFC0] hover:text-[#F0F7F7]"}`}
          >
            Recent activity
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <section className="mt-8">
            <h2 className="mb-4 font-orbitron text-lg font-semibold text-[#F0F7F7]">
              Games
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total games" value={d.games.total} />
              <StatCard
                title="Created today"
                value={d.games.createdToday}
                sub="last 24h"
              />
              <StatCard
                title="Finished today"
                value={d.games.finishedToday}
                sub="last 24h"
              />
              <StatCard
                title="Created this week"
                value={d.games.createdThisWeek}
                sub="last 7 days"
              />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-[#00F0FF]/80">
                By status
              </p>
              <div className="flex flex-wrap gap-2">
                {statusEntries.map(([status, count]) => (
                  <span
                    key={status}
                    className="rounded-lg bg-[#0E1415] px-3 py-1.5 text-sm text-[#F0F7F7]"
                  >
                    {status}: {count}
                  </span>
                ))}
                {statusEntries.length === 0 && (
                  <span className="text-sm text-[#B0BFC0]">No data</span>
                )}
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-4 font-orbitron text-lg font-semibold text-[#F0F7F7]">
              Games over time (started vs finished)
            </h2>
            {d.gamesOverTime && d.gamesOverTime.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[#00F0FF]/20">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#00F0FF]/20 bg-[#0A1A1B]/80">
                      <th className="px-4 py-3 font-medium text-[#00F0FF]/90">Date</th>
                      <th className="px-4 py-3 font-medium text-[#00F0FF]/90">Started</th>
                      <th className="px-4 py-3 font-medium text-[#00F0FF]/90">Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...d.gamesOverTime].reverse().map((row) => (
                      <tr
                        key={row.date}
                        className="border-b border-[#00F0FF]/10 hover:bg-[#0A1A1B]/50"
                      >
                        <td className="px-4 py-2 text-[#F0F7F7]">{row.date}</td>
                        <td className="px-4 py-2 text-[#F0F7F7]">{row.started}</td>
                        <td className="px-4 py-2 text-[#F0F7F7]">{row.finished}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#B0BFC0]">No data for the selected range.</p>
            )}
          </section>

          {Object.keys(d.events).length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-orbitron text-lg font-semibold text-[#F0F7F7]">
                Recorded events
              </h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(d.events).map(([eventType, count]) => (
                  <span
                    key={eventType}
                    className="rounded-lg border border-[#00F0FF]/30 bg-[#0A1A1B]/80 px-3 py-1.5 text-sm text-[#F0F7F7]"
                  >
                    {eventType}: {count}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === "activity" && (
        <section className="mt-8">
          <h2 className="mb-4 font-orbitron text-lg font-semibold text-[#F0F7F7]">
            Recent activity & errors
          </h2>
          {activityQuery.isLoading && <p className="text-[#B0BFC0]">Loading activity…</p>}
          {activityQuery.isError && (
            <p className="text-red-400">{activityQuery.error instanceof Error ? activityQuery.error.message : "Failed to load"}</p>
          )}
          {activityQuery.data && (
            <div className="space-y-4">
              {activityQuery.data.errors.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-red-400/90">Recent errors</h3>
                  <ul className="space-y-1 rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-sm">
                    {activityQuery.data.errors.slice(0, 15).map((ev) => (
                      <li key={ev.id} className="text-[#F0F7F7]">
                        <span className="text-[#00F0FF]/80">{ev.created_at}</span> — {ev.event_type}
                        {ev.payload && typeof ev.payload === "object" && "message" in ev.payload && (
                          <span className="ml-1 text-[#B0BFC0]">{(ev.payload as { message?: string }).message?.slice(0, 80)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="mb-2 text-sm font-medium text-[#00F0FF]/80">Latest events</h3>
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[#00F0FF]/20 bg-[#0A1A1B]/50 p-3 text-sm">
                  {activityQuery.data.events.slice(0, 30).map((ev) => (
                    <li key={ev.id} className="text-[#F0F7F7]">
                      <span className="text-[#00F0FF]/80">{ev.created_at}</span> — {ev.event_type}
                      {ev.entity_type && <span className="ml-1 text-[#B0BFC0]">({ev.entity_type} #{ev.entity_id})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      <p className="mt-10 text-xs text-[#B0BFC0]">
        Set ANALYTICS_API_KEY in the backend to protect this dashboard. Use the date range and CSV export for reports.
      </p>
    </div>
  );
}
