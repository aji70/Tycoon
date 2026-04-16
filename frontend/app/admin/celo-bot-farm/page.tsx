"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS } from "@/lib/api";
import { Loader2 } from "lucide-react";

type BotRow = {
  address: string;
  registered: boolean;
  balanceCelo: string;
  suggestedUsername: string;
};

type StatusPayload = {
  enabled: boolean;
  chain: string;
  contractAddress: string;
  distributorAddress: string | null;
  botCount: number;
  bots: BotRow[];
};

export default function AdminCeloBotFarmPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string>("");

  const [delayMs, setDelayMs] = useState(1500);
  const [gamesPerWallet, setGamesPerWallet] = useState(1);
  const [startingBalance, setStartingBalance] = useState(1500);
  const [celoPerWallet, setCeloPerWallet] = useState("0.5");
  const [distributorJson, setDistributorJson] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{ success: boolean; data?: StatusPayload; message?: string }>(
        "admin/celo-bot-farm/status"
      );
      if (!body?.success || !body.data) {
        setError(body?.message || "Unexpected response");
        setStatus(null);
        return;
      }
      setStatus(body.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runRegister() {
    setBusy("register");
    setLog("");
    try {
      const { data: body } = await adminApi.post<{ success: boolean; data?: { results: unknown[] }; message?: string }>(
        "admin/celo-bot-farm/register",
        { delayMs },
        { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
      );
      if (!body?.success) throw new Error(body?.message || "Failed");
      setLog(JSON.stringify(body.data, null, 2));
      await load();
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runCreateGames() {
    setBusy("games");
    setLog("");
    try {
      const { data: body } = await adminApi.post<{
        success: boolean;
        data?: unknown;
        message?: string;
      }>(
        "admin/celo-bot-farm/create-ai-games",
        {
          delayMs,
          gamesPerWallet,
          startingBalance,
          gameType: "PRIVATE",
          playerSymbol: "hat",
          numberOfAI: 1,
        },
        { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
      );
      if (!body?.success) throw new Error(body?.message || "Failed");
      setLog(JSON.stringify(body.data, null, 2));
      await load();
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function buildDistributorPayload() {
    setBusy("payload");
    setLog("");
    try {
      const { data: body } = await adminApi.post<{
        success: boolean;
        data?: Record<string, unknown>;
        message?: string;
      }>("admin/celo-bot-farm/distributor-payload", { celoPerWallet });
      if (!body?.success || !body.data) throw new Error(body?.message || "Failed");
      setDistributorJson(JSON.stringify(body.data, null, 2));
      setLog("Payload ready — send a tx to `to` with `valueWei` wei and `data` from the JSON below (e.g. cast send or your admin wallet).");
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Admin
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-white mb-1">Celo bot farm (operator)</h1>
      <p className="text-sm text-slate-400 mb-6">
        On-chain only on <strong className="text-slate-300">CELO</strong>. Enable with{" "}
        <code className="text-amber-200/90">CELO_BOT_FARM_ENABLED=true</code> and{" "}
        <code className="text-amber-200/90">CELO_BOT_FARM_PRIVATE_KEYS</code> (comma-separated) on the backend. Optional{" "}
        <code className="text-amber-200/90">CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS</code> for batch CELO funding via{" "}
        <code className="text-amber-200/90">CeloBatchNativeDistributor</code>.
      </p>

      <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-4 py-3 text-amber-100/90 text-sm mb-6">
        Mainnet CELO spend and many games affect your product metrics. Keys must never be placed in the browser; they live
        only in server environment variables.
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading status…
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {status && (
        <>
          <div className="grid gap-2 text-sm text-slate-300 mb-4">
            <div>
              Farm enabled (env):{" "}
              <span className={status.enabled ? "text-emerald-400" : "text-amber-300"}>{String(status.enabled)}</span>
            </div>
            <div>
              Tycoon contract: <code className="text-xs text-slate-200">{status.contractAddress}</code>
            </div>
            {status.distributorAddress && (
              <div>
                Distributor: <code className="text-xs text-slate-200">{status.distributorAddress}</code>
              </div>
            )}
            <div>Configured bots: {status.botCount}</div>
          </div>

          <div className="flex flex-wrap gap-3 items-end mb-6">
            <label className="text-xs text-slate-400 block">
              Delay between txs (ms)
              <input
                type="number"
                min={0}
                step={100}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value) || 0)}
                className="mt-1 block w-36 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400 block">
              AI games per wallet
              <input
                type="number"
                min={1}
                max={50}
                value={gamesPerWallet}
                onChange={(e) => setGamesPerWallet(Number(e.target.value) || 1)}
                className="mt-1 block w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400 block">
              Starting balance (in-game)
              <input
                type="number"
                min={1}
                value={startingBalance}
                onChange={(e) => setStartingBalance(Number(e.target.value) || 1500)}
                className="mt-1 block w-32 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <button
              type="button"
              disabled={!!busy}
              onClick={runRegister}
              className="rounded-lg bg-cyan-900/80 hover:bg-cyan-800 px-4 py-2 text-sm font-medium text-cyan-100 border border-cyan-800 disabled:opacity-50"
            >
              {busy === "register" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Register all (on-chain)
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={runCreateGames}
              className="rounded-lg bg-violet-900/80 hover:bg-violet-800 px-4 py-2 text-sm font-medium text-violet-100 border border-violet-800 disabled:opacity-50"
            >
              {busy === "games" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Create AI games
            </button>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 mb-6">
            <h2 className="text-sm font-medium text-slate-200 mb-2">Batch fund CELO (calldata)</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-xs text-slate-400 block">
                CELO per wallet
                <input
                  type="text"
                  value={celoPerWallet}
                  onChange={(e) => setCeloPerWallet(e.target.value)}
                  className="mt-1 block w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <button
                type="button"
                disabled={!!busy}
                onClick={buildDistributorPayload}
                className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-slate-100 border border-slate-600 disabled:opacity-50"
              >
                {busy === "payload" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Build payload
              </button>
            </div>
            {distributorJson && (
              <pre className="mt-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">{distributorJson}</pre>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Registered</th>
                  <th className="px-3 py-2">CELO</th>
                  <th className="px-3 py-2">Username used</th>
                </tr>
              </thead>
              <tbody>
                {status.bots.map((b) => (
                  <tr key={b.address} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{b.address}</td>
                    <td className="px-3 py-2">{b.registered ? "yes" : "no"}</td>
                    <td className="px-3 py-2">{b.balanceCelo}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{b.suggestedUsername}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {log && (
            <pre className="mt-4 p-3 rounded-lg bg-black/40 border border-slate-800 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
              {log}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
