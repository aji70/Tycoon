"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { adminApi } from "@/lib/adminApi";
import { ApiError, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS } from "@/lib/api";
import { Loader2 } from "lucide-react";

const CELO_MAINNET_CHAIN_ID = 42220;

const DISTRIBUTOR_ABI = [
  {
    type: "function",
    name: "distribute",
    stateMutability: "payable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

type DistributorFundPayload = {
  to: string;
  data: string;
  valueWei: string;
  valueCelo: string;
  recipients: string[];
  amountsWei: string[];
  recipientCount?: number;
  celoPerWallet?: string;
};

type WalletRow = {
  address: string;
  registered: boolean;
  balanceWei: string;
  balanceCelo: string;
  suggestedUsername: string;
};

type StatusPayload = {
  enabled: boolean;
  chain: string;
  contractAddress: string;
  distributorAddress: string | null;
  /** TYC preferred for light ping; USDC only if TYC cannot be resolved */
  lightPingTokenAddress?: string | null;
  lightPingTokenSymbol?: "TYC" | "USDC" | null;
  /** "env" = CELO_TYC_TOKEN_ADDRESS / TYCOON_CELO_TYC; "onchain" = rewardSystem().tycToken() */
  lightPingTycResolvedFrom?: "env" | "onchain" | null;
  walletCount: number;
  wallets: WalletRow[];
};

export default function AdminCeloOperatorsPage() {
  const { isConnected, address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync, isPending: isFundWalletPending, data: fundTxHash, error: fundWriteError } =
    useWriteContract();
  const { isLoading: isFundConfirming, isSuccess: fundTxSuccess } = useWaitForTransactionReceipt({
    hash: fundTxHash,
  });

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string>("");

  const [delayMs, setDelayMs] = useState(1500);
  const [approvalsPerWallet, setApprovalsPerWallet] = useState(1);
  const [parallelLightPing, setParallelLightPing] = useState(true);
  const [gamesPerWallet, setGamesPerWallet] = useState(1);
  const [startingBalance, setStartingBalance] = useState(1500);
  const [celoPerWallet, setCeloPerWallet] = useState("0.5");
  const [distributorJson, setDistributorJson] = useState<string>("");
  const [distributorFund, setDistributorFund] = useState<DistributorFundPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{ success: boolean; data?: StatusPayload; message?: string }>(
        "admin/celo-operator/status"
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

  /** Table: API returns wallets sorted by CELO balance (highest first); keep client sort by balanceWei as fallback. */
  const walletsSorted = useMemo(() => {
    if (!status?.wallets?.length) return [];
    return [...status.wallets].sort((a, b) => {
      const ba = BigInt(a.balanceWei ?? "0");
      const bb = BigInt(b.balanceWei ?? "0");
      if (bb > ba) return 1;
      if (bb < ba) return -1;
      return a.address.localeCompare(b.address);
    });
  }, [status?.wallets]);

  useEffect(() => {
    if (fundWriteError) setLog((prev) => `${prev}\n${fundWriteError.message}`);
  }, [fundWriteError]);

  useEffect(() => {
    if (fundTxSuccess && fundTxHash) {
      setLog((prev) => `${prev}\nBatch fund confirmed: ${fundTxHash}`);
      load();
    }
  }, [fundTxSuccess, fundTxHash, load]);

  async function runRegister() {
    setBusy("register");
    setLog("");
    try {
      const { data: body } = await adminApi.post<{ success: boolean; data?: { results: unknown[] }; message?: string }>(
        "admin/celo-operator/register",
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
        "admin/celo-operator/create-ai-games",
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

  /** Cheap txs: TYC (or USDC) rotates approve(game,0) / transfer(self,0) / transfer(game,0); optional N steps per wallet. */
  async function runLightChainPing() {
    setBusy("light");
    setLog("");
    const n = Math.max(1, Math.min(100, approvalsPerWallet || 1));
    const perApprovalMs = 14000 + delayMs;
    const wallMs = parallelLightPing ? n * perApprovalMs : n * perApprovalMs * (status?.walletCount ?? 1);
    const lightPingTimeout = Math.min(45 * 60 * 1000, Math.max(ONCHAIN_BATCH_REQUEST_TIMEOUT_MS, wallMs + 120_000));
    try {
      const { data: body } = await adminApi.post<{ success: boolean; data?: unknown; message?: string }>(
        "admin/celo-operator/light-chain-ping",
        { delayMs, approvalsPerWallet: n, parallelWallets: parallelLightPing },
        { timeout: lightPingTimeout }
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
      }>("admin/celo-operator/distributor-payload", { celoPerWallet });
      if (!body?.success || !body.data) throw new Error(body?.message || "Failed");
      const d = body.data as DistributorFundPayload;
      if (!d.recipients?.length || !d.amountsWei?.length || !d.to || !d.valueWei) {
        throw new Error("Invalid distributor payload from server");
      }
      setDistributorFund(d);
      setDistributorJson(JSON.stringify(body.data, null, 2));
      setLog(
        "Payload ready. Use “Send with connected wallet” (Celo mainnet) or send manually with cast / another tool."
      );
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function sendBatchFundWithWallet() {
    setLog("");
    if (!distributorFund) {
      setLog("Click “Build payload” first.");
      return;
    }
    if (!isConnected) {
      setLog("Connect your wallet in the app header, then try again.");
      return;
    }
    if (chainId !== CELO_MAINNET_CHAIN_ID) {
      setLog(
        `Switch your wallet to Celo mainnet (chain id ${CELO_MAINNET_CHAIN_ID}). You are on chain ${chainId}.`
      );
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: distributorFund.to as `0x${string}`,
        abi: DISTRIBUTOR_ABI,
        functionName: "distribute",
        args: [
          distributorFund.recipients as `0x${string}`[],
          distributorFund.amountsWei.map((a) => BigInt(a)),
        ],
        value: BigInt(distributorFund.valueWei),
      });
      setLog(`Submitted batch fund tx: ${hash}`);
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Admin
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-white mb-1">Celo operators</h1>
      <p className="text-sm text-slate-400 mb-6">
        On-chain only on <strong className="text-slate-300">CELO</strong>. Enable with{" "}
        <code className="text-amber-200/90">CELO_OPERATOR_TOOLS_ENABLED=true</code> and{" "}
        <code className="text-amber-200/90">CELO_OPERATOR_WALLET_PRIVATE_KEYS</code> (comma-separated) on the backend.
        Legacy env names <code className="text-amber-200/90">CELO_BOT_FARM_ENABLED</code> /{" "}
        <code className="text-amber-200/90">CELO_BOT_FARM_PRIVATE_KEYS</code> still work. Optional{" "}
        <code className="text-amber-200/90">CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS</code> for batch CELO funding via{" "}
        <code className="text-amber-200/90">CeloBatchNativeDistributor</code>.
      </p>

      <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-4 py-3 text-amber-100/90 text-sm mb-6">
        Mainnet CELO spend and many games affect your product metrics. Keys must never be placed in the browser; they live
        only in server environment variables.
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-300 text-xs mb-6 space-y-2">
        <p>
          <strong className="text-slate-200">Execution order:</strong> Register, Create AI games, light token ping, and
          batch-fund recipient lists all run <strong className="text-cyan-300">highest CELO balance first</strong> so
          better-funded keys are more likely to succeed before balances run low.
        </p>
        <p>
          <strong className="text-slate-200">Long batches:</strong> Create AI games uses a long HTTP timeout; if the
          browser still cancels, lower <code className="text-slate-400">gamesPerWallet</code> or run again — completed
          wallets stay done; failures show in the log.
        </p>
        <p>
          <strong className="text-slate-200">Cheaper / second contract (no redeploy):</strong>{" "}
          <strong className="text-violet-300">Light chain ping</strong> calls{" "}
          <code className="text-slate-400">ERC20.approve(tycoonGameAddress, 0)</code> on your{" "}
          <strong className="text-slate-300">TYC</strong> token when{" "}
          <code className="text-slate-400">CELO_TYC_TOKEN_ADDRESS</code> / <code className="text-slate-400">TYCOON_CELO_TYC</code>, or
          from <code className="text-slate-400">rewardSystem().tycToken()</code> on the game proxy. Only if TYC cannot be resolved does it fall back to{" "}
          <strong className="text-slate-300">USDC</strong>. Tiny gas, no token balance required. Each step cycles{" "}
          <code className="text-slate-400">approve(game,0)</code>,{" "}
          <code className="text-slate-400">transfer(self,0)</code>,{" "}
          <code className="text-slate-400">transfer(game,0)</code> (standard ERC-20; no mint — operators are not minters).
          You can run up to <strong className="text-slate-300">100 steps per wallet</strong> from the inputs below
          (stress / RPC checks; prefer <strong className="text-slate-300">parallel wallets</strong> when N× is large).
        </p>
        <p>
          <strong className="text-slate-200">Gas ladder:</strong>{" "}
          <code className="text-slate-400">TYC|USDC.approve / transfer(0)</code> (lightest) →{" "}
          <code className="text-slate-400">registerPlayer</code> (when needed) →{" "}
          <code className="text-slate-400">createAIGame</code> (heaviest).
        </p>
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
              Operator tools enabled (env):{" "}
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
            {status.lightPingTokenAddress && status.lightPingTokenSymbol && (
              <div>
                Light ping token ({status.lightPingTokenSymbol}):{" "}
                <code className="text-xs text-slate-200">{status.lightPingTokenAddress}</code>
                {status.lightPingTokenSymbol === "TYC" && status.lightPingTycResolvedFrom ? (
                  <span className="text-slate-500 ml-2">
                    (from {status.lightPingTycResolvedFrom === "onchain" ? "game rewardSystem" : ".env"})
                  </span>
                ) : null}
              </div>
            )}
            <div>Configured wallets: {status.walletCount}</div>
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
              Light ping: steps per wallet (1–100)
              <input
                type="number"
                min={1}
                max={100}
                value={approvalsPerWallet}
                onChange={(e) => setApprovalsPerWallet(Number(e.target.value) || 1)}
                className="mt-1 block w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={parallelLightPing}
                onChange={(e) => setParallelLightPing(e.target.checked)}
                className="rounded border-slate-600"
              />
              Parallel wallets (recommended if many repeats per wallet)
            </label>
            <label className="text-xs text-slate-400 block">
              AI games per operator wallet
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
            <button
              type="button"
              disabled={!!busy}
              onClick={runLightChainPing}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-100 border border-slate-500 disabled:opacity-50"
              title="Rotating approve(game,0) and transfer(...,0) on TYC (preferred) or USDC — low gas"
            >
              {busy === "light" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Light ping (
              {status.lightPingTokenSymbol ?? "TYC"} mixed ERC-20 × {Math.max(1, Math.min(100, approvalsPerWallet || 1))})
            </button>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 mb-6">
            <h2 className="text-sm font-medium text-slate-200 mb-2">Batch fund CELO</h2>
            <p className="text-xs text-slate-500 mb-3">
              Build payload, then send <strong className="text-slate-400">distribute</strong> from a connected wallet on{" "}
              <strong className="text-slate-400">Celo mainnet ({CELO_MAINNET_CHAIN_ID})</strong>. The wallet pays total{" "}
              <code className="text-slate-400">valueWei</code> CELO plus gas.
            </p>
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
              <button
                type="button"
                disabled={
                  !distributorFund || !!busy || isFundWalletPending || isFundConfirming || !isConnected
                }
                onClick={sendBatchFundWithWallet}
                className="rounded-lg bg-emerald-900/80 hover:bg-emerald-800 px-4 py-2 text-sm font-medium text-emerald-100 border border-emerald-800 disabled:opacity-50"
              >
                {isFundWalletPending || isFundConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : null}{" "}
                Send with connected wallet
              </button>
            </div>
            {isConnected && (
              <p className="mt-2 text-xs text-slate-500">
                Wallet: <code className="text-slate-400">{connectedAddress}</code> · chain:{" "}
                <code className="text-slate-400">{chainId}</code>
                {chainId !== CELO_MAINNET_CHAIN_ID ? (
                  <span className="text-amber-400"> (switch to Celo mainnet to send)</span>
                ) : null}
              </p>
            )}
            {distributorJson && (
              <pre className="mt-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">{distributorJson}</pre>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2 w-10 text-right">#</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Registered</th>
                  <th className="px-3 py-2">CELO</th>
                  <th className="px-3 py-2">Username used</th>
                </tr>
              </thead>
              <tbody>
                {walletsSorted.map((b, i) => (
                  <tr key={b.address} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{b.address}</td>
                    <td className="px-3 py-2">{b.registered ? "yes" : "no"}</td>
                    <td className="px-3 py-2 tabular-nums">{b.balanceCelo}</td>
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
