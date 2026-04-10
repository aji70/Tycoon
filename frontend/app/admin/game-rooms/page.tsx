"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type RoomRow = {
  id: number;
  code: string;
  status: string;
  mode: string;
  chain: string | null;
  isAi: boolean;
  playerCount: number;
  numberOfPlayers: number;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
};

const STATUS_TABS = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "finished", label: "Finished" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export default function AdminGameRoomsPage() {
  const [status, setStatus] = useState<string>("active");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
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
        data?: { rooms: RoomRow[]; total: number; page: number; pageSize: number };
      }>("admin/rooms", {
        params: { page, pageSize, status, ...(q ? { q } : {}) },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setRooms(body.data.rooms);
      setTotal(body.data.total);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load rooms";
      setError(msg);
      setRooms([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Game rooms</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Live games from the database. Duration is from <code className="text-slate-500">started_at</code> (or{" "}
        <code className="text-slate-500">created_at</code>) to now for open games, or to <code className="text-slate-500">updated_at</code>{" "}
        for finished/cancelled. Cancelling a room does not unwind on-chain state.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              status === tab.value
                ? "bg-cyan-950/80 text-cyan-200 border-cyan-800/60"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-w-md">
        <label htmlFor="admin-room-search" className="block text-xs font-medium text-slate-500 mb-1">
          Search by code or id
        </label>
        <input
          id="admin-room-search"
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="e.g. ABC123 or 42"
          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-800/60"
        />
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Players</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Chain</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2 align-middle text-cyan-500" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rooms.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No rooms match this filter.
                  </td>
                </tr>
              )}
              {!loading &&
                rooms.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-cyan-200/90">{r.code}</span>
                      <span className="block text-xs text-slate-500">#{r.id}</span>
                      {r.isAi && (
                        <span className="text-[10px] uppercase text-violet-400/90">AI</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.status}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">
                      {r.playerCount} / {r.numberOfPlayers}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.mode}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.chain ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{formatDuration(r.durationMs)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/game-rooms/${r.id}`}
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
                      >
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
