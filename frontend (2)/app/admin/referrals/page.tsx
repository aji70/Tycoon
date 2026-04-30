"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type Overview = {
  totals: { users: number; withReferralCode: number; referredUsers: number };
  topReferrers: {
    referrerUserId: number;
    referrerUsername: string;
    referrerCode: string | null;
    referralCount: number;
  }[];
  recentReferrals: {
    userId: number;
    username: string;
    referredAt: string | null;
    referrerUserId: number | null;
    referrerUsername: string | null;
    referrerCode: string | null;
  }[];
};

type ReferralEventRow = {
  id: number;
  refereeUserId: number;
  refereeUsername: string | null;
  eventType: string;
  referrerUserId: number | null;
  referrerUsername: string | null;
  codeNormalized: string | null;
  failureReason: string | null;
  source: string;
  metadata: unknown;
  createdAt: string;
};

export default function AdminReferralsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [evPage, setEvPage] = useState(1);
  const [evPageSize] = useState(25);
  const [evType, setEvType] = useState("");
  const [evSource, setEvSource] = useState("");
  const [evRows, setEvRows] = useState<ReferralEventRow[]>([]);
  const [evTotal, setEvTotal] = useState(0);
  const [evLoading, setEvLoading] = useState(true);
  const [evError, setEvError] = useState<string | null>(null);
  const [evTableMissing, setEvTableMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: body } = await adminApi.get<{ success: boolean; data?: Overview }>("admin/referrals/overview");
        if (cancelled) return;
        if (!body?.success || !body.data) {
          setError("Unexpected response");
          return;
        }
        setData(body.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEvents = useCallback(async () => {
    setEvLoading(true);
    setEvError(null);
    try {
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: {
          events: ReferralEventRow[];
          total: number;
          page: number;
          pageSize: number;
          tableMissing?: boolean;
        };
      }>("admin/referrals/events", {
        params: {
          page: evPage,
          pageSize: evPageSize,
          ...(evType ? { eventType: evType } : {}),
          ...(evSource ? { source: evSource } : {}),
        },
      });
      if (!body?.success || !body.data) {
        setEvError("Unexpected response");
        return;
      }
      setEvRows(body.data.events);
      setEvTotal(body.data.total);
      setEvTableMissing(Boolean(body.data.tableMissing));
    } catch (e) {
      setEvTableMissing(false);
      setEvError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
      setEvRows([]);
      setEvTotal(0);
    } finally {
      setEvLoading(false);
    }
  }, [evPage, evPageSize, evType, evSource]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const evTotalPages = Math.max(1, Math.ceil(evTotal / evPageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Referrals</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-3xl">
        Attribution is stored on <code className="text-slate-500">users</code> (<code className="text-slate-500">referral_code</code>,{" "}
        <code className="text-slate-500">referred_by_user_id</code>). Players:{" "}
        <code className="text-slate-500">GET /api/referral/me</code>, <code className="text-slate-500">POST /api/referral/attach</code>, or{" "}
        <code className="text-slate-500">POST /auth/privy-signin</code> with <code className="text-slate-500">referralCode</code> /{" "}
        <code className="text-slate-500">ref</code>. Attach attempts are logged to <code className="text-slate-500">referral_events</code> (run
        migrations). Rewards are still TBD.
      </p>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">{error}</p>
      )}

      {data && !loading && (
        <div className="mt-8 space-y-8">
          <section className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 min-w-[140px]">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Users</p>
              <p className="text-2xl font-semibold text-slate-100 tabular-nums">{data.totals.users}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 min-w-[140px]">
              <p className="text-xs text-slate-500 uppercase tracking-wide">With code</p>
              <p className="text-2xl font-semibold text-cyan-200/90 tabular-nums">{data.totals.withReferralCode}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 min-w-[140px]">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Referred signups</p>
              <p className="text-2xl font-semibold text-emerald-200/90 tabular-nums">{data.totals.referredUsers}</p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Top referrers</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm text-left min-w-[480px]">
                <thead className="bg-slate-900/90 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">Referrer</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2 text-right">Signups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {data.topReferrers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                        No referral edges yet.
                      </td>
                    </tr>
                  ) : (
                    data.topReferrers.map((r) => (
                      <tr key={r.referrerUserId} className="hover:bg-slate-900/50">
                        <td className="px-3 py-2">
                          <Link href={`/admin/players/${r.referrerUserId}`} className="text-cyan-400 hover:underline">
                            {r.referrerUsername}
                          </Link>
                          <span className="text-slate-600 text-xs ml-2">#{r.referrerUserId}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.referrerCode ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.referralCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent referred signups</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm text-left min-w-[520px]">
                <thead className="bg-slate-900/90 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Referred by</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {data.recentReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                        No rows.
                      </td>
                    </tr>
                  ) : (
                    data.recentReferrals.map((row) => (
                      <tr key={row.userId} className="hover:bg-slate-900/50">
                        <td className="px-3 py-2">
                          <Link href={`/admin/players/${row.userId}`} className="text-cyan-400 hover:underline">
                            {row.username}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {row.referrerUserId != null ? (
                            <Link href={`/admin/players/${row.referrerUserId}`} className="text-slate-300 hover:text-cyan-400">
                              {row.referrerUsername ?? `#${row.referrerUserId}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {row.referrerCode && (
                            <span className="block text-xs font-mono text-slate-500">{row.referrerCode}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                          {row.referredAt ? new Date(row.referredAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Attach activity log</h2>
          <p className="text-xs text-slate-500 mb-3 max-w-3xl">
            Success and failed attempts from <code className="text-slate-600">POST /api/referral/attach</code> (source{" "}
            <span className="font-mono">api</span>) and Privy sign-in (source <span className="font-mono">privy_signin</span>).
          </p>
          {evTableMissing && (
            <p className="mb-3 text-sm text-amber-200/90 border border-amber-900/40 bg-amber-950/25 rounded-lg px-3 py-2 max-w-xl">
              The <code className="text-amber-100/80">referral_events</code> table is not present yet. Run{" "}
              <code className="text-amber-100/80">npx knex migrate:latest</code> in <code className="text-amber-100/80">backend</code>.
            </p>
          )}
          <div className="flex flex-wrap gap-3 items-end mb-3">
            <label className="block text-sm">
              <span className="text-xs text-slate-500 block mb-1">Outcome</span>
              <select
                value={evType}
                onChange={(e) => {
                  setEvType(e.target.value);
                  setEvPage(1);
                }}
                className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              >
                <option value="">All</option>
                <option value="attach_success">Success</option>
                <option value="attach_failed">Failed</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs text-slate-500 block mb-1">Source</span>
              <select
                value={evSource}
                onChange={(e) => {
                  setEvSource(e.target.value);
                  setEvPage(1);
                }}
                className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              >
                <option value="">All</option>
                <option value="api">api</option>
                <option value="privy_signin">privy_signin</option>
                <option value="unknown">unknown</option>
              </select>
            </label>
          </div>
          {evError && <p className="mb-2 text-sm text-red-400">{evError}</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead className="bg-slate-900/90 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Referee</th>
                  <th className="px-3 py-2">Outcome</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Referrer</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {evLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      <Loader2 className="inline w-5 h-5 animate-spin mr-2 align-middle" />
                      Loading events…
                    </td>
                  </tr>
                ) : evRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      No events yet.
                    </td>
                  </tr>
                ) : (
                  evRows.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-900/50">
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/players/${ev.refereeUserId}`} className="text-cyan-400 hover:underline">
                          {ev.refereeUsername ?? `#${ev.refereeUserId}`}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {ev.eventType === "attach_success" ? (
                          <span className="text-emerald-400/90">success</span>
                        ) : (
                          <span className="text-amber-300/90">failed</span>
                        )}
                        {ev.failureReason && (
                          <span className="block text-xs font-mono text-slate-500">{ev.failureReason}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{ev.codeNormalized ?? "—"}</td>
                      <td className="px-3 py-2">
                        {ev.referrerUserId != null ? (
                          <Link href={`/admin/players/${ev.referrerUserId}`} className="text-slate-300 hover:text-cyan-400">
                            {ev.referrerUsername ?? `#${ev.referrerUserId}`}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{ev.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
            <span>
              Page {evPage} / {evTotalPages} · {evTotal} rows
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={evPage <= 1 || evLoading}
                onClick={() => setEvPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={evPage >= evTotalPages || evLoading}
                onClick={() => setEvPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
