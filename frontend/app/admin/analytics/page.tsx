"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import AdminBarChart from "@/components/admin/AdminBarChart";
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

type ActiveUsersPeriod = "daily" | "weekly" | "monthly";
type UserMetric = "active" | "new";

type ActiveUsersData = {
  period: ActiveUsersPeriod;
  series: { period: string; periodStart: string; activeUsers: number }[];
  summary: { dauToday: number; wauLast7Days: number; mauThisMonth: number };
  generatedAt: string;
};

type NewUsersData = {
  period: ActiveUsersPeriod;
  series: { period: string; periodStart: string; newUsers: number }[];
  summary: { newToday: number; newThisWeek: number; newThisMonth: number };
  source: string;
  generatedAt: string;
};

type RetentionCohort = {
  cohortDate: string;
  cohortSize: number;
  d1Retained: number;
  d3Retained: number;
  d7Retained: number;
  d1Rate: number | null;
  d3Rate: number | null;
  d7Rate: number | null;
  matureD1: boolean;
  matureD3: boolean;
  matureD7: boolean;
};

type RetentionData = {
  range: { start: string; end: string };
  cohorts: RetentionCohort[];
  summary: {
    avgD1Rate: number | null;
    avgD3Rate: number | null;
    avgD7Rate: number | null;
    matureCohortCount: { d1: number; d3: number; d7: number };
  };
  source: string;
  definition: string;
  generatedAt: string;
};

function formatRate(rate: number | null) {
  if (rate == null) return "—";
  return `${rate.toFixed(1)}%`;
}

const USER_METRIC_TABS: { value: UserMetric; label: string; hint: string }[] = [
  { value: "active", label: "Active users", hint: "Played or updated profile" },
  { value: "new", label: "New users", hint: "Account signups (users.created_at)" },
];

const ACTIVE_PERIOD_TABS: { value: ActiveUsersPeriod; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "Last 30 days" },
  { value: "weekly", label: "Weekly", hint: "Last 12 weeks (WAU)" },
  { value: "monthly", label: "Monthly", hint: "Last 12 months (MAU)" },
];

function formatPeriodLabel(period: ActiveUsersPeriod, row: { period: string; periodStart: string }) {
  if (period === "daily") return row.periodStart.slice(5);
  if (period === "monthly") return row.periodStart.slice(0, 7);
  return row.period.replace(/^\d{4}-W/, "W");
}

