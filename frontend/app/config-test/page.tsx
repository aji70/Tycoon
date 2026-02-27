"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Eye,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import EscrowAdminSection from "@/components/admin/EscrowAdminSection";

const CHAINS = ["POLYGON", "CELO", "BASE"] as const;
type ChainKey = (typeof CHAINS)[number];

type ConfigTest = {
  chain?: ChainKey;
  isConfigured?: boolean;
  POLYGON_RPC_URL?: string | null;
  TYCOON_POLYGON_CONTRACT_ADDRESS?: string | null;
  CELO_RPC_URL?: string | null;
  TYCOON_CELO_CONTRACT_ADDRESS?: string | null;
  BASE_RPC_URL?: string | null;
  TYCOON_BASE_CONTRACT_ADDRESS?: string | null;
  BACKEND_GAME_CONTROLLER_PRIVATE_KEY?: string | null;
  connectionTest?: {
    ok: boolean;
    error?: string;
    blockNumber?: number;
    walletAddress?: string;
    balance?: string;
  };
};

type ReadFnSpec = {
  fn: string;
  params: { name: string; placeholder: string; type: "string" | "number" | "address" | "boolean" }[];
};

const READ_FUNCTIONS: ReadFnSpec[] = [
  { fn: "owner", params: [] },
  { fn: "backendGameController", params: [] },
  { fn: "minStake", params: [] },
  { fn: "minTurnsForPerks", params: [] },
  { fn: "totalGames", params: [] },
  { fn: "totalUsers", params: [] },
  { fn: "TOKEN_REWARD", params: [] },
  { fn: "rewardSystem", params: [] },
  { fn: "houseUSDC", params: [] },
  { fn: "getUser", params: [{ name: "username", placeholder: "e.g. alice", type: "string" }] },
  { fn: "getGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "getGameByCode", params: [{ name: "code", placeholder: "e.g. ABC123", type: "string" }] },
  { fn: "getGamePlayer", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }] },
  { fn: "getPlayersInGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "getLastGameCode", params: [{ name: "user", placeholder: "0x...", type: "address" }] },
  { fn: "getGameSettings", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "registered", params: [{ name: "address", placeholder: "0x...", type: "address" }] },
  { fn: "addressToUsername", params: [{ name: "address", placeholder: "0x...", type: "address" }] },
  { fn: "turnsPlayed", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }] },
];

const WRITE_FUNCTIONS: ReadFnSpec[] = [
  { fn: "registerPlayer", params: [{ name: "username", placeholder: "e.g. testuser", type: "string" }] },
  { fn: "transferPropertyOwnership", params: [{ name: "sellerUsername", placeholder: "seller", type: "string" }, { name: "buyerUsername", placeholder: "buyer", type: "string" }] },
  { fn: "setTurnCount", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }, { name: "count", placeholder: "20", type: "number" }] },
  { fn: "removePlayerFromGame", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }, { name: "turnCount", placeholder: "5", type: "number" }] },
  { fn: "createGame", params: [
    { name: "creatorUsername", placeholder: "alice", type: "string" },
    { name: "gameType", placeholder: "PUBLIC or PRIVATE", type: "string" },
    { name: "playerSymbol", placeholder: "hat, car, dog...", type: "string" },
    { name: "numberOfPlayers", placeholder: "2-8", type: "number" },
    { name: "code", placeholder: "ABC123", type: "string" },
    { name: "startingBalance", placeholder: "1500", type: "number" },
    { name: "stakeAmount", placeholder: "0", type: "number" },
  ]},
  { fn: "createAIGame", params: [
    { name: "creatorUsername", placeholder: "alice", type: "string" },
    { name: "gameType", placeholder: "PUBLIC", type: "string" },
    { name: "playerSymbol", placeholder: "hat", type: "string" },
    { name: "numberOfAI", placeholder: "1-7", type: "number" },
    { name: "code", placeholder: "AI1", type: "string" },
    { name: "startingBalance", placeholder: "1500", type: "number" },
  ]},
  { fn: "joinGame", params: [
    { name: "gameId", placeholder: "1", type: "number" },
    { name: "playerUsername", placeholder: "bob", type: "string" },
    { name: "playerSymbol", placeholder: "car", type: "string" },
    { name: "joinCode", placeholder: "ABC123", type: "string" },
  ]},
  { fn: "leavePendingGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "exitGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "endAIGame", params: [
    { name: "gameId", placeholder: "1", type: "number" },
    { name: "finalPosition", placeholder: "1=win", type: "number" },
    { name: "finalBalance", placeholder: "1500", type: "number" },
    { name: "isWin", placeholder: "true/false", type: "boolean" },
  ]},
  { fn: "setBackendGameController", params: [{ name: "newController", placeholder: "0x...", type: "address" }] },
  { fn: "setMinTurnsForPerks", params: [{ name: "newMin", placeholder: "20", type: "number" }] },
  { fn: "setMinStake", params: [{ name: "newMinStake", placeholder: "0", type: "number" }] },
  { fn: "withdrawHouse", params: [{ name: "amount", placeholder: "0", type: "number" }] },
  { fn: "drainContract", params: [] },
];

