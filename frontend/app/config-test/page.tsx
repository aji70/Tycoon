"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";

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

  if (loading && !data) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] flex items-center justify-center">
        <p className="text-[#00F0FF] font-medium">Loading config…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => fetchConfig(chain)}
          className="rounded-lg bg-[#00F0FF]/20 px-4 py-2 text-[#00F0FF] hover:bg-[#00F0FF]/30"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#010F10] text-[#F0F7F7] p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-orbitron text-2xl font-bold text-[#00F0FF]">Config &amp; contract test</h1>
          <Link
            href="/"
            className="rounded-lg border border-[#00F0FF]/50 bg-[#0A1A1B]/80 px-4 py-2 text-sm font-medium text-[#00F0FF] hover:bg-[#00F0FF]/10 transition"
          >
            ← Back to home
          </Link>
        </div>

        <div className="rounded-xl border border-[#00F0FF]/30 bg-[#0A1A1B]/80 p-4 backdrop-blur-sm">
          <p className="text-sm text-[#B0BFC0]">
            <strong className="text-[#00F0FF]/90">Backend users:</strong> Same username and same wallet address are allowed on different chains (unique per chain). Registration and lookups are scoped by chain.
          </p>
        </div>

        <div className="rounded-xl border border-[#00F0FF]/30 bg-[#0A1A1B]/80 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#00F0FF]/80">Chain</span>
            <div className="flex gap-2">
              {CHAINS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChain(ch)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    chain === ch
                      ? "bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/50"
                      : "bg-black/30 text-[#B0BFC0] border border-[#00F0FF]/20 hover:border-[#00F0FF]/40"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-[#00F0FF]/80">{rpcKey}</span>
              <code className="mt-1 block break-all rounded bg-black/40 px-3 py-2 text-sm text-[#F0F7F7]">
                {rpcUrl ?? "(not set)"}
              </code>
            </div>
            <div>
              <span className="text-xs text-[#00F0FF]/80">{contractKey}</span>
              <code className="mt-1 block break-all rounded bg-black/40 px-3 py-2 text-sm text-[#F0F7F7]">
                {contractAddress ?? "(not set)"}
              </code>
            </div>
            <div>
              <span className="text-xs text-[#00F0FF]/80">BACKEND_GAME_CONTROLLER_PRIVATE_KEY</span>
              <code className="mt-1 block break-all rounded bg-black/40 px-3 py-2 text-sm text-[#F0F7F7]">
                {pkDisplay != null && pkDisplay !== "" ? (pkDisplay.length > 12 ? `${pkDisplay.slice(0, 6)}…${pkDisplay.slice(-4)}` : "••••••••") : "(not set)"}
              </code>
            </div>
          </div>
          {data?.connectionTest && (
            <div className="mt-4 border-t border-[#00F0FF]/20 pt-4">
              <span className="text-xs font-medium uppercase tracking-wider text-[#00F0FF]/80">Connection test</span>
              {data.connectionTest.ok ? (
                <div className="mt-2 space-y-1 text-sm text-emerald-400">
                  <p>OK — Block: {data.connectionTest.blockNumber}, Wallet: {data.connectionTest.walletAddress?.slice(0, 10)}…</p>
                  <p>Balance: {data.connectionTest.balance} wei</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-red-400">{data.connectionTest.error}</p>
              )}
            </div>
          )}
        </div>

        <section className="rounded-xl border border-amber-500/30 bg-[#0A1A1B]/80 p-4 backdrop-blur-sm">
          <h2 className="mb-2 font-orbitron text-lg font-semibold text-amber-400/90">Contract read functions</h2>
          <p className="mb-4 text-xs text-[#B0BFC0]">Call read-only contract functions for chain: <strong>{chain}</strong></p>
          <div className="space-y-4">
            {READ_FUNCTIONS.map((spec) => (
              <div key={spec.fn} className="rounded-lg bg-black/20 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="font-mono text-sm text-amber-400">{spec.fn}</span>
                  {spec.params.map((p) => (
                    <input
                      key={p.name}
                      type="text"
                      placeholder={p.placeholder}
                      value={(paramValues[spec.fn] ?? {})[p.name] ?? ""}
                      onChange={(e) => setParam(spec.fn, p.name, e.target.value)}
                      className="min-w-[120px] rounded border border-[#00F0FF]/30 bg-black/40 px-2 py-1 text-sm focus:border-[#00F0FF]/60 focus:outline-none"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => handleCall(spec.fn, spec.params, false)}
                    className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
                  >
                    Call
                  </button>
                </div>
                {callResult?.fn === spec.fn && (
                  <div className="mt-2 overflow-x-auto rounded bg-black/40 p-2 font-mono text-sm">
                    {callResult.error ? (
                      <span className="text-red-400">{callResult.error}</span>
                    ) : (
                      <pre className="whitespace-pre-wrap break-all text-emerald-400">
                        {JSON.stringify(callResult.result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-red-500/30 bg-[#0A1A1B]/80 p-4 backdrop-blur-sm">
          <h2 className="mb-2 font-orbitron text-lg font-semibold text-red-400/90">Contract write functions</h2>
          <p className="mb-4 text-xs text-amber-200/80">Sends real transactions (gas). Uses chain: <strong>{chain}</strong></p>
          <div className="space-y-4">
            {WRITE_FUNCTIONS.map((spec) => (
              <div key={spec.fn} className="rounded-lg border border-amber-900/50 bg-black/20 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="font-mono text-sm text-amber-400">{spec.fn}</span>
                  {spec.params.map((p) => (
                    <input
                      key={p.name}
                      type="text"
                      placeholder={p.placeholder}
                      value={(paramValues[spec.fn] ?? {})[p.name] ?? ""}
                      onChange={(e) => setParam(spec.fn, p.name, e.target.value)}
                      className="min-w-[120px] rounded border border-[#00F0FF]/30 bg-black/40 px-2 py-1 text-sm focus:border-[#00F0FF]/60 focus:outline-none"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => handleCall(spec.fn, spec.params, true)}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                  >
                    Send
                  </button>
                </div>
                {callResult?.fn === spec.fn && (
                  <div className="mt-2 overflow-x-auto rounded bg-black/40 p-2 font-mono text-sm">
                    {callResult.error ? (
                      <span className="text-red-400">{callResult.error}</span>
                    ) : (
                      <pre className="whitespace-pre-wrap break-all text-emerald-400">
                        {JSON.stringify(callResult.result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
