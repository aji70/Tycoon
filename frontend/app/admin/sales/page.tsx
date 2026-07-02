"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";

type Period = "all" | "day" | "week" | "month";

type CurrencySummary = {
  raw: string;
  formatted: string;
  decimals: number;
};

type SalesData = {
  chain: string;
  period: Period;
  rewardAddress: string;
  fromBlock: number;
  toBlock: number;
  summary: {
    collectiblesSold: number;
    bundlesSold: number;
    totalSales: number;
    uniqueBuyers: number;
  };
  revenueByCurrency: Record<string, CurrencySummary>;
  generatedAt: string;
  cachedUntil: string;
};

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "all", label: "All" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function periodLabel(period: Period) {
  return period === "all" ? "All time" : `Last ${period}`;
}

function formatAmount(v: string) {
  const num = Number(v);
  if (!Number.isFinite(num)) return v;
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function AdminSalesPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false, selectedPeriod: Period = period) => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{ success: boolean; data?: SalesData }>("admin/sales/reward", {
        params: {
          period: selectedPeriod,
          chain: "CELO",
          ...(refresh ? { refresh: "true" } : {}),
        },
        timeout: 120_000,
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        setData(null);
        return;
      }
      setData(body.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load sales");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load(false, period);
  }, [load]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Reward Sales</h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            Historical shop sales reconstructed from reward-contract purchase events on Celo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => {
              const active = period === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={loading}
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    active
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
                      : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500"
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true, period)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading reward sales…
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Collectibles sold</p>
              <p className="text-2xl font-semibold text-cyan-100 tabular-nums mt-1">
                {data.summary.collectiblesSold.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Bundles sold</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">
                {data.summary.bundlesSold.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">{periodLabel(data.period)} sales</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">
                {data.summary.totalSales.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Unique buyers</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">
                {data.summary.uniqueBuyers.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(data.revenueByCurrency).map(([symbol, value]) => (
              <div key={symbol} className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3">
                <p className="text-xs uppercase text-slate-500">{symbol} revenue</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-200 tabular-nums">
                  {formatAmount(value.formatted)}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-600">
            Range: {periodLabel(data.period)} · Blocks {data.fromBlock.toLocaleString()}-{data.toBlock.toLocaleString()} ·
            Reward {data.rewardAddress} · Generated {data.generatedAt} · Cache until {data.cachedUntil}
          </p>
        </>
      )}
    </div>
  );
}
