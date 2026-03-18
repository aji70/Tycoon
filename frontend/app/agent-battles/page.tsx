"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import { Loader2, Bot, Plus, House } from "lucide-react";
import { toast } from "react-toastify";

type UserAgent = {
  id: number;
  name: string;
  callback_url: string | null;
  hosted_url: string | null;
  has_api_key?: boolean;
  use_tycoon_key?: boolean;
};

function autoAssignAgentIds(agents: UserAgent[], desiredLen: number): number[] {
  const ids = agents.map((a) => a.id).filter((id) => Number(id) > 0);
  if (ids.length === 0) return Array.from({ length: desiredLen }, () => 0);
  return Array.from({ length: desiredLen }, (_, i) => ids[i % ids.length]);
}

function randomCode6() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export default function AgentBattlesPage() {
  const router = useRouter();
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [mode, setMode] = useState<"agent_vs_agent" | "agent_vs_ai">("agent_vs_agent");
  const [playerCount, setPlayerCount] = useState(2);
  const [aiCount, setAiCount] = useState(1);
  const [duration, setDuration] = useState(30);
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [code, setCode] = useState(() => randomCode6());
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([0, 0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingAgents(true);
    apiClient
      .get<ApiResponse<UserAgent[]>>("/agents")
      .then((res) => {
        const list = (res as any)?.data?.data;
        const usable = Array.isArray(list)
          ? (list as UserAgent[]).filter(
              (a) =>
                a.use_tycoon_key ||
                a.has_api_key ||
                (a.hosted_url || a.callback_url)?.startsWith("http")
            )
          : [];
        if (!mounted) return;
        setAgents(usable);
        // Default-select first agent for all slots.
        if (usable.length > 0) {
          setSelectedAgentIds((prev) => {
            const n = Math.max(2, prev.length);
            return Array.from({ length: n }, () => usable[0].id);
          });
        }
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.message ?? err?.message ?? "Failed to load agents";
        toast.error(msg);
        if (mounted) setAgents([]);
      })
      .finally(() => mounted && setLoadingAgents(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedAgentIds((prev) => {
      const next = [...prev];
      const desiredLen = mode === "agent_vs_agent" ? playerCount : 1;
      if (next.length < desiredLen) {
        const fill = agents[0]?.id ?? 0;
        while (next.length < desiredLen) next.push(fill);
      } else if (next.length > desiredLen) {
        next.length = desiredLen;
      }
      return next;
    });
  }, [playerCount, agents, mode]);

  // If agents list changes (or loads late), make sure all slots point at a real agent id.
  useEffect(() => {
    if (agents.length === 0) return;
    const valid = new Set(agents.map((a) => a.id));
    const desiredLen = mode === "agent_vs_agent" ? playerCount : 1;
    setSelectedAgentIds((prev) => {
      const next = prev.length === desiredLen ? [...prev] : autoAssignAgentIds(agents, desiredLen);
      let changed = false;
      for (let i = 0; i < desiredLen; i++) {
        if (!valid.has(next[i])) {
          next[i] = agents[0].id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [agents, mode, playerCount]);

  const canCreate = useMemo(() => {
    if (creating) return false;
    if (useCustomCode && (!code || code.trim().length !== 6)) return false;
    if (mode === "agent_vs_agent" && (playerCount < 2 || playerCount > 8)) return false;
    if (mode === "agent_vs_ai" && (aiCount < 1 || aiCount > 7)) return false;
    if (agents.length === 0) return false;
    if (mode === "agent_vs_agent") {
      return selectedAgentIds.length === playerCount && selectedAgentIds.every((id) => id > 0);
    }
    return selectedAgentIds.length === 1 && selectedAgentIds[0] > 0;
  }, [creating, useCustomCode, code, playerCount, aiCount, mode, agents.length, selectedAgentIds]);

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const settings = {
        starting_cash: 1500,
        auction: true,
        rent_in_prison: false,
        mortgage: true,
        even_build: true,
        randomize_play_order: false,
      };

      const base = {
        ...(useCustomCode ? { code: code.trim().toUpperCase() } : {}),
        duration,
        chain: "CELO",
        settings,
      };

      const res =
        mode === "agent_vs_agent"
          ? await apiClient.post<any>("/games/create-agent-vs-agent", {
              ...base,
              number_of_players: playerCount,
              agents: selectedAgentIds.map((id, idx) => ({ slot: idx + 1, user_agent_id: id })),
            })
          : await apiClient.post<any>("/games/create-agent-vs-ai", {
              ...base,
              ai_count: aiCount,
              my_agent: { user_agent_id: selectedAgentIds[0] },
            });

      const game = (res as any)?.data?.data;
      const gameCode = game?.code || (useCustomCode ? (base as any).code : null) || "";
      toast.success(`Match created: ${gameCode}`);
      try {
        localStorage.setItem("gameCode", gameCode);
      } catch {}
      router.push(`/board-3d?gameCode=${encodeURIComponent(gameCode)}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to create match";
      toast.error(msg);
      setCode(randomCode6());
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-black/80 backdrop-blur-3xl rounded-3xl border border-cyan-500/30 shadow-2xl p-8 md:p-12">
        <div className="flex justify-between items-center mb-10">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-cyan-400 hover:text-cyan-300 transition group"
          >
            <House className="w-6 h-6 group-hover:-translate-x-1 transition" />
            <span className="font-bold text-lg">BACK</span>
          </button>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              AGENT BATTLES
            </h1>
            <p className="text-sm text-cyan-400/80 mt-1">
              Create an autonomous Agent match (Agent vs AI or Agent vs Agent).
            </p>
          </div>
          <div className="w-24" />
        </div>

        {loadingAgents ? (
          <div className="flex items-center justify-center py-16 gap-3 text-cyan-300">
            <Loader2 className="w-10 h-10 animate-spin" />
            <span className="font-orbitron">Loading agents…</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-black/60 rounded-2xl p-8 border border-cyan-500/30 text-center">
            <Bot className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
            <p className="text-slate-200 font-semibold mb-2">No usable agents found</p>
            <p className="text-slate-400 text-sm mb-5">
              Create an agent first in <span className="text-cyan-400">My Agents</span>.
            </p>
            <button
              onClick={() => router.push("/agents")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
            >
              <Plus className="w-5 h-5" />
              Go to My Agents
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-black/60 rounded-2xl p-4 border border-cyan-500/30 flex flex-col md:flex-row gap-3 items-center justify-between">
              <p className="text-sm text-slate-200 font-semibold">Mode</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("agent_vs_agent")}
                  className={`px-4 py-2 rounded-xl border transition ${
                    mode === "agent_vs_agent"
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                      : "border-slate-600 bg-black/40 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  Agent vs Agent
                </button>
                <button
                  type="button"
                  onClick={() => setMode("agent_vs_ai")}
                  className={`px-4 py-2 rounded-xl border transition ${
                    mode === "agent_vs_ai"
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                      : "border-slate-600 bg-black/40 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  Agent vs AI
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Game code</p>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={useCustomCode}
                    onChange={(e) => setUseCustomCode(e.target.checked)}
                    className="rounded border-slate-600 bg-black/40"
                  />
                  Use custom code
                </label>
                {useCustomCode ? (
                  <>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                      className="mt-3 w-full px-4 py-3 rounded-xl bg-black/70 border border-cyan-500/40 text-white font-mono tracking-widest text-center text-lg"
                      aria-label="Custom game code"
                    />
                    <button
                      type="button"
                      onClick={() => setCode(randomCode6())}
                      className="mt-3 w-full px-4 py-2 rounded-xl border border-slate-600 text-slate-200 hover:bg-white/5"
                    >
                      Randomize
                    </button>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">
                    A code will be generated automatically when you create the match.
                  </p>
                )}
              </div>

              {mode === "agent_vs_agent" ? (
                <div className="bg-black/60 rounded-2xl p-6 border border-purple-500/30">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Players (agents)</p>
                  <select
                    value={playerCount}
                    onChange={(e) => setPlayerCount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-black/70 border border-purple-500/40 text-white"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} agents
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-black/60 rounded-2xl p-6 border border-purple-500/30">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">AI opponents</p>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-black/70 border border-purple-500/40 text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n} AI
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-black/60 rounded-2xl p-6 border border-emerald-500/30">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Duration</p>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-black/70 border border-emerald-500/40 text-white"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={0}>No limit</option>
                </select>
              </div>
            </div>

            <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30">
              <p className="text-sm font-semibold text-slate-200 mb-4">
                {mode === "agent_vs_agent" ? "Assign agents to slots" : "Pick your agent"}
              </p>
              {mode === "agent_vs_agent" && agents.length > 0 && (
                <div className="flex items-center justify-between gap-3 mb-4">
                  <p className="text-xs text-slate-400">
                    We can auto-fill seats using your agents (cycles if you have fewer agents than players).
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedAgentIds(autoAssignAgentIds(agents, playerCount))}
                    className="shrink-0 px-3 py-2 rounded-xl border border-slate-600 text-slate-200 hover:bg-white/5 text-xs font-semibold"
                  >
                    Auto-assign
                  </button>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                {Array.from({ length: mode === "agent_vs_agent" ? playerCount : 1 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs w-16 text-slate-400 font-mono">
                      {mode === "agent_vs_agent" ? `Slot ${idx + 1}` : "Agent"}
                    </span>
                    <select
                      value={selectedAgentIds[idx] ?? 0}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedAgentIds((prev) => {
                          const next = [...prev];
                          next[idx] = id;
                          return next;
                        });
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-black/70 border border-slate-600 text-white"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Tip: give your agent a strong skill/prompt in My Agents.
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                className="px-16 py-5 text-2xl font-orbitron font-black tracking-widest bg-[#00F0FF] hover:bg-[#0FF0FC] text-[#010F10] rounded-2xl shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border-4 border-[#00F0FF]/40"
              >
                {creating ? "CREATING…" : "CREATE MATCH"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

