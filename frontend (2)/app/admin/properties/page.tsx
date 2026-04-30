"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type PropertyRow = Record<string, unknown> & {
  id: number;
  name: string;
  type: string;
  price: number;
  rent_site_only?: number;
  ownershipRows: number;
};

export default function AdminPropertiesPage() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [rows, setRows] = useState<PropertyRow[]>([]);
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
        data?: { properties: PropertyRow[]; total: number; page: number; pageSize: number };
      }>("admin/properties", {
        params: { page, pageSize, ...(q ? { q } : {}) },
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setRows(body.data.properties);
      setTotal(body.data.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Properties</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Board template rows from <code className="text-slate-500">properties</code>.{" "}
        <strong>Ownership rows</strong> counts <code className="text-slate-500">game_properties</code> rows (any game).
        Edits invalidate the public properties Redis cache.
      </p>

      <div className="mt-4 max-w-md">
        <label htmlFor="admin-prop-search" className="block text-xs font-medium text-slate-500 mb-1">
          Search by name or id
        </label>
        <input
          id="admin-prop-search"
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-800/60"
          placeholder="e.g. Boardwalk or 39"
        />
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Id</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Base rent</th>
                <th className="px-4 py-3 font-medium text-right">Ownership rows</th>
                <th className="px-4 py-3 font-medium text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2 text-cyan-500" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No properties match.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{p.id}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{String(p.name)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{String(p.type)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">{Number(p.price ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                      {Number(p.rent_site_only ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{p.ownershipRows}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/properties/${p.id}`} className="text-cyan-400 hover:text-cyan-300 text-xs font-medium">
                        Edit
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 disabled:opacity-40 disabled:pointer-events-none"
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 disabled:opacity-40 disabled:pointer-events-none"
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