export default function AdminAnalyticsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userMetric, setUserMetric] = useState<UserMetric>("active");
  const [activePeriod, setActivePeriod] = useState<ActiveUsersPeriod>("daily");
  const [activeUsers, setActiveUsers] = useState<ActiveUsersData | null>(null);
  const [newUsers, setNewUsers] = useState<NewUsersData | null>(null);
  const [activeLoading, setActiveLoading] = useState(true);
  const [activeError, setActiveError] = useState<string | null>(null);

  const [retentionDays, setRetentionDays] = useState("30");
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [retentionLoading, setRetentionLoading] = useState(true);
  const [retentionError, setRetentionError] = useState<string | null>(null);

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

  const loadActiveUsers = useCallback(async () => {
    setActiveLoading(true);
    setActiveError(null);
    try {
      if (userMetric === "new") {
        const { data: body } = await adminApi.get<{ success: boolean; data?: NewUsersData }>(
          "admin/analytics/new-users",
          { params: { period: activePeriod } }
        );
        if (!body?.success || !body.data) {
          setActiveError("Unexpected new users response");
          setNewUsers(null);
          return;
        }
        setNewUsers(body.data);
        setActiveUsers(null);
        return;
      }

      const { data: body } = await adminApi.get<{ success: boolean; data?: ActiveUsersData }>(
        "admin/analytics/active-users",
        { params: { period: activePeriod } }
      );
      if (!body?.success || !body.data) {
        setActiveError("Unexpected active users response");
        setActiveUsers(null);
        return;
      }
      setActiveUsers(body.data);
      setNewUsers(null);
    } catch (e) {
      setActiveError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load user metrics"
      );
      setActiveUsers(null);
      setNewUsers(null);
    } finally {
      setActiveLoading(false);
    }
  }, [activePeriod, userMetric]);

  useEffect(() => {
    loadActiveUsers();
  }, [loadActiveUsers]);

  const loadRetention = useCallback(async () => {
    setRetentionLoading(true);
    setRetentionError(null);
    try {
      const params: Record<string, string> = {};
      const days = Number(retentionDays);
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();
      if (!startDate.trim() && !endDate.trim() && Number.isFinite(days) && days > 0) {
        params.days = String(days);
      }

      const { data: body } = await adminApi.get<{ success: boolean; data?: RetentionData }>(
        "admin/analytics/retention",
        { params }
      );
      if (!body?.success || !body.data) {
        setRetentionError("Unexpected retention response");
        setRetention(null);
        return;
      }
      setRetention(body.data);
    } catch (e) {
      setRetentionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load retention");
      setRetention(null);
    } finally {
      setRetentionLoading(false);
    }
  }, [retentionDays, startDate, endDate]);

  useEffect(() => {
    loadRetention();
  }, [loadRetention]);

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

      <section className="mt-8 rounded-xl border border-violet-900/40 bg-violet-950/15 p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-violet-100/95">
                {userMetric === "active" ? "Active users" : "New users"}
              </h2>
              <p className="mt-1 text-xs text-violet-200/60 max-w-2xl">
                {userMetric === "active" ? (
                  <>
                    Distinct users per period who played a move (
                    <code className="text-violet-100/50">game_play_history</code>) or had a profile update (
                    <code className="text-violet-100/50">users.updated_at</code>). UTC day boundaries.
                  </>
                ) : (
                  <>
                    New account signups per period from <code className="text-violet-100/50">users.created_at</code>.
                    UTC day boundaries. (First-time players by first move are in retention cohort sizes.)
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACTIVE_PERIOD_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActivePeriod(tab.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                    activePeriod === tab.value
                      ? "bg-violet-950/80 text-violet-100 border-violet-700/60"
                      : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600"
                  }`}
                  title={tab.hint}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {USER_METRIC_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setUserMetric(tab.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                  userMetric === tab.value
                    ? tab.value === "new"
                      ? "bg-sky-950/80 text-sky-100 border-sky-700/60"
                      : "bg-violet-950/80 text-violet-100 border-violet-700/60"
                    : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600"
                }`}
                title={tab.hint}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeLoading && (
          <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            Loading user metrics…
          </div>
        )}

        {activeError && !activeLoading && (
          <p className="mt-4 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
            {activeError}
          </p>
        )}

        {activeUsers && !activeLoading && userMetric === "active" && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">DAU today</p>
                <p className="text-xl font-semibold text-violet-100 tabular-nums">{activeUsers.summary.dauToday}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">WAU (7 days)</p>
                <p className="text-xl font-semibold text-slate-200 tabular-nums">{activeUsers.summary.wauLast7Days}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">MAU (this month)</p>
                <p className="text-xl font-semibold text-slate-200 tabular-nums">{activeUsers.summary.mauThisMonth}</p>
              </div>
            </div>

            <AdminBarChart
              series={activeUsers.series.map((row) => ({
                label: formatPeriodLabel(activePeriod, row),
                value: row.activeUsers,
                title: `${row.periodStart}: ${row.activeUsers.toLocaleString()} active users`,
              }))}
              valueLabel="active users"
              barClassName="bg-violet-600/80"
            />

            <div className="mt-4 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30 max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/90 text-slate-500 text-left sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Period</th>
                    <th className="px-3 py-2 font-medium text-right">Active users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {[...activeUsers.series].reverse().map((row) => (
                    <tr key={`${row.period}-${row.periodStart}`} className="text-slate-400">
                      <td className="px-3 py-1.5 font-mono text-slate-300">{row.periodStart}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{row.activeUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {newUsers && !activeLoading && userMetric === "new" && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">New today</p>
                <p className="text-xl font-semibold text-sky-100 tabular-nums">{newUsers.summary.newToday}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">New (7 days)</p>
                <p className="text-xl font-semibold text-slate-200 tabular-nums">{newUsers.summary.newThisWeek}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">New (this month)</p>
                <p className="text-xl font-semibold text-slate-200 tabular-nums">{newUsers.summary.newThisMonth}</p>
              </div>
            </div>

            <AdminBarChart
              series={newUsers.series.map((row) => ({
                label: formatPeriodLabel(activePeriod, row),
                value: row.newUsers,
                title: `${row.periodStart}: ${row.newUsers.toLocaleString()} new users`,
              }))}
              valueLabel="new users"
              barClassName="bg-sky-600/80"
            />

            <div className="mt-4 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30 max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/90 text-slate-500 text-left sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Period</th>
                    <th className="px-3 py-2 font-medium text-right">New users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {[...newUsers.series].reverse().map((row) => (
                    <tr key={`${row.period}-${row.periodStart}`} className="text-slate-400">
                      <td className="px-3 py-1.5 font-mono text-slate-300">{row.periodStart}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{row.newUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-emerald-100/95">Player retention (D1 / D3 / D7)</h2>
            <p className="mt-1 text-xs text-emerald-200/60 max-w-2xl">
              Cohorts by each user&apos;s first <code className="text-emerald-100/50">game_play_history</code> day
              (via <code className="text-emerald-100/50">game_players.user_id</code>). Dn = played again on cohort day + n
              (UTC). Rates show — until that day has fully passed.
            </p>
          </div>
          <label className="block text-sm shrink-0">
            <span className="text-xs text-slate-500 block mb-1">Cohort window (days)</span>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
            >
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </label>
        </div>

        {retentionLoading && (
          <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            Loading retention…
          </div>
        )}

        {retentionError && !retentionLoading && (
          <p className="mt-4 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
            {retentionError}
          </p>
        )}

        {retention && !retentionLoading && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">Avg D1 ({retention.summary.matureCohortCount.d1} cohorts)</p>
                <p className="text-xl font-semibold text-emerald-100 tabular-nums">{formatRate(retention.summary.avgD1Rate)}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">Avg D3 ({retention.summary.matureCohortCount.d3} cohorts)</p>
                <p className="text-xl font-semibold text-slate-200 tabular-nums">{formatRate(retention.summary.avgD3Rate)}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] uppercase text-slate-500">Avg D7 ({retention.summary.matureCohortCount.d7} cohorts)</p>
                <p className="text-xl font-semibold text-slate-200 tabular-nums">{formatRate(retention.summary.avgD7Rate)}</p>
              </div>
            </div>

            <AdminBarChart
              series={[...retention.cohorts]
                .reverse()
                .filter((row) => row.matureD7 && row.d7Rate != null)
                .map((row) => ({
                  label: row.cohortDate.slice(5),
                  value: row.d7Rate ?? 0,
                  title: `${row.cohortDate}: D7 ${formatRate(row.d7Rate)} (${row.d7Retained}/${row.cohortSize})`,
                }))}
              valueLabel="% D7"
              barClassName="bg-emerald-600/80"
            />

            <div className="mt-4 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30 max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/90 text-slate-500 text-left sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Cohort (first play)</th>
                    <th className="px-3 py-2 font-medium text-right">Users</th>
                    <th className="px-3 py-2 font-medium text-right">D1</th>
                    <th className="px-3 py-2 font-medium text-right">D3</th>
                    <th className="px-3 py-2 font-medium text-right">D7</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {retention.cohorts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                        No cohorts in range.
                      </td>
                    </tr>
                  )}
                  {retention.cohorts.map((row) => (
                    <tr key={row.cohortDate} className="text-slate-400">
                      <td className="px-3 py-1.5 font-mono text-slate-300">{row.cohortDate}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{row.cohortSize}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" title={`${row.d1Retained} retained`}>
                        {formatRate(row.d1Rate)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" title={`${row.d3Retained} retained`}>
                        {formatRate(row.d3Rate)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" title={`${row.d7Retained} retained`}>
                        {formatRate(row.d7Rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[10px] text-slate-600">
              Range {retention.range.start} → {retention.range.end}. Generated {retention.generatedAt}.
            </p>
          </>
        )}
      </section>

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
