"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { ApiResponse } from "@/types/api";

export type BoardVariantRow = {
  id: string;
  name: string;
  region: string;
  description?: string | null;
};

export function useBoardVariantOptions() {
  return useQuery({
    queryKey: ["board-variants"],
    queryFn: async (): Promise<BoardVariantRow[]> => {
      const res = await apiClient.get<ApiResponse>("/board-variants");
      const rows = res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
      return rows as BoardVariantRow[];
    },
    staleTime: 600_000,
  });
}

/** Alternate square naming themes (rent/prices unchanged). */
export function BoardVariantPicker({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const { data: rows = [], isLoading } = useBoardVariantOptions();

  return (
    <label className={`block ${className}`}>
      <span className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-2 block">
        Board theme
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || rows.length === 0}
        className="w-full rounded-lg border border-cyan-500/40 bg-black/40 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      >
        {rows.length === 0 ? (
          <option value="default">Tycoon (default)</option>
        ) : (
          rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.region}
            </option>
          ))
        )}
      </select>
      <p className="text-[11px] text-white/45 mt-1.5 leading-snug">
        Names only — rents, prices, and house costs stay the same.
      </p>
    </label>
  );
}
