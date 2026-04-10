"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "all", label: "All time" },
] as const;

const CHAINS = ["CELO", "BASE", "POLYGON", "STARKNET"] as const;

type Row = {
  rank: number;
  userId: number;
  username: string | null;
  address: string | null;
  wins: number;
  gamesPlayed?: number;
};

function shortAddr(a: string | null) {
  if (!a) return "—";
  if (a.length < 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function AdminLeaderboardPage() {
  const [period, setPeriod] = useState<string>("all");
  const [chain, setChain] = useState<string>("CELO");
  const [limit, setLimit] = useState(50);
  const [source, setSource] = useState<"games" | "profile">("games");
  const [includeNullChain, setIncludeNullChain] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{
    windowStart: string | null;
    source: string;
    includeNullChain?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const effectiveSource = period === "all" ? source : "games";
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: {
          leaderboard: Row[];
          windowStart: string | null;
          source: string;
          includeNullChain?: boolean;
        };
      }>("admin/leaderboard", {
        params: {
          period,
          chain,
          limit,
          source: effectiveSource,
          ...(effectiveSource === "games" ? { includeNullChain } : {}),
        },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setRows(body.data.leaderboard);
      setMeta({
        windowStart: body.data.windowStart,
        source: body.data.source,
        includeNullChain: body.data.includeNullChain,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [period, chain, limit, source, includeNullChain]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (period !== "all" && source === "profile") {
      setSource("games");
    }
  }, [period, source]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Leaderboard</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        <strong>Games</strong> ranks by finished games with a winner in the time window (uses <code className="text-slate-500">games.updated_at</code>
        ). <strong>Profile</strong> (all-time only) uses the same user-column logic as the public leaderboard.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              period === p.value
                ? "bg-cyan-950/80 text-cyan-200 border-cyan-800/60"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 items-end">
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">Chain</span>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
          >
            {CHAINS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">Limit</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {period === "all" && (
          <label className="block text-sm">
            <span className="text-xs text-slate-500 block mb-1">Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "games" | "profile")}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
            >
              <option value="games">Finished games (DB)</option>
              <option value="profile">User profile columns</option>
            </select>
          </label>
        )}
        {source === "games" && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNullChain}
              onChange={(e) => setIncludeNullChain(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900"
            />
            Include null/empty chain rows
          </label>
        )}
      </div>

      {meta?.windowStart && (
        <p className="mt-2 text-xs text-slate-500">
          Window from {new Date(meta.windowStart).toISOString().slice(0, 19)}Z · source={meta.source}
          {meta.includeNullChain === false ? " · strict chain match" : ""}
        </p>
      )}
      {!meta?.windowStart && meta && (
        <p className="mt-2 text-xs text-slate-500">
          Full history (no date filter) · source={meta.source}
        </p>
      )}

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

      {!loading && !error && (() => {
        const showPlayed = rows.some((r) => r.gamesPlayed != null);
        const colCount = showPlayed ? 5 : 4;
        return (
        <div className="mt-6 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[520px]">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium text-right">Wins</th>
                  {showPlayed && (
                    <th className="px-4 py-3 font-medium text-right">Games played</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-10 text-center text-slate-500">
                      No rows. Try including null chain, another chain, or profile source for all-time.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={`${r.userId}-${r.rank}`} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{r.rank}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/players/${r.userId}`} className="text-cyan-400 hover:text-cyan-300 font-medium">
                        {r.username ?? `User #${r.userId}`}
                      </Link>
                      <span className="block text-xs text-slate-500">#{r.userId}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{shortAddr(r.address)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-cyan-100/90">{r.wins}</td>
                    {showPlayed && (
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {r.gamesPlayed != null ? r.gamesPlayed : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
