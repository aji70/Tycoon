"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type QuestRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  rulesJson: unknown;
  rewardHint: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminQuestsPage() {
  const [activeFilter, setActiveFilter] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [rows, setRows] = useState<QuestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cSlug, setCSlug] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cRewardHint, setCRewardHint] = useState("");
  const [cSortOrder, setCSortOrder] = useState("0");
  const [cActive, setCActive] = useState(true);
  const [cRulesJson, setCRulesJson] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<QuestRow | null>(null);
  const [eSlug, setESlug] = useState("");
  const [eTitle, setETitle] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eRewardHint, setERewardHint] = useState("");
  const [eSortOrder, setESortOrder] = useState("0");
  const [eActive, setEActive] = useState(true);
  const [eRulesJson, setERulesJson] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        data?: { quests: QuestRow[]; total: number; page: number; pageSize: number };
      }>("admin/quests", {
        params: {
          page,
          pageSize,
          ...(activeFilter ? { active: activeFilter } : {}),
          ...(q ? { q } : {}),
        },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setRows(body.data.quests);
      setTotal(body.data.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeFilter, q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function openEdit(row: QuestRow) {
    setEditing(row);
    setESlug(row.slug);
    setETitle(row.title);
    setEDescription(row.description ?? "");
    setERewardHint(row.rewardHint ?? "");
    setESortOrder(String(row.sortOrder ?? 0));
    setEActive(row.active);
    setERulesJson(
      row.rulesJson != null ? JSON.stringify(row.rulesJson, null, 2) : ""
    );
    setEditError(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditError(null);
  }

  function parseRulesJson(raw: string): Record<string, unknown> | null | "invalid" {
    const t = raw.trim();
    if (!t) return null;
    try {
      const v = JSON.parse(t) as unknown;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
      return "invalid";
    } catch {
      return "invalid";
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const rules = parseRulesJson(cRulesJson);
    if (rules === "invalid") {
      setCreateError("Rules JSON must be a JSON object (or empty).");
      return;
    }
    setCreating(true);
    try {
      await adminApi.post("admin/quests", {
        slug: cSlug.trim(),
        title: cTitle.trim(),
        description: cDescription.trim() || undefined,
        rewardHint: cRewardHint.trim() || undefined,
        sortOrder: Number(cSortOrder) || 0,
        active: cActive,
        ...(rules ? { rulesJson: rules } : {}),
      });
      setCreateOpen(false);
      setCSlug("");
      setCTitle("");
      setCDescription("");
      setCRewardHint("");
      setCSortOrder("0");
      setCActive(true);
      setCRulesJson("");
      setPage(1);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    const rules = parseRulesJson(eRulesJson);
    if (rules === "invalid") {
      setEditError("Rules JSON must be a JSON object (or empty).");
      return;
    }
    setSaving(true);
    try {
      await adminApi.patch(`admin/quests/${editing.id}`, {
        slug: eSlug.trim(),
        title: eTitle.trim(),
        description: eDescription.trim() || null,
        rewardHint: eRewardHint.trim() || null,
        sortOrder: Number(eSortOrder) || 0,
        active: eActive,
        rulesJson: rules,
      });
      closeEdit();
      await load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!editing || !confirm(`Delete quest "${editing.title}" (${editing.slug})?`)) return;
    setDeleting(true);
    setEditError(null);
    try {
      await adminApi.delete(`admin/quests/${editing.id}`);
      closeEdit();
      await load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Quests</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-3xl">
        Definitions in <code className="text-slate-500">quest_definitions</code>. Active rows are exposed publicly as{" "}
        <code className="text-slate-500">GET /api/quests</code> (no auth); inactive quests are omitted.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <label className="block text-sm">
          <span className="text-xs text-slate-500 block mb-1">Active</span>
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">All</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
        </label>
        <div className="flex-1 min-w-[200px] max-w-md">
          <label htmlFor="quest-q" className="block text-xs text-slate-500 mb-1">
            Search
          </label>
          <input
            id="quest-q"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Id, slug, title…"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((o) => !o)}
          className="rounded-lg bg-emerald-900/40 border border-emerald-700/50 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-900/60"
        >
          {createOpen ? "Close form" : "New quest"}
        </button>
      </div>

      {createOpen && (
        <form
          onSubmit={submitCreate}
          className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-3 max-w-2xl"
        >
          <p className="text-sm text-slate-400">
            Slug: lowercase, digits, hyphens (no leading/trailing hyphen). Title is required.
          </p>
          {createError && <p className="text-sm text-red-400">{createError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Slug *</label>
              <input
                required
                value={cSlug}
                onChange={(e) => setCSlug(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200 font-mono"
                placeholder="e.g. first-win"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sort order</label>
              <input
                type="number"
                value={cSortOrder}
                onChange={(e) => setCSortOrder(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Title *</label>
            <input
              required
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Description</label>
            <textarea
              value={cDescription}
              onChange={(e) => setCDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Reward hint (display only until rewards wired)</label>
            <input
              value={cRewardHint}
              onChange={(e) => setCRewardHint(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              placeholder="e.g. 50 credits"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Rules JSON (optional object)</label>
            <textarea
              value={cRulesJson}
              onChange={(e) => setCRulesJson(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200 font-mono"
              placeholder='{"type":"play_games","count":3}'
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={cActive} onChange={(e) => setCActive(e.target.checked)} />
            Active
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 disabled:opacity-50"
          >
            {creating ? "Saving…" : "Create quest"}
          </button>
        </form>
      )}

      {editing && (
        <form
          onSubmit={submitEdit}
          className="mt-4 rounded-xl border border-amber-900/40 bg-slate-900/70 p-4 space-y-3 max-w-2xl"
        >
          <div className="flex justify-between items-center gap-2">
            <h2 className="text-lg font-medium text-slate-100">Edit quest #{editing.id}</h2>
            <button
              type="button"
              onClick={closeEdit}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
          {editError && <p className="text-sm text-red-400">{editError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Slug</label>
              <input
                value={eSlug}
                onChange={(e) => setESlug(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sort order</label>
              <input
                type="number"
                value={eSortOrder}
                onChange={(e) => setESortOrder(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Title</label>
            <input
              required
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Description</label>
            <textarea
              value={eDescription}
              onChange={(e) => setEDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Reward hint</label>
            <input
              value={eRewardHint}
              onChange={(e) => setERewardHint(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Rules JSON</label>
            <textarea
              value={eRulesJson}
              onChange={(e) => setERulesJson(e.target.value)}
              rows={6}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} />
            Active
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={confirmDelete}
              className="rounded-lg bg-red-950/60 border border-red-900/50 px-4 py-2 text-sm text-red-200 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
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
                  No quests yet. Run the migration, then create one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/40">
                  <td className="px-3 py-2 text-slate-400 font-mono">{r.sortOrder}</td>
                  <td className="px-3 py-2 text-emerald-300/90 font-mono text-xs">{r.slug}</td>
                  <td className="px-3 py-2 text-slate-200">{r.title}</td>
                  <td className="px-3 py-2">{r.active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="text-emerald-400 hover:underline text-xs"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          Page {page} / {totalPages} · {total} total
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
