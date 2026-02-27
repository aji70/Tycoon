"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Eye,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Trophy,
  Settings2,
  Wallet,
} from "lucide-react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TOURNAMENT_ESCROW_ADDRESSES } from "@/constants/contracts";
import TycoonTournamentEscrowAbi from "@/context/abi/TycoonTournamentEscrow.json";

const ESCROW_READ_FNS = [
  { name: "owner", args: [] },
  { name: "backend", args: [] },
  { name: "usdc", args: [] },
  { name: "tournaments", args: [{ name: "tournamentId", type: "number" }] },
  { name: "tournamentPool", args: [{ name: "tournamentId", type: "number" }] },
  { name: "getEntrants", args: [{ name: "tournamentId", type: "number" }] },
  { name: "entryPaid", args: [{ name: "tournamentId", type: "number" }, { name: "address", type: "address" }] },
] as const;

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
}

export default function EscrowAdminSection() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const escrowAddress = TOURNAMENT_ESCROW_ADDRESSES[chainId as keyof typeof TOURNAMENT_ESCROW_ADDRESSES];
  const [readTournamentId, setReadTournamentId] = useState("");
  const [readAddress, setReadAddress] = useState("");
  const [readResult, setReadResult] = useState<{ fn: string; result?: unknown; error?: string } | null>(null);
  const [readLoading, setReadLoading] = useState(false);
  const [writeParams, setWriteParams] = useState<Record<string, string>>({});
  const [writeResult, setWriteResult] = useState<{ fn: string; hash?: string; error?: string } | null>(null);

  const { data: owner } = useReadContract({
    address: escrowAddress ?? undefined,
    abi: TycoonTournamentEscrowAbi as never,
    functionName: "owner",
    query: { enabled: !!escrowAddress },
  });
  const { data: backend } = useReadContract({
    address: escrowAddress ?? undefined,
    abi: TycoonTournamentEscrowAbi as never,
    functionName: "backend",
    query: { enabled: !!escrowAddress },
  });

  const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  React.useEffect(() => {
    if (writeError) setWriteResult({ fn: "write", error: writeError.message });
  }, [writeError]);

  const handleRead = useCallback(
    async (fn: string) => {
      setReadResult(null);
      setReadLoading(true);
      if (!escrowAddress || !publicClient) {
        setReadResult({ fn, error: escrowAddress ? "Wallet not connected" : "Escrow address not set" });
        setReadLoading(false);
        return;
      }
      try {
        const tid = readTournamentId ? BigInt(readTournamentId) : BigInt(0);
        const addr = (readAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`;
        const abi = TycoonTournamentEscrowAbi as never;
        let result: unknown;
        if (fn === "owner" || fn === "backend" || fn === "usdc") {
          result = await publicClient.readContract({
            address: escrowAddress,
            abi,
            functionName: fn as "owner" | "backend" | "usdc",
          });
        } else if (fn === "tournaments") {
          result = await publicClient.readContract({
            address: escrowAddress,
            abi,
            functionName: "tournaments",
            args: [tid],
          });
        } else if (fn === "tournamentPool") {
          result = await publicClient.readContract({
            address: escrowAddress,
            abi,
            functionName: "tournamentPool",
            args: [tid],
          });
        } else if (fn === "getEntrants") {
          result = await publicClient.readContract({
            address: escrowAddress,
            abi,
            functionName: "getEntrants",
            args: [tid],
          });
        } else if (fn === "entryPaid") {
          result = await publicClient.readContract({
            address: escrowAddress,
            abi,
            functionName: "entryPaid",
            args: [tid, addr],
          });
        } else {
          setReadResult({ fn, error: "Unknown function" });
          setReadLoading(false);
          return;
        }
        setReadResult({ fn, result });
      } catch (e) {
        setReadResult({ fn, error: (e as Error)?.message ?? "Read failed" });
      } finally {
        setReadLoading(false);
      }
    },
    [escrowAddress, publicClient, readTournamentId, readAddress]
  );

  function handleWrite(
    fn: "createTournament" | "lockTournament" | "cancelTournament" | "setBackend" | "fundPrizePool" | "finalizeTournament" | "refundPrizeToCreator",
    ...args: (string | number | bigint | `0x${string}` | string[] | bigint[])[]
  ) {
    setWriteResult(null);
    if (!escrowAddress) {
      setWriteResult({ fn, error: "Escrow address not set" });
      return;
    }
    const normalized = args.map((a) =>
      typeof a === "string" && a.startsWith("0x") ? a as `0x${string}` : a
    );
    writeContract({
      address: escrowAddress,
      abi: TycoonTournamentEscrowAbi as never,
      functionName: fn,
      args: normalized as never[],
    });
  }

  React.useEffect(() => {
    if (txSuccess && txHash) {
      setWriteResult({ fn: "tx", hash: txHash });
    }
  }, [txSuccess, txHash]);

  const inputClass =
    "w-full px-4 py-3 bg-gray-800/80 rounded-xl border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition";
  const labelClass = "block text-sm font-medium text-gray-400 mb-1.5";
  const btnRead =
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-amber-600/90 hover:bg-amber-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed";
  const btnWrite =
    "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed";

  if (!escrowAddress) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-cyan-900/40 border border-cyan-500/30">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Tournament Escrow</h2>
        </div>
        <p className="text-gray-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          Set <code className="rounded bg-gray-800 px-2 py-0.5 text-cyan-300">NEXT_PUBLIC_POLYGON_TOURNAMENT_ESCROW</code> in your env to manage the escrow contract.
        </p>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-900/50 to-purple-900/30 border border-cyan-500/30">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Tournament Escrow</h2>
              <p className="text-sm text-gray-400">Entry fees & prize pool · owner/backend only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-gray-500 font-mono max-w-[200px] truncate sm:max-w-none" title={escrowAddress}>
              {escrowAddress}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(escrowAddress)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition"
              title="Copy address"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isConnected && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-900/20 border border-amber-600/30 text-amber-200 text-sm mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            Connect your wallet (owner or backend) to call write functions.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl bg-gray-800/40 p-4 border border-gray-700/50">
            <p className={labelClass}>Owner</p>
            <p className="font-mono text-sm text-emerald-400 break-all">{String(owner ?? "—")}</p>
          </div>
          <div className="rounded-xl bg-gray-800/40 p-4 border border-gray-700/50">
            <p className={labelClass}>Backend</p>
            <p className="font-mono text-sm text-emerald-400 break-all">{String(backend ?? "—")}</p>
          </div>
        </div>

        {/* Read contract */}
        <div className="mb-8">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <Eye className="w-5 h-5 text-amber-400" />
            Read contract
          </h3>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              placeholder="Tournament ID"
              value={readTournamentId}
              onChange={(e) => setReadTournamentId(e.target.value)}
              className="max-w-[140px] px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Address (for entryPaid)"
              value={readAddress}
              onChange={(e) => setReadAddress(e.target.value)}
              className="min-w-[200px] flex-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ESCROW_READ_FNS.map(({ name }) => (
              <button
                key={name}
                type="button"
                onClick={() => handleRead(name)}
                disabled={readLoading}
                className={btnRead}
              >
                {readLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {name}
              </button>
            ))}
          </div>
          {readResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-xl bg-gray-800/60 p-4 border border-gray-700/50 overflow-x-auto"
            >
              {readResult.error ? (
                <p className="text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {readResult.error}
                </p>
              ) : (
                <pre className="font-mono text-sm text-emerald-400 whitespace-pre-wrap break-all">
                  {JSON.stringify(readResult.result, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)}
                </pre>
              )}
            </motion.div>
          )}
        </div>

        {/* Write: grouped by purpose */}
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <Send className="w-5 h-5 text-rose-400" />
          Write (owner/backend)
        </h3>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-cyan-300 mb-4">
              <Trophy className="w-4 h-4" />
              Tournament lifecycle
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className={labelClass}>createTournament</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="Tournament ID"
                    value={writeParams.createTournamentId ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, createTournamentId: e.target.value }))}
                    className="flex-1 min-w-[80px] px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                  />
                  <input
                    placeholder="Entry fee (USDC wei)"
                    value={writeParams.createEntryFee ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, createEntryFee: e.target.value }))}
                    className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                  />
                  <input
                    placeholder="Creator 0x..."
                    value={writeParams.createCreator ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, createCreator: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleWrite(
                        "createTournament",
                        BigInt(writeParams.createTournamentId || "0"),
                        BigInt(writeParams.createEntryFee || "0"),
                        (writeParams.createCreator || "0x0000000000000000000000000000000000000000") as `0x${string}`
                      )
                    }
                    disabled={!isConnected || isWritePending}
                    className={btnWrite}
                  >
                    <Send className="w-4 h-4" /> Send
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <label className={labelClass}>lockTournament · cancelTournament</label>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <input
                      placeholder="Tournament ID"
                      value={writeParams.lockId ?? ""}
                      onChange={(e) => setWriteParams((p) => ({ ...p, lockId: e.target.value }))}
                      className="w-28 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleWrite("lockTournament", BigInt(writeParams.lockId || "0"))}
                      disabled={!isConnected || isWritePending}
                      className={btnWrite + " ml-2"}
                    >
                      Lock
                    </button>
                  </div>
                  <div>
                    <input
                      placeholder="Tournament ID"
                      value={writeParams.cancelId ?? ""}
                      onChange={(e) => setWriteParams((p) => ({ ...p, cancelId: e.target.value }))}
                      className="w-28 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleWrite("cancelTournament", BigInt(writeParams.cancelId || "0"))}
                      disabled={!isConnected || isWritePending}
                      className={btnWrite + " ml-2"}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-cyan-300 mb-4">
              <Settings2 className="w-4 h-4" />
              Config & funding
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className={labelClass}>setBackend</label>
                <div className="flex gap-2">
                  <input
                    placeholder="New backend 0x..."
                    value={writeParams.setBackendAddr ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, setBackendAddr: e.target.value }))}
                    className={inputClass + " font-mono text-sm"}
                  />
                  <button
                    type="button"
                    onClick={() => handleWrite("setBackend", (writeParams.setBackendAddr || "0x") as `0x${string}`)}
                    disabled={!isConnected || isWritePending}
                    className={btnWrite + " shrink-0"}
                  >
                    Send
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <label className={labelClass}>fundPrizePool</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="Tournament ID"
                    value={writeParams.fundId ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, fundId: e.target.value }))}
                    className="w-28 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                  />
                  <input
                    placeholder="Amount (USDC wei)"
                    value={writeParams.fundAmount ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, fundAmount: e.target.value }))}
                    className="w-36 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleWrite("fundPrizePool", BigInt(writeParams.fundId || "0"), BigInt(writeParams.fundAmount || "0"))
                    }
                    disabled={!isConnected || isWritePending}
                    className={btnWrite}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-cyan-300 mb-4">
              <Wallet className="w-4 h-4" />
              Payouts
            </h4>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className={labelClass}>finalizeTournament</label>
                <p className="text-xs text-gray-500 mb-2">recipients and amounts as JSON arrays, e.g. ["0x..."] and ["1000000"]</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="Tournament ID"
                    value={writeParams.finalizeId ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, finalizeId: e.target.value }))}
                    className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                  />
                  <input
                    placeholder='Recipients ["0x..."]'
                    value={writeParams.finalizeRecipients ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, finalizeRecipients: e.target.value }))}
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm font-mono"
                  />
                  <input
                    placeholder='Amounts ["1000000"]'
                    value={writeParams.finalizeAmounts ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, finalizeAmounts: e.target.value }))}
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const recipients = JSON.parse(writeParams.finalizeRecipients || "[]") as string[];
                        const amounts = (JSON.parse(writeParams.finalizeAmounts || "[]") as string[]).map((s) => BigInt(s));
                        if (recipients.length !== amounts.length) throw new Error("Length mismatch");
                        handleWrite(
                          "finalizeTournament",
                          BigInt(writeParams.finalizeId || "0"),
                          recipients as `0x${string}`[],
                          amounts
                        );
                      } catch (e) {
                        setWriteResult({ fn: "finalizeTournament", error: (e as Error)?.message ?? "Invalid JSON" });
                      }
                    }}
                    disabled={!isConnected || isWritePending}
                    className={btnWrite}
                  >
                    Finalize
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <label className={labelClass}>refundPrizeToCreator (owner only)</label>
                <div className="flex gap-2">
                  <input
                    placeholder="Tournament ID"
                    value={writeParams.refundId ?? ""}
                    onChange={(e) => setWriteParams((p) => ({ ...p, refundId: e.target.value }))}
                    className="w-28 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleWrite("refundPrizeToCreator", BigInt(writeParams.refundId || "0"))}
                    disabled={!isConnected || isWritePending}
                    className={btnWrite}
                  >
                    Refund to creator
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(isWritePending || isConfirming) && (
          <div className="flex items-center gap-2 mt-4 text-amber-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Transaction pending…</span>
          </div>
        )}
        {writeResult?.hash && (
          <div className="flex items-center gap-2 mt-4 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-mono text-sm">Tx: {writeResult.hash}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(writeResult.hash!)}
              className="p-1 rounded hover:bg-white/10"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}
        {writeResult?.error && (
          <div className="flex items-center gap-2 mt-4 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{writeResult.error}</span>
          </div>
        )}
      </div>
    </motion.section>
  );
}
