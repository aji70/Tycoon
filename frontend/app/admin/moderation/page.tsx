"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type ReportRow = {
  id: number;
  reporterUserId: number | null;
  reporterUsername: string | null;
  targetUserId: number | null;
  targetUsername: string | null;
  targetType: string;
  targetRef: string | null;
  category: string;
  details: string | null;
  status: string;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = ["", "open", "reviewing", "resolved", "dismissed"] as const;

export default function AdminModerationPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [category, setCategory] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState("");
  const [createTargetUserId, setCreateTargetUserId] = useState("");
  const [createReporterUserId, setCreateReporterUserId] = useState("");
  const [createDetails, setCreateDetails] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCategory(categoryInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [categoryInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: { reports: ReportRow[]; total: number; page: number; pageSize: number };
      }>("admin/moderation/reports", {
        params: {
          page,
          pageSize,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(category ? { category } : {}),
          ...(q ? { q } : {}),
        },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setRows(body.data.reports);
      setTotal(body.data.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, category, q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function patchStatus(id: number, status: string) {
    setSavingId(id);
    setError(null);
    try {
      await adminApi.patch(`admin/moderation/reports/${id}`, { status });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  async function saveNote(id: number) {
    const adminNote = noteDrafts[id] ?? "";
    setSavingId(id);
    setError(null);
    try {
      await adminApi.patch(`admin/moderation/reports/${id}`, { adminNote });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        category: createCategory.trim(),
        details: createDetails.trim() || undefined,
      };
      if (createTargetUserId.trim()) payload.targetUserId = Number(createTargetUserId.trim());
      if (createReporterUserId.trim()) payload.reporterUserId = Number(createReporterUserId.trim());
      await adminApi.post("admin/moderation/reports", payload);
      setCreateOpen(false);
      setCreateCategory("");
      setCreateTargetUserId("");
      setCreateReporterUserId("");
      setCreateDetails("");
      setPage(1);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Moderation</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-3xl">
        Reports queue backed by <code className="text-slate-500">moderation_reports</code>. Use{" "}
        <strong>File report</strong> for manual intake; in-game reporting can POST the same shape later with user auth.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s === "" ? "All" : s}
              </option>
            ))}
          </select>
        </label>
        <div className="w-40">
          <label htmlFor="mod-cat" className="block text-xs text-slate-500 mb-1">
            Category
          </label>
          <input
            id="mod-cat"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            placeholder="exact match"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <label htmlFor="mod-q" className="block text-xs text-slate-500 mb-1">
            Search
          </label>
          <input
            id="mod-q"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Id, details, admin note…"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((o) => !o)}
          className="rounded-lg bg-emerald-900/40 border border-emerald-700/50 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-900/60"
        >
          {createOpen ? "Close form" : "File report"}
        </button>
      </div>

      {createOpen && (
        <form
          onSubmit={submitCreate}
          className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-3 max-w-xl"
        >
          <p className="text-sm text-slate-400">Required: category. Optional: reporter / target user ids and details.</p>
          {createError && <p className="text-sm text-red-400">{createError}</p>}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Category *</label>
            <input
              required
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              placeholder="e.g. cheating, harassment"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Target user id</label>
              <input
                type="number"
                min={1}
                value={createTargetUserId}
                onChange={(e) => setCreateTargetUserId(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Reporter user id</label>
              <input
                type="number"
                min={1}
                value={createReporterUserId}
                onChange={(e) => setCreateReporterUserId(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Details</label>
            <textarea
              value={createDetails}
              onChange={(e) => setCreateDetails(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 disabled:opacity-50"
          >
            {creating ? "Saving…" : "Create report"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Id</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Reporter</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  <Loader2 className="inline w-5 h-5 animate-spin mr-2 align-middle" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No reports match filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-slate-900/40">
                    <td className="px-3 py-2 text-slate-300 font-mono">{r.id}</td>
                    <td className="px-3 py-2 text-slate-200">{r.category}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.targetUserId != null ? (
                        <Link
                          href={`/admin/players/${r.targetUserId}`}
                          className="text-emerald-400 hover:underline"
                        >
                          {r.targetUsername ?? `#${r.targetUserId}`}
                        </Link>
                      ) : (
                        <span className="text-slate-500">
                          {r.targetType}
                          {r.targetRef ? ` · ${r.targetRef}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {r.reporterUserId != null ? (
                        <Link href={`/admin/players/${r.reporterUserId}`} className="hover:text-emerald-400">
                          {r.reporterUsername ?? `#${r.reporterUserId}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "open"
                            ? "text-amber-300"
                            : r.status === "reviewing"
                              ? "text-sky-300"
                              : "text-slate-400"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                          className="text-xs rounded bg-slate-800 px-2 py-1 text-slate-300"
                        >
                          {expandedId === r.id ? "Hide" : "Details"}
                        </button>
                        {r.status !== "reviewing" && (
                          <button
                            type="button"
                            disabled={savingId === r.id}
                            onClick={() => patchStatus(r.id, "reviewing")}
                            className="text-xs rounded bg-slate-800 px-2 py-1 text-slate-300 disabled:opacity-50"
                          >
                            Review
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={savingId === r.id}
                          onClick={() => patchStatus(r.id, "resolved")}
                          className="text-xs rounded bg-emerald-950/60 px-2 py-1 text-emerald-300 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={savingId === r.id}
                          onClick={() => patchStatus(r.id, "dismissed")}
                          className="text-xs rounded bg-slate-800 px-2 py-1 text-slate-400 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          disabled={savingId === r.id}
                          onClick={() => patchStatus(r.id, "open")}
                          className="text-xs rounded bg-slate-800 px-2 py-1 text-amber-200/80 disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="bg-slate-950/50">
                      <td colSpan={7} className="px-3 py-3 text-slate-300 space-y-2">
                        <div>
                          <span className="text-xs text-slate-500">Details</span>
                          <p className="text-sm whitespace-pre-wrap mt-0.5">{r.details || "—"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Admin note</span>
                          <textarea
                            value={noteDrafts[r.id] ?? r.adminNote ?? ""}
                            onChange={(e) =>
                              setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                            }
                            rows={2}
                            className="mt-1 w-full max-w-2xl rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
                            placeholder="Internal note…"
                          />
                          <button
                            type="button"
                            disabled={savingId === r.id}
                            onClick={() => saveNote(r.id)}
                            className="mt-1 text-xs rounded bg-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-50"
                          >
                            Save note
                          </button>
                        </div>
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
          {total} report{total === 1 ? "" : "s"} · page {page} / {totalPages}
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
