"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type WalletRow = {
  userId: number;
  username: string;
  primaryAddress: string;
  chain: string;
  isGuest: boolean;
  smartWalletAddress: string | null;
  linkedWalletAddress: string | null;
  gamesPlayed: number;
  gamesWon: number;
  totalEarned: number;
  status: string;
  updatedAt: string;
};

const CHAINS = ["", "CELO", "BASE", "POLYGON", "STARKNET"] as const;

function short(a: string | null, left = 8, right = 6) {
  if (!a) return "—";
  if (a.length <= left + right + 2) return a;
  return `${a.slice(0, left)}…${a.slice(-right)}`;
}

export default function AdminWalletMonitorPage() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [chain, setChain] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(40);
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: { wallets: WalletRow[]; total: number; page: number; pageSize: number };
      }>("admin/wallets", {
        params: {
          page,
          pageSize,
          sort,
          ...(q ? { q } : {}),
          ...(chain ? { chain } : {}),
        },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setRows(body.data.wallets);
      setTotal(body.data.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, chain, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Wallet monitor</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        User records and linked addresses from the database. <strong>No on-chain balances</strong> here — add an indexer later if needed.{" "}
        <strong>Freeze wallet</strong> is not implemented yet (would need a flag on <code className="text-slate-500">users</code>).
      </p>

      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px] max-w-md">
          <label htmlFor="wm-q" className="block text-xs text-slate-500 mb-1">
            Search
          </label>
          <input
            id="wm-q"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Username, address, user id…"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">Chain</span>
          <select
            value={chain}
            onChange={(e) => {
              setChain(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          >
            {CHAINS.map((c) => (
              <option key={c || "all"} value={c}>
                {c === "" ? "All" : c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">Sort</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          >
            <option value="updated_desc">Recently updated</option>
            <option value="created_desc">Newest users</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[900px]">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Primary</th>
                <th className="px-3 py-3 font-medium">Smart / linked</th>
                <th className="px-3 py-3 font-medium">Chain</th>
                <th className="px-3 py-3 font-medium text-right">Games</th>
                <th className="px-3 py-3 font-medium text-right">Earned</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2 text-cyan-500" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    No rows.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((w) => (
                  <tr key={w.userId} className="hover:bg-slate-800/40 text-slate-300">
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-200">{w.username}</span>
                      <span className="block text-xs text-slate-500">#{w.userId}</span>
                      {w.isGuest && <span className="text-[10px] text-amber-500/90 uppercase">Guest</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{short(w.primaryAddress)}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500 leading-tight">
                      <div>SW: {short(w.smartWalletAddress, 6, 4)}</div>
                      <div>LW: {short(w.linkedWalletAddress, 6, 4)}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{w.chain}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {w.gamesPlayed} <span className="text-slate-600">/</span> {w.gamesWon}w
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-cyan-200/80 text-xs">
                      {w.totalEarned.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs rounded-md bg-emerald-950/50 text-emerald-400/90 px-2 py-0.5 border border-emerald-900/40">
                        {w.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/admin/players/${w.userId}`} className="text-cyan-400 hover:text-cyan-300 text-xs">
                        Open
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
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="tabular-nums px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 disabled:opacity-40"
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
