"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

type ChainSnap = {
  chain: string;
  chainId: number;
  isConfigured: boolean;
  hasRpcUrl: boolean;
  hasTycoonContractAddress: boolean;
  hasBackendGameControllerKey: boolean;
  hasTournamentEscrowAddress: boolean;
  hasUsdcAddress: boolean;
  hasUserRegistryAddress: boolean;
  hasGameFaucetAddress: boolean;
};

type SummaryData = {
  runtime: { nodeEnv: string; port: number; skipRedis: boolean };
  maintenance?: { enabled: boolean };
  app: { defaultAppChain: string; anyEvmChainConfigured: boolean; starknetConfigured: boolean };
  adminApiSecurity?: {
    ipAllowlistEnabled: boolean;
    rateLimit: { windowMs: number; maxRequestsPerWindow: number };
  };
  integrations: Record<string, boolean>;
  evmChains: ChainSnap[];
  note: string;
};

const INTEGRATION_LABELS: Record<string, string> = {
  tyAdminSecretSet: "TYCOON_ADMIN_SECRET",
  shopAdminSecretSet: "SHOP_ADMIN_SECRET",
  analyticsApiKeySet: "ANALYTICS_API_KEY",
  sentryDsnSet: "SENTRY_DSN",
  privyAppIdSet: "PRIVY_APP_ID",
  privyAppSecretSet: "PRIVY_APP_SECRET",
};

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
        on
          ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/50"
          : "bg-slate-900 text-slate-500 border-slate-800"
      }`}
    >
      {label}: {on ? "yes" : "no"}
    </span>
  );
}

export default function AdminSettingsPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainBusy, setMainBusy] = useState(false);
  const [mainMsg, setMainMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: body } = await adminApi.get<{ success: boolean; data?: SummaryData }>("admin/settings/summary");
        if (cancelled) return;
        if (!body?.success || !body.data) {
          setError("Bad response");
          return;
        }
        setData(body.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">System settings</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Operator snapshot: integration flags and chain readiness. Secrets are never returned. Maintenance mode is
        stored in <code className="text-slate-600">platform_settings</code> and blocks most public <code className="text-slate-600">/api/*</code> routes
        (admin and auth stay available).
      </p>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </p>
      )}

      {data && !loading && (
        <div className="mt-8 space-y-8">
          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 max-w-xl">
            <h2 className="text-sm font-semibold text-slate-200 mb-2">Maintenance mode</h2>
            <p className="text-xs text-slate-500 mb-3">
              When enabled, clients get HTTP 503 on most API routes until you disable it here.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                disabled={mainBusy}
                onClick={async () => {
                  setMainBusy(true);
                  setMainMsg(null);
                  const next = !data.maintenance?.enabled;
                  try {
                    await adminApi.patch("admin/settings/maintenance", { enabled: next });
                    const { data: body } = await adminApi.get<{ success: boolean; data?: SummaryData }>(
                      "admin/settings/summary"
                    );
                    if (body?.success && body.data) setData(body.data);
                    setMainMsg(next ? "Maintenance is ON." : "Maintenance is OFF.");
                  } catch (e) {
                    setMainMsg(e instanceof ApiError ? e.message : "Update failed (run DB migrations?)");
                  } finally {
                    setMainBusy(false);
                  }
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-40 ${
                  data.maintenance?.enabled
                    ? "bg-amber-950/50 border-amber-800 text-amber-200 hover:bg-amber-900/40"
                    : "bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {data.maintenance?.enabled ? "Turn maintenance OFF" : "Turn maintenance ON"}
              </button>
              <span className="text-xs text-slate-500">
                Current:{" "}
                <strong className={data.maintenance?.enabled ? "text-amber-300" : "text-emerald-400/90"}>
                  {data.maintenance?.enabled ? "ON" : "OFF"}
                </strong>
              </span>
            </div>
            {mainMsg && (
              <p
                className={`text-xs mt-2 ${mainMsg.includes("failed") || mainMsg.includes("403") || mainMsg.includes("401") ? "text-red-400" : "text-emerald-400/90"}`}
              >
                {mainMsg}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Admin API security</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <Flag
                on={Boolean(data.adminApiSecurity?.ipAllowlistEnabled)}
                label="Admin IP allowlist active"
              />
              <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">
                Admin rate limit:{" "}
                <strong className="text-slate-200 tabular-nums">
                  {data.adminApiSecurity?.rateLimit?.maxRequestsPerWindow ?? 200}
                </strong>{" "}
                req /{" "}
                <strong className="text-slate-200 tabular-nums">
                  {(data.adminApiSecurity?.rateLimit?.windowMs ?? 60_000) / 1000}s
                </strong>
              </span>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Runtime</h2>
            <dl className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                <dt className="text-slate-500 text-xs">NODE_ENV</dt>
                <dd className="text-slate-200 font-mono">{data.runtime.nodeEnv}</dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                <dt className="text-slate-500 text-xs">PORT</dt>
                <dd className="text-slate-200 font-mono tabular-nums">{data.runtime.port}</dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                <dt className="text-slate-500 text-xs">SKIP_REDIS</dt>
                <dd className="text-slate-200">{data.runtime.skipRedis ? "true" : "false"}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">App</h2>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
                Default chain: <strong className="text-cyan-200/90">{data.app.defaultAppChain}</strong>
              </span>
              <Flag on={data.app.anyEvmChainConfigured} label="Any EVM chain ready" />
              <Flag on={data.app.starknetConfigured} label="Starknet configured" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Integrations (set?)</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.integrations).map(([k, v]) => (
                <Flag key={k} on={v} label={INTEGRATION_LABELS[k] ?? k} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">EVM chains</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left min-w-[640px]">
                <thead className="bg-slate-900/90 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Chain</th>
                    <th className="px-3 py-2 font-medium">Chain ID</th>
                    <th className="px-3 py-2 font-medium">Ready</th>
                    <th className="px-3 py-2 font-medium">RPC</th>
                    <th className="px-3 py-2 font-medium">Tycoon</th>
                    <th className="px-3 py-2 font-medium">Controller key</th>
                    <th className="px-3 py-2 font-medium">Escrow</th>
                    <th className="px-3 py-2 font-medium">USDC</th>
                    <th className="px-3 py-2 font-medium">Registry</th>
                    <th className="px-3 py-2 font-medium">Faucet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-400">
                  {data.evmChains.map((c) => (
                    <tr key={c.chain}>
                      <td className="px-3 py-2 font-medium text-slate-300">{c.chain}</td>
                      <td className="px-3 py-2 tabular-nums">{c.chainId}</td>
                      <td className="px-3 py-2">{c.isConfigured ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{c.hasRpcUrl ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{c.hasTycoonContractAddress ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{c.hasBackendGameControllerKey ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{c.hasTournamentEscrowAddress ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{c.hasUsdcAddress ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{c.hasUserRegistryAddress ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{c.hasGameFaucetAddress ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-slate-600">{data.note}</p>
        </div>
      )}
    </div>
  );
}
