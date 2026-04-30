"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type AuditEntry = {
  id: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

function payloadPreview(p: unknown): string {
  if (p == null) return "—";
  try {
    return JSON.stringify(p, null, 0);
  } catch {
    return String(p);
  }
}

export default function AdminAuditLogPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(40);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        data?: { entries: AuditEntry[]; total: number; page: number; pageSize: number };
      }>("admin/audit-log", {
        params: {
          page,
          pageSize,
          ...(actionFilter.trim() ? { action: actionFilter.trim() } : {}),
          ...(q ? { q } : {}),
        },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setRows(body.data.entries);
      setTotal(body.data.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Audit log</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Append-only record of mutating admin actions (room cancel, voucher grant, property edits, moderation updates).
        Per-admin identity is not stored yet (shared secret only).
      </p>

      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <div className="w-48">
          <label htmlFor="al-action" className="block text-xs text-slate-500 mb-1">
            Action contains
          </label>
          <input
            id="al-action"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. rooms."
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <label htmlFor="al-q" className="block text-xs text-slate-500 mb-1">
            Search action / target id
          </label>
          <input
            id="al-q"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Id</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2 w-24">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  <Loader2 className="inline w-5 h-5 animate-spin mr-2 align-middle" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No entries (run migrations if the table is missing).
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-slate-900/40 align-top">
                    <td className="px-3 py-2 text-slate-400 font-mono">{r.id}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-cyan-200/90 font-mono text-xs">{r.action}</td>
                    <td className="px-3 py-2 text-slate-300 text-xs">
                      {r.targetType ? (
                        <>
                          <span className="text-slate-500">{r.targetType}</span>
                          {r.targetId ? <> · {r.targetId}</> : null}
                        </>
                      ) : (
                        r.targetId ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs font-mono">{r.ip ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                        className="text-xs rounded bg-slate-800 px-2 py-1 text-slate-300"
                      >
                        {expandedId === r.id ? "Hide" : "JSON"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="bg-slate-950/60">
                      <td colSpan={6} className="px-3 py-3">
                        <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                          {payloadPreview(r.payload)}
                        </pre>
                        {r.userAgent && (
                          <p className="mt-2 text-xs text-slate-500 break-all">UA: {r.userAgent}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          {total} entr{total === 1 ? "y" : "ies"} · page {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
