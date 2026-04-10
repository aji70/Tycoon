"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";

const POSITIONS = ["bottom", "left", "top", "right"] as const;

type PropRow = Record<string, unknown>;

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export default function AdminPropertyEditPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [ownershipRows, setOwnershipRows] = useState(0);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [groupId, setGroupId] = useState(0);
  const [position, setPosition] = useState<string>("bottom");
  const [gridRow, setGridRow] = useState(0);
  const [gridCol, setGridCol] = useState(0);
  const [price, setPrice] = useState(0);
  const [rentSite, setRentSite] = useState(0);
  const [rent1, setRent1] = useState(0);
  const [rent2, setRent2] = useState(0);
  const [rent3, setRent3] = useState(0);
  const [rent4, setRent4] = useState(0);
  const [rentHotel, setRentHotel] = useState(0);
  const [costHouse, setCostHouse] = useState(0);
  const [isMortgaged, setIsMortgaged] = useState(false);
  const [color, setColor] = useState("#FFFFFF");
  const [icon, setIcon] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: body } = await adminApi.get<{
          success: boolean;
          data?: { property: PropRow; ownershipRows: number };
        }>(`admin/properties/${id}`);
        if (cancelled) return;
        if (!body?.success || !body.data?.property) {
          setLoadError("Not found or bad response");
          return;
        }
        const p = body.data.property;
        setOwnershipRows(body.data.ownershipRows);
        setName(String(p.name ?? ""));
        setType(String(p.type ?? ""));
        setGroupId(num(p.group_id));
        setPosition(POSITIONS.includes(p.position as (typeof POSITIONS)[number]) ? String(p.position) : "bottom");
        setGridRow(num(p.grid_row));
        setGridCol(num(p.grid_col));
        setPrice(num(p.price));
        setRentSite(num(p.rent_site_only));
        setRent1(num(p.rent_one_house));
        setRent2(num(p.rent_two_houses));
        setRent3(num(p.rent_three_houses));
        setRent4(num(p.rent_four_houses));
        setRentHotel(num(p.rent_hotel));
        setCostHouse(num(p.cost_of_house));
        setIsMortgaged(Boolean(p.is_mortgaged));
        setColor(String(p.color ?? "#FFFFFF"));
        setIcon(p.icon != null ? String(p.icon) : "");
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setDone(null);
    try {
      const payload = {
        name,
        type,
        group_id: groupId,
        position,
        grid_row: gridRow,
        grid_col: gridCol,
        price,
        rent_site_only: rentSite,
        rent_one_house: rent1,
        rent_two_houses: rent2,
        rent_three_houses: rent3,
        rent_four_houses: rent4,
        rent_hotel: rentHotel,
        cost_of_house: costHouse,
        is_mortgaged: isMortgaged,
        color,
        icon: icon.trim() === "" ? null : icon.trim(),
      };
      const { data: body } = await adminApi.patch<{
        success: boolean;
        data?: { ownershipRows: number };
      }>(`admin/properties/${id}`, payload);
      if (!body?.success) {
        setSaveError("Save failed");
        return;
      }
      if (body.data?.ownershipRows != null) setOwnershipRows(body.data.ownershipRows);
      setDone("Saved. Public API property cache was invalidated.");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/admin/properties" className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" />
        All properties
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {loadError && !loading && (
        <p className="text-red-400 text-sm border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-lg mb-4">
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <>
          <h1 className="text-2xl font-semibold text-slate-100">
            Property #{id}
            <span className="block text-sm font-normal text-slate-500 mt-1">{ownershipRows} ownership row(s) in games</span>
          </h1>

          <form onSubmit={onSave} className="mt-8 max-w-xl space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Type</span>
                <input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Group id</span>
                <input
                  type="number"
                  value={groupId}
                  onChange={(e) => setGroupId(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 tabular-nums"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Board side</span>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Grid row</span>
                <input
                  type="number"
                  value={gridRow}
                  onChange={(e) => setGridRow(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Grid col</span>
                <input
                  type="number"
                  value={gridCol}
                  onChange={(e) => setGridCol(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Economics</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ["Price", price, setPrice],
                  ["Rent (site only)", rentSite, setRentSite],
                  ["Rent 1 house", rent1, setRent1],
                  ["Rent 2 houses", rent2, setRent2],
                  ["Rent 3 houses", rent3, setRent3],
                  ["Rent 4 houses", rent4, setRent4],
                  ["Rent hotel", rentHotel, setRentHotel],
                  ["Cost of house", costHouse, setCostHouse],
                ].map(([label, val, set]) => (
                  <label key={String(label)} className="block text-xs">
                    <span className="text-slate-500">{label}</span>
                    <input
                      type="number"
                      value={val as number}
                      onChange={(e) => (set as (n: number) => void)(parseInt(e.target.value, 10) || 0)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-slate-200 tabular-nums"
                    />
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={isMortgaged}
                onChange={(e) => setIsMortgaged(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900"
              />
              Default / template mortgaged flag
            </label>

            <label className="block text-sm">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Color</span>
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                maxLength={10}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 font-mono text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Icon URL</span>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
              />
            </label>

            {saveError && (
              <p className="text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2">{saveError}</p>
            )}
            {done && <p className="text-sm text-emerald-400/90">{done}</p>}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