function getChainKeys(chain: ChainKey) {
  if (chain === "CELO") return { rpcKey: "CELO_RPC_URL", contractKey: "TYCOON_CELO_CONTRACT_ADDRESS" };
  if (chain === "BASE") return { rpcKey: "BASE_RPC_URL", contractKey: "TYCOON_BASE_CONTRACT_ADDRESS" };
  return { rpcKey: "POLYGON_RPC_URL", contractKey: "TYCOON_POLYGON_CONTRACT_ADDRESS" };
}

export default function ConfigTestPage() {
  const [chain, setChain] = useState<ChainKey>("POLYGON");
  const [data, setData] = useState<ConfigTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [callResult, setCallResult] = useState<{ fn: string; result?: unknown; error?: string } | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [readOpen, setReadOpen] = useState(true);
  const [writeOpen, setWriteOpen] = useState(false);

  const fetchConfig = useCallback(async (ch: ChainKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ConfigTest>("config/test", {
        params: { chain: ch, test_connection: "1" },
      });
      if (res?.data) setData(res.data as ConfigTest);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig(chain);
  }, [chain, fetchConfig]);

  async function handleCall(fn: string, params: ReadFnSpec["params"], write = false) {
    setCallResult(null);
    const vals = params.map((p) => {
      const v = (paramValues[fn] ?? {})[p.name] ?? "";
      if (p.type === "number") return v ? Number(v) : 0;
      if (p.type === "boolean") return v === "true" || v === "1";
      return v;
    });
    try {
      const res = await apiClient.post<{ success: boolean; result?: unknown; error?: string }>("config/call-contract", {
        fn,
        params: vals,
        write,
        chain,
      });
      const body = res.data as { success: boolean; result?: unknown; error?: string };
      if (body.success) {
        setCallResult({ fn, result: body.result });
      } else {
        setCallResult({ fn, error: body.error });
      }
    } catch (e: unknown) {
      let msg = "Request failed";
      if (e && typeof e === "object" && "response" in e) {
        const res = (e as { response?: { data?: { error?: string } } }).response;
        if (res?.data?.error) msg = res.data.error;
        else if (e instanceof Error) msg = e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      setCallResult({ fn, error: msg });
    }
  }

  function setParam(fn: string, name: string, value: string) {
    setParamValues((prev) => ({ ...prev, [fn]: { ...(prev[fn] ?? {}), [name]: value } }));
  }

  const { rpcKey, contractKey } = getChainKeys(chain);
  const rpcUrl = data ? (data[rpcKey as keyof ConfigTest] as string | null) : null;
  const contractAddress = data ? (data[contractKey as keyof ConfigTest] as string | null) : null;
  const pkDisplay = data?.BACKEND_GAME_CONTROLLER_PRIVATE_KEY ?? null;

  const inputClass =
    "min-w-[120px] rounded-xl border border-gray-600/50 bg-gray-800/80 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition";
  const btnRead =
    "inline-flex items-center gap-1.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50";
  const btnWrite =
    "inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition disabled:opacity-50";

  if (loading && !data) {
    return (
      <main className="min-h-screen w-full bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
          <p className="text-gray-400 font-medium">Loading config…</p>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen w-full bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] p-6 flex flex-col items-center justify-center gap-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => fetchConfig(chain)}
          className="rounded-xl bg-cyan-600/80 hover:bg-cyan-500 px-6 py-3 font-medium text-white transition"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] text-white py-8 px-4 md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Config & Contract Test
            </h1>
            <p className="mt-1 text-gray-400">Backend config, escrow, and Tycoon contract calls</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-600/50 bg-gray-800/50 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700/50 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-6"
        >
          <p className="text-sm text-gray-400">
            <strong className="text-cyan-400/90">Backend users:</strong> Same username and wallet are allowed on different chains (unique per chain). Registration and lookups are scoped by chain.
          </p>
        </motion.div>

        {/* Chain & connection */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-cyan-900/40 border border-cyan-500/30">
              <Settings className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Chain & connection</h2>
              <p className="text-sm text-gray-400">Select chain and view backend config</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            {CHAINS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChain(ch)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  chain === ch
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg"
                    : "bg-gray-800/80 text-gray-400 hover:bg-gray-700/80 hover:text-white border border-gray-600/50"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="rounded-xl bg-gray-800/40 p-4 border border-gray-700/50">
              <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/80 mb-1">{rpcKey}</p>
              <code className="block break-all text-sm text-gray-300 font-mono">{rpcUrl ?? "(not set)"}</code>
            </div>
            <div className="rounded-xl bg-gray-800/40 p-4 border border-gray-700/50">
              <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/80 mb-1">{contractKey}</p>
              <code className="block break-all text-sm text-gray-300 font-mono">{contractAddress ?? "(not set)"}</code>
            </div>
            <div className="rounded-xl bg-gray-800/40 p-4 border border-gray-700/50 md:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/80 mb-1">BACKEND_GAME_CONTROLLER_PRIVATE_KEY</p>
              <code className="block text-sm text-gray-400 font-mono">
                {pkDisplay != null && pkDisplay !== "" ? (pkDisplay.length > 12 ? `${pkDisplay.slice(0, 6)}…${pkDisplay.slice(-4)}` : "••••••••") : "(not set)"}
              </code>
            </div>
          </div>
          {data?.connectionTest && (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${data.connectionTest.ok ? "bg-emerald-900/20 border-emerald-600/40" : "bg-red-900/20 border-red-600/40"}`}>
              {data.connectionTest.ok ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div className="text-sm">
                    <p className="text-emerald-300 font-medium">Connection OK</p>
                    <p className="text-gray-400 mt-0.5">Block #{data.connectionTest.blockNumber} · Wallet {data.connectionTest.walletAddress?.slice(0, 10)}… · Balance {data.connectionTest.balance} wei</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <p className="text-red-300 text-sm">{data.connectionTest.error}</p>
                </>
              )}
            </div>
          )}
        </motion.section>

        <EscrowAdminSection />

        {/* Tycoon read */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-gray-700/50 bg-gray-900/50 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setReadOpen((o) => !o)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-800/30 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-900/40 border border-amber-500/30">
                <Eye className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Tycoon read functions</h2>
                <p className="text-sm text-gray-400">Read-only · chain: {chain}</p>
              </div>
            </div>
            {readOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          <AnimatePresence>
            {readOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-gray-700/50"
              >
                <div className="p-6 space-y-4">
                  {READ_FUNCTIONS.map((spec) => (
                    <div key={spec.fn} className="rounded-xl bg-gray-800/40 p-4 border border-gray-700/50">
                      <div className="flex flex-wrap items-end gap-2">
                        <span className="font-mono text-sm font-medium text-amber-400/90">{spec.fn}</span>
                        {spec.params.map((p) => (
                          <input
                            key={p.name}
                            type="text"
                            placeholder={p.placeholder}
                            value={(paramValues[spec.fn] ?? {})[p.name] ?? ""}
                            onChange={(e) => setParam(spec.fn, p.name, e.target.value)}
                            className={inputClass}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => handleCall(spec.fn, spec.params, false)}
                          className={btnRead}
                        >
                          <Cpu className="w-4 h-4" /> Call
                        </button>
                      </div>
                      <AnimatePresence>
                        {callResult?.fn === spec.fn && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="mt-3 rounded-lg bg-gray-900/60 p-3 overflow-x-auto"
                          >
                            {callResult.error ? (
                              <p className="text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {callResult.error}
                              </p>
                            ) : (
                              <pre className="font-mono text-sm text-emerald-400 whitespace-pre-wrap break-all">
                                {JSON.stringify(callResult.result, null, 2)}
                              </pre>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Tycoon write */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-gray-700/50 bg-gray-900/50 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setWriteOpen((o) => !o)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-800/30 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-900/40 border border-rose-500/30">
                <Send className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Tycoon write functions</h2>
                <p className="text-sm text-amber-200/80">Sends real transactions (gas) · chain: {chain}</p>
              </div>
            </div>
            {writeOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          <AnimatePresence>
            {writeOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-gray-700/50"
              >
                <div className="p-6 space-y-4">
                  {WRITE_FUNCTIONS.map((spec) => (
                    <div key={spec.fn} className="rounded-xl bg-gray-800/40 p-4 border border-rose-900/30">
                      <div className="flex flex-wrap items-end gap-2">
                        <span className="font-mono text-sm font-medium text-rose-400/90">{spec.fn}</span>
                        {spec.params.map((p) => (
                          <input
                            key={p.name}
                            type="text"
                            placeholder={p.placeholder}
                            value={(paramValues[spec.fn] ?? {})[p.name] ?? ""}
                            onChange={(e) => setParam(spec.fn, p.name, e.target.value)}
                            className={inputClass}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => handleCall(spec.fn, spec.params, true)}
                          className={btnWrite}
                        >
                          <Send className="w-4 h-4" /> Send
                        </button>
                      </div>
                      <AnimatePresence>
                        {callResult?.fn === spec.fn && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="mt-3 rounded-lg bg-gray-900/60 p-3 overflow-x-auto"
                          >
                            {callResult.error ? (
                              <p className="text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {callResult.error}
                              </p>
                            ) : (
                              <pre className="font-mono text-sm text-emerald-400 whitespace-pre-wrap break-all">
                                {JSON.stringify(callResult.result, null, 2)}
                              </pre>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </main>
  );
}
