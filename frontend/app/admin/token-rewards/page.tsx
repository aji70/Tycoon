"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2, ExternalLink } from "lucide-react";

const CHAINS = ["CELO", "BASE", "POLYGON"] as const;

const GRANT_TIMEOUT_MS = 180_000;

type OverviewData = {
  totals: { totalEarnedSum: number; totalWithdrawnSum: number; totalStakedSum: number };
  dailyClaim: { usersClaimedTodayUtc: number; usersWithNonZeroStreak: number };
};

type ConfigData = {
  dailyClaim: { dailyRewardTycBase: string; streakBonusTycPerDay: string; envKeys: string[] };
  note: string;
};

export default function AdminTokenRewardsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState("");
  const [tycAmount, setTycAmount] = useState("");
  const [chain, setChain] = useState<string>("CELO");
  const [reason, setReason] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantOk, setGrantOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ov, cf] = await Promise.all([
        adminApi.get<{ success: boolean; data?: OverviewData }>("admin/economy/overview"),
        adminApi.get<{ success: boolean; data?: ConfigData }>("admin/economy/config"),
      ]);
      if (!ov.data?.success || !ov.data.data) throw new Error("Overview failed");
      if (!cf.data?.success || !cf.data.data) throw new Error("Config failed");
      setOverview(ov.data.data);
      setConfig(cf.data.data);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
      setOverview(null);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onGrant(e: React.FormEvent) {
    e.preventDefault();
    setGrantBusy(true);
    setGrantError(null);
    setGrantOk(null);
    const uid = parseInt(userId, 10);
    const amt = parseFloat(tycAmount);
    if (!Number.isFinite(uid) || uid < 1) {
      setGrantError("Enter a valid user id");
      setGrantBusy(false);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setGrantError("Enter a positive TYC amount");
      setGrantBusy(false);
      return;
    }
    try {
      const { data: body } = await adminApi.post<{
        success: boolean;
        data?: { txHash?: string; tokenId?: string | null; mintTo: string; chain: string; tycAmount: number };
        error?: string;
      }>(
        "admin/economy/grant-voucher",
        { userId: uid, tycAmount: amt, chain, reason: reason.trim() || undefined },
        { timeout: GRANT_TIMEOUT_MS }
      );
      if (!body?.success || !body.data) {
        setGrantError((body as { error?: string })?.error || "Grant failed");
        return;
      }
      const d = body.data;
      setGrantOk(
        `Minted ~${d.tycAmount} TYC voucher to ${d.mintTo.slice(0, 10)}… on ${d.chain}. Tx: ${d.txHash || "—"}${d.tokenId ? ` · token ${d.tokenId}` : ""}`
      );
    } catch (e) {
      setGrantError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Grant failed");
    } finally {
      setGrantBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Token & rewards</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Economy aggregates, daily-claim env hints, and <strong>manual TYC voucher mint</strong> (same path as daily claim — backend must be minter on the reward contract).
      </p>

      <p className="mt-3">
        <Link
          href="/rewards"
          className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300"
        >
          Open full Rewards / shop admin UI
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </p>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {loadError && !loading && (
        <p className="mt-6 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {loadError}
        </p>
      )}

      {overview && config && !loading && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Σ total_earned (users)</p>
              <p className="text-xl font-semibold text-cyan-100 tabular-nums mt-1">
                {overview.totals.totalEarnedSum.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Σ total_withdrawn</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.totals.totalWithdrawnSum.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Σ total_staked</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.totals.totalStakedSum.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Daily claims today (UTC)</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.dailyClaim.usersClaimedTodayUtc.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Users with streak &gt; 0</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.dailyClaim.usersWithNonZeroStreak.toLocaleString()}
              </p>
            </div>
          </div>

          <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/30 p-4 max-w-2xl">
            <h2 className="text-sm font-semibold text-slate-200">Daily claim (env)</h2>
            <p className="text-xs text-slate-500 mt-1">{config.note}</p>
            <dl className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-500">Base TYC</dt>
                <dd className="text-slate-200 font-mono">{config.dailyClaim.dailyRewardTycBase}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Streak bonus TYC / day</dt>
                <dd className="text-slate-200 font-mono">{config.dailyClaim.streakBonusTycPerDay}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-600 mt-2 font-mono">{config.dailyClaim.envKeys.join(", ")}</p>
          </section>

          <section className="mt-8 rounded-xl border border-amber-900/40 bg-amber-950/15 p-4 max-w-xl">
            <h2 className="text-sm font-semibold text-amber-200/95">Grant TYC voucher</h2>
            <p className="text-xs text-amber-200/70 mt-1">
              Mints to the user’s smart wallet when set, else linked wallet, else primary address. Requires chain contract config and backend minter role.
            </p>
            <form onSubmit={onGrant} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">User id</span>
                <input
                  type="number"
                  min={1}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 tabular-nums"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Amount (TYC)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={tycAmount}
                  onChange={(e) => setTycAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Chain</span>
                <select
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                >
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Reason (optional)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
                />
              </label>
              {grantError && (
                <p className="text-sm text-red-400 border border-red-900/40 rounded-lg px-2 py-1.5 bg-red-950/30">
                  {grantError}
                </p>
              )}
              {grantOk && (
                <p className="text-sm text-emerald-400/90 border border-emerald-900/40 rounded-lg px-2 py-1.5 bg-emerald-950/30">
                  {grantOk}
                </p>
              )}
              <button
                type="submit"
                disabled={grantBusy}
                className="rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {grantBusy ? "Minting…" : "Mint voucher"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
