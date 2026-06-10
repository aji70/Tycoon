"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

type VariantRow = {
  id: string;
  name: string;
  region: string;
  active?: boolean | number;
};

export default function AdminBoardVariantsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: { variants: VariantRow[] };
      }>("admin/board-variants");
      if (!body?.success || !body.data?.variants) {
        setError("Unexpected response");
        return;
      }
      setVariants(body.data.variants);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setVariants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Board themes</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Themes only change square <strong>labels</strong> shown on the board. Rents, prices, and building rules come from{" "}
        <Link href="/admin/properties" className="text-cyan-400 hover:text-cyan-300">
          Properties
        </Link>{" "}
        (canonical catalog). Seed scripts:{" "}
        <code className="text-slate-500 text-xs">npm run seed:board-themes</code> in{" "}
        <code className="text-slate-500 text-xs">backend/</code>.
      </p>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 text-red-400 text-sm border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-lg">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="mt-8 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-slate-400 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Theme id</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {variants.map((v) => (
                <tr key={v.id} className="bg-slate-950/40 hover:bg-slate-900/60">
                  <td className="px-4 py-3 font-mono text-cyan-300/90">{v.id}</td>
                  <td className="px-4 py-3 text-slate-200">{v.name}</td>
                  <td className="px-4 py-3 text-slate-400">{v.region}</td>
                  <td className="px-4 py-3 text-slate-400">{v.active === false || v.active === 0 ? "No" : "Yes"}</td>
                  <td className="px-4 py-3 text-right">
                    {v.id === "default" ? (
                      <Link href="/admin/properties" className="text-cyan-400 hover:text-cyan-300 text-xs">
                        Edit catalog names →
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/board-variants/${encodeURIComponent(v.id)}`}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        Edit labels
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
