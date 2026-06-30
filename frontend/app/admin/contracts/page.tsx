"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

type ContractRow = {
  label: string;
  address: string;
  chain: string;
  chainId: number;
  category: string;
  txCount: number | null;
  tokenTransfers: number | null;
  explorerUrl: string;
  error: string | null;
};

type TxStatsData = {
  contracts: ContractRow[];
  summary: { configured: number; withCounts: number; totalTxns: number };
  cachedUntil: string;
  generatedAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core",
  token: "Tokens",
  infrastructure: "Infrastructure",
  erc8004: "ERC-8004",
};

function shortAddr(a: string) {
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

function formatCount(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default function AdminContractsPage() {
  const [data, setData] = useState<TxStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{ success: boolean; data?: TxStatsData }>("admin/contracts/tx-stats", {
        params: refresh ? { refresh: "true" } : {},
        timeout: 120_000,
      });
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        return;
      }
      setData(body.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Contract activity</h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            On-chain transaction counts for every address configured in backend env (Tycoon, reward, escrow, tokens,
            registries, etc.). Data comes from Blockscout counters and is cached ~10 minutes.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Querying explorers…
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Configured addresses</p>
              <p className="text-2xl font-semibold text-cyan-100 tabular-nums mt-1">{data.summary.configured}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">With tx counts</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">{data.summary.withCounts}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Sum of tx counts</p>
              <p className="text-2xl font-semibold text-slate-200 tabular-nums mt-1">
                {data.summary.totalTxns.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">Not deduplicated across contracts</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-600">
            Generated {data.generatedAt} · cache until {data.cachedUntil}
          </p>

          <div className="mt-6 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[720px]">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Contract</th>
                    <th className="px-4 py-3 font-medium">Chain</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium text-right">Transactions</th>
                    <th className="px-4 py-3 font-medium text-right">Token transfers</th>
                    <th className="px-4 py-3 font-medium text-right">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {data.contracts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No contract addresses configured in backend env.
                      </td>
                    </tr>
                  )}
                  {data.contracts.map((c) => (
                    <tr key={`${c.chainId}-${c.address}`} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <span className="text-slate-200">{c.label}</span>
                        <span className="block text-[10px] uppercase text-slate-600 mt-0.5">
                          {CATEGORY_LABELS[c.category] ?? c.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {c.chain}
                        <span className="block text-slate-600">{c.chainId}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{shortAddr(c.address)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                        {c.error ? (
                          <span className="text-red-400/90 text-xs" title={c.error}>
                            Error
                          </span>
                        ) : (
                          formatCount(c.txCount)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {formatCount(c.tokenTransfers)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={c.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
