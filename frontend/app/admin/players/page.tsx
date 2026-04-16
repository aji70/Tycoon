"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type PlayerRow = {
  id: number;
  username: string;
  address: string;
  chain: string;
  is_guest?: boolean;
  games_played: number;
  game_won: number;
  game_lost: number;
  total_earned: number;
  created_at: string;
  updated_at?: string;
  status: string;
};

const SORT_OPTIONS = [
  { value: "created_at_desc", label: "Newest first" },
  { value: "created_at_asc", label: "Oldest first" },
  { value: "games_played_desc", label: "Most games played" },
  { value: "total_earned_desc", label: "Highest total earned" },
  { value: "username_asc", label: "Username A–Z" },
] as const;

function shortenAddr(a: string, left = 6, right = 4) {
  if (!a || a.length < left + right + 3) return a || "—";
  return `${a.slice(0, left)}…${a.slice(-right)}`;
}

function statusBadgeClass(status: string) {
  const s = String(status || "active").toLowerCase();
  if (s === "banned") return "bg-red-950/50 text-red-300 border-red-900/50";
  if (s === "suspended") return "bg-amber-950/50 text-amber-300 border-amber-900/50";
  return "bg-emerald-950/50 text-emerald-400/90 border-emerald-900/40";
}

export default function AdminPlayersPage() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sort, setSort] = useState<string>("created_at_desc");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: { players: PlayerRow[]; total: number; page: number; pageSize: number };
      }>("admin/players", {
        params: { page, pageSize, sort, ...(q ? { q } : {}) },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setPlayers(body.data.players);
      setTotal(body.data.total);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load players";
      setError(msg);
      setPlayers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sort, q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Player management</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Search by username, wallet address, or numeric user id. Use each player’s profile to suspend, ban, or restore
        access (requires DB migration <code className="text-slate-600">account_status</code>).
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1 max-w-md">
          <label htmlFor="admin-player-search" className="block text-xs font-medium text-slate-500 mb-1">
            Search
          </label>
          <input
            id="admin-player-search"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Username, address, or id…"
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-800/60"
          />
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="admin-player-sort" className="block text-xs font-medium text-slate-500 mb-1">
            Sort
          </label>
          <select
            id="admin-player-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-800/60"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Chain</th>
                <th className="px-4 py-3 font-medium text-right">Games</th>
                <th className="px-4 py-3 font-medium text-right">W / L</th>
                <th className="px-4 py-3 font-medium text-right">Total earned</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2 align-middle text-cyan-500" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && players.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No players match this search.
                  </td>
                </tr>
              )}
              {!loading &&
                players.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-200">
                      <span className="font-medium">{p.username}</span>
                      <span className="block text-xs text-slate-500">#{p.id}</span>
                      {p.is_guest && (
                        <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wide text-amber-500/90">
                          Guest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{shortenAddr(p.address)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.chain}</td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{p.games_played}</td>
                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-xs">
                      {p.game_won} / {p.game_lost}
                    </td>
                    <td className="px-4 py-3 text-right text-cyan-200/90 tabular-nums">
                      {Number(p.total_earned).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium border ${statusBadgeClass(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/players/${p.id}`}
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:border-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="text-slate-400 tabular-nums px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:border-slate-600"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
