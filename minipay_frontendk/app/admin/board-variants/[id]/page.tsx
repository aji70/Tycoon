"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";

type SquareRow = {
  property_id: number;
  type: string;
  catalog_name: string;
  display_name: string;
  uses_override?: boolean;
};

type VariantMeta = { id: string; name: string; region: string; description?: string | null };

export default function AdminBoardVariantEditPage({ params }: { params: { id: string } }) {
  const variantId = decodeURIComponent(params.id);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [variant, setVariant] = useState<VariantMeta | null>(null);
  const [squares, setSquares] = useState<SquareRow[]>([]);
  const [namesById, setNamesById] = useState<Record<number, string>>({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: { variant: VariantMeta; squares: SquareRow[] };
      }>(`admin/board-variants/${encodeURIComponent(variantId)}/squares`);
      if (!body?.success || !body.data?.squares || !body.data.variant) {
        setLoadError("Not found or invalid response");
        return;
      }
      setVariant(body.data.variant);
      setSquares(body.data.squares);
      const nm: Record<number, string> = {};
      for (const s of body.data.squares) nm[s.property_id] = s.display_name;
      setNamesById(nm);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
      setSquares([]);
      setVariant(null);
    } finally {
      setLoading(false);
    }
  }, [variantId]);

  useEffect(() => {
    load();
  }, [load]);

  const payloadSquares = useMemo(() => {
    return squares.map((s) => ({
      property_id: s.property_id,
      display_name: namesById[s.property_id] ?? s.catalog_name,
    }));
  }, [squares, namesById]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setDone(null);
    try {
      const { data: body } = await adminApi.put<{ success: boolean; data?: { overrideRows?: number } }>(
        `admin/board-variants/${encodeURIComponent(variantId)}/squares`,
        { squares: payloadSquares },
      );
      if (!body?.success) {
        setSaveError("Save failed");
        return;
      }
      setDone(`Saved. ${body.data?.overrideRows ?? "?"} override row(s) stored (matching catalog names omit overrides).`);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function resetRow(pid: number, catalog: string) {
    setNamesById((prev) => ({ ...prev, [pid]: catalog }));
  }

  if (variantId === "default") {
    return (
      <div>
        <Link href="/admin/board-variants" className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Board themes
        </Link>
        <p className="text-slate-300 max-w-lg">
          The <strong>default</strong> theme uses catalog names from{" "}
          <Link href="/admin/properties" className="text-cyan-400 hover:text-cyan-300">
            Properties
          </Link>
          . Create or edit other themes here instead.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/board-variants" className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Board themes
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {loadError && !loading && (
        <p className="text-red-400 text-sm border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-lg">{loadError}</p>
      )}

      {!loading && !loadError && variant && (
        <>
          <h1 className="text-2xl font-semibold text-slate-100">
            {variant.name}
            <span className="block text-sm font-normal text-slate-500 mt-1 font-mono">{variant.id}</span>
          </h1>
          {variant.description ? <p className="mt-2 text-sm text-slate-400 max-w-2xl">{variant.description}</p> : null}

          <form onSubmit={onSave} className="mt-8 space-y-4">
            <p className="text-xs text-slate-500 max-w-2xl">
              Overrides are stored only where the label differs from the catalog name (economics stay on each property row).
            </p>

            <div className="rounded-xl border border-slate-800 overflow-hidden max-w-4xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-left text-slate-400 uppercase text-[10px] tracking-wide">
                  <tr>
                    <th className="px-3 py-2 w-12">#</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Catalog name</th>
                    <th className="px-3 py-2">Theme label</th>
                    <th className="px-3 py-2 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {squares.map((s) => (
                    <tr key={s.property_id} className="bg-slate-950/30">
                      <td className="px-3 py-2 tabular-nums text-slate-500">{s.property_id}</td>
                      <td className="px-3 py-2 text-slate-400">{s.type}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{s.catalog_name}</td>
                      <td className="px-3 py-2">
                        <input
                          value={namesById[s.property_id] ?? ""}
                          onChange={(e) => setNamesById((prev) => ({ ...prev, [s.property_id]: e.target.value }))}
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-slate-200 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => resetRow(s.property_id, s.catalog_name)}
                          className="text-[11px] text-cyan-500 hover:text-cyan-400"
                        >
                          Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-white text-sm font-medium"
              >
                {saving ? "Saving…" : "Save theme labels"}
              </button>
              {done && <span className="text-sm text-emerald-400">{done}</span>}
              {saveError && <span className="text-sm text-red-400">{saveError}</span>}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
