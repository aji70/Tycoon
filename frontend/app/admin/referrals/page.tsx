"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

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

export default function AdminReferralsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Referrals</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-3xl">
        Attribution is stored on <code className="text-slate-500">users</code> (<code className="text-slate-500">referral_code</code>,{" "}
        <code className="text-slate-500">referred_by_user_id</code>). Players:{" "}
        <code className="text-slate-500">GET /api/referral/me</code>, <code className="text-slate-500">POST /api/referral/attach</code>, or{" "}
        <code className="text-slate-500">POST /auth/privy-signin</code> with <code className="text-slate-500">referralCode</code> /{" "}
        <code className="text-slate-500">ref</code>. Rewards and events are not implemented yet.
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
    </div>
  );
}
