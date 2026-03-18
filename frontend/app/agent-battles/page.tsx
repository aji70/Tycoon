"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import { Loader2, Bot, Plus, House, QrCode } from "lucide-react";
import { toast } from "react-toastify";
import { QRCodeSVG } from "qrcode.react";

type UserAgent = {
  id: number;
  name: string;
  callback_url: string | null;
  hosted_url: string | null;
  has_api_key?: boolean;
  use_tycoon_key?: boolean;
};

type LobbyInvite = {
  id: number;
  game_id: number;
  slot: number;
  token: string;
  status: "OPEN" | "ACCEPTED" | "DECLINED" | string;
  owner_user_id: number | null;
  user_agent_id: number | null;
  agent_name: string | null;
};

type LobbyGame = {
  id: number;
  code: string;
  creator_id: number;
  number_of_players: number;
  status: string;
  chain: string;
  contract_game_id: string | null;
  game_type?: string | null;
  invites: LobbyInvite[];
};

function autoAssignAgentIds(agents: UserAgent[], desiredLen: number): number[] {
  const ids = agents.map((a) => a.id).filter((id) => Number(id) > 0);
  if (ids.length === 0) return Array.from({ length: desiredLen }, () => 0);
  return Array.from({ length: desiredLen }, (_, i) => ids[i % ids.length]);
}

export default function AgentBattlesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [mode, setMode] = useState<"agent_vs_agent" | "agent_vs_ai">("agent_vs_agent");
  const [onChain, setOnChain] = useState(true);
  const [playerCount, setPlayerCount] = useState(2);
  const [aiCount, setAiCount] = useState(1);
  const [duration, setDuration] = useState(30);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([0, 0]);
  const [creating, setCreating] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);

  const [lobby, setLobby] = useState<LobbyGame | null>(null);
  const [loadingLobby, setLoadingLobby] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [startingLobby, setStartingLobby] = useState(false);
  const [showQrForSlot, setShowQrForSlot] = useState<number | null>(null);

  const lobbyIdParam = searchParams?.get("lobby");
  const lobbyTokenParam = searchParams?.get("token");

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
    let mounted = true;
    apiClient
      .get<any>("/auth/me")
      .then((res) => {
        const id = (res as any)?.data?.data?.id ?? (res as any)?.data?.id ?? null;
        if (!mounted) return;
        setMeId(id ? Number(id) : null);
      })
      .catch(() => {
        if (mounted) setMeId(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const id = Number(lobbyIdParam || 0);
    if (!id) {
      setLobby(null);
      return;
    }
    let mounted = true;
    setLoadingLobby(true);
    apiClient
      .get<ApiResponse<any>>(`/games/${id}/agent-vs-agent-lobby`)
      .then((res) => {
        const data = (res as any)?.data?.data;
        if (!mounted) return;
        setLobby(data || null);
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.message ?? err?.message ?? "Failed to load lobby";
        toast.error(msg);
        if (mounted) setLobby(null);
      })
      .finally(() => mounted && setLoadingLobby(false));
    return () => {
      mounted = false;
    };
  }, [lobbyIdParam]);

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

  // Agent vs Agent: default Slot 1 to first agent when list changes.
  useEffect(() => {
    if (mode !== "agent_vs_agent" || agents.length === 0) return;
    setSelectedAgentIds((prev) => {
      const next = autoAssignAgentIds(agents, playerCount);
      if (prev[0] !== next[0]) return [next[0], ...prev.slice(1)];
      return prev;
    });
  }, [mode, agents, playerCount]);

  const canCreate = useMemo(() => {
    if (creating) return false;
    if (mode === "agent_vs_agent" && (playerCount < 2 || playerCount > 8)) return false;
    if (mode === "agent_vs_ai" && (aiCount < 1 || aiCount > 7)) return false;
    if (agents.length === 0) return false;
    if (mode === "agent_vs_agent") {
      return selectedAgentIds.length >= 1 && selectedAgentIds[0] > 0;
    }
    return selectedAgentIds.length >= 1 && selectedAgentIds[0] > 0;
  }, [creating, playerCount, aiCount, mode, agents.length, selectedAgentIds]);

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

      const agentById = new Map(agents.map((a) => [a.id, a]));

      const base = {
        duration,
        chain: "CELO",
        settings,
      };

      const res =
        mode === "agent_vs_agent"
          ? onChain
            ? await apiClient.post<any>("/games/create-onchain-agent-vs-agent-lobby", {
                ...base,
                number_of_players: playerCount,
                my_agent: {
                  user_agent_id: selectedAgentIds[0],
                  name: agentById.get(selectedAgentIds[0])?.name ?? "My Agent",
                },
              })
            : await apiClient.post<any>("/games/create-agent-vs-agent", {
                ...base,
                number_of_players: playerCount,
                agents: autoAssignAgentIds(agents, playerCount).map(
                  (id, idx) => ({
                    slot: idx + 1,
                    user_agent_id: id,
                    name: agentById.get(id)?.name ?? `Agent ${idx + 1}`,
                  })
                ),
              })
          : await apiClient.post<any>(onChain ? "/games/create-onchain-agent-vs-ai" : "/games/create-agent-vs-ai", {
              ...base,
              ai_count: aiCount,
              my_agent: {
                user_agent_id: selectedAgentIds[0],
                name: agentById.get(selectedAgentIds[0])?.name ?? "My Agent",
              },
            });

      const game = (res as any)?.data?.data;
      const gameCode = game?.code || "";
      toast.success(`Match created: ${gameCode}`);
      try {
        localStorage.setItem("gameCode", gameCode);
      } catch {}
      if (mode === "agent_vs_agent" && onChain) {
        router.push(`/agent-battles?lobby=${encodeURIComponent(String(game?.id))}`);
      } else {
        router.push(`/board-3d?gameCode=${encodeURIComponent(gameCode)}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to create match";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const refreshLobby = useCallback(async () => {
    const id = Number(lobbyIdParam || 0);
    if (!id) return;
    setLoadingLobby(true);
    try {
      const res = await apiClient.get<ApiResponse<any>>(`/games/${id}/agent-vs-agent-lobby`);
      const data = (res as any)?.data?.data;
      setLobby(data || null);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to refresh lobby";
      toast.error(msg);
    } finally {
      setLoadingLobby(false);
    }
  }, [lobbyIdParam]);

  const handleCopyInvite = async (token: string) => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const id = lobby?.id || lobbyIdParam;
      const link = `${origin}/agent-battles?lobby=${encodeURIComponent(String(id))}&token=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy invite link");
    }
  };

  // Poll lobby state until the game starts; then redirect everyone to the board.
  useEffect(() => {
    if (!lobbyIdParam) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      timer = setInterval(() => {
        void refreshLobby();
      }, 2500);
    };

    // If already running, redirect immediately.
    if (lobby?.status === "RUNNING" && lobby?.code) {
      router.push(`/board-3d-multi?gameCode=${encodeURIComponent(lobby.code)}`);
      return;
    }

    startPolling();
    return () => {
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyIdParam, lobby?.status, lobby?.code, refreshLobby]);

  const handleAcceptSeat = async () => {
    const id = Number(lobby?.id || lobbyIdParam || 0);
    if (!id || !lobbyTokenParam) return;
    const agentId = Number(selectedAgentIds[0] || 0);
    if (!agentId) return toast.error("Pick an agent first");
    setAccepting(true);
    try {
      await apiClient.post<any>(`/games/${id}/accept-agent-seat`, {
        token: lobbyTokenParam,
        user_agent_id: agentId,
      });
      toast.success("Seat accepted");
      await refreshLobby();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to accept seat";
      toast.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleStartLobby = async () => {
    const id = Number(lobby?.id || 0);
    if (!id) return;
    setStartingLobby(true);
    try {
      const res = await apiClient.post<any>(`/games/${id}/start-onchain-agent-vs-agent`, {});
      const game = (res as any)?.data?.data;
      const gameCode = game?.code || lobby?.code || "";
      toast.success("Game started on-chain. Share the board link with other players so they can watch.");
      router.push(`/board-3d-multi?gameCode=${encodeURIComponent(gameCode)}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to start game";
      toast.error(msg);
    } finally {
      setStartingLobby(false);
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
        ) : loadingLobby ? (
          <div className="flex items-center justify-center py-16 gap-3 text-cyan-300">
            <Loader2 className="w-10 h-10 animate-spin" />
            <span className="font-orbitron">Loading lobby…</span>
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
        ) : lobby ? (
          <div className="space-y-6">
            <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200">Agent vs Agent lobby</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Code: <span className="font-mono text-slate-200">{lobby.code}</span> · Players:{" "}
                    <span className="text-slate-200">{lobby.number_of_players}</span> · Status:{" "}
                    <span className="text-slate-200">{lobby.status}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshLobby}
                  className="shrink-0 px-3 py-2 rounded-xl border border-slate-600 text-slate-200 hover:bg-white/5 text-xs font-semibold"
                >
                  Refresh
                </button>
              </div>
            </div>

            {lobby.status === "RUNNING" && lobby.code ? (
              <div className="bg-emerald-950/60 rounded-2xl p-6 border border-emerald-500/50">
                <p className="text-sm font-semibold text-emerald-200 mb-2">Game in progress</p>
                <p className="text-xs text-slate-300 mb-4">
                  The game has started. You can watch immediately on the board (we'll redirect you too).
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-lg text-white bg-black/40 px-3 py-2 rounded-lg">{lobby.code}</span>
                  <button
                    type="button"
                    onClick={() => router.push(`/board-3d-multi?gameCode=${encodeURIComponent(lobby.code)}`)}
                    className="px-5 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#0FF0FC] text-[#010F10] font-bold"
                  >
                    Go to board
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      const url = `${origin}/board-3d-multi?gameCode=${encodeURIComponent(lobby.code)}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Board link copied");
                      } catch {
                        toast.error("Could not copy link");
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-500 text-slate-200 hover:bg-white/5 text-sm font-medium"
                  >
                    Copy board link
                  </button>
                </div>
              </div>
            ) : null}

            <div className="bg-black/60 rounded-2xl p-6 border border-purple-500/30">
              <p className="text-sm font-semibold text-slate-200 mb-4">Slots</p>
              <div className="space-y-3">
                {lobby.invites?.map((inv) => (
                  <div key={inv.id} className="flex flex-col gap-2">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between border border-white/5 rounded-xl p-4">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200">
                        <span className="font-mono text-slate-400">Slot {inv.slot}</span>{" "}
                        <span className="text-slate-500">·</span>{" "}
                        <span className={inv.status === "ACCEPTED" ? "text-emerald-300" : "text-amber-300"}>
                          {inv.status}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {inv.status === "ACCEPTED"
                          ? `Agent: ${inv.agent_name || "—"}`
                          : "Share the invite link or QR so another user can accept with their own agent."}
                      </p>
                    </div>
                    {inv.status === "OPEN" ? (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyInvite(inv.token)}
                          className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQrForSlot(showQrForSlot === inv.slot ? null : inv.slot)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                            showQrForSlot === inv.slot
                              ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                              : "border-slate-500 text-slate-200 hover:bg-white/5"
                          }`}
                        >
                          <QrCode className="w-4 h-4" />
                          {showQrForSlot === inv.slot ? "Hide QR" : "Share QR"}
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 shrink-0">—</div>
                    )}
                    </div>
                  {inv.status === "OPEN" && showQrForSlot === inv.slot && (() => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    const id = lobby?.id ?? lobbyIdParam;
                    const qrUrl = `${origin}/agent-battles?lobby=${encodeURIComponent(String(id))}&token=${encodeURIComponent(inv.token)}`;
                    return (
                      <div className="mt-2 flex justify-center p-4 bg-black/40 rounded-xl border border-white/10">
                        <div className="flex flex-col items-center gap-2">
                          <QRCodeSVG value={qrUrl} size={160} level="M" className="rounded-lg" />
                          <p className="text-xs text-slate-400">Scan to accept this seat (only works while lobby is pending)</p>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                ))}
              </div>
            </div>

            {lobbyTokenParam ? (
              <div className="bg-black/60 rounded-2xl p-6 border border-emerald-500/30">
                {lobby?.status !== "PENDING" ? (
                  <>
                    <p className="text-sm font-semibold text-slate-200 mb-2">Game already started</p>
                    <p className="text-xs text-slate-400 mb-4">
                      This invite seat can only be accepted while the lobby is pending. Opening the board for you instead.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const code = lobby?.code || "";
                        if (!code) return;
                        router.push(`/board-3d-multi?gameCode=${encodeURIComponent(code)}`);
                      }}
                      disabled={!lobby?.code}
                      className="w-full md:w-auto px-5 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#0FF0FC] text-[#010F10] font-bold disabled:opacity-60"
                    >
                      Go to board
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-200 mb-2">Accept seat</p>
                    <p className="text-xs text-slate-400 mb-4">
                      Pick one of your agents and accept the seat linked from the invite.
                    </p>
                    <div className="flex flex-col md:flex-row gap-3 items-center">
                      <select
                        value={selectedAgentIds[0] ?? 0}
                        onChange={(e) => setSelectedAgentIds([Number(e.target.value)])}
                        className="flex-1 w-full px-3 py-3 rounded-xl bg-black/70 border border-slate-600 text-white"
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAcceptSeat}
                        disabled={accepting}
                        className="w-full md:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold"
                      >
                        {accepting ? "Accepting…" : "Accept seat"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {meId != null && Number(lobby.creator_id) === Number(meId) && lobby.status === "PENDING" ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleStartLobby}
                  disabled={
                    startingLobby ||
                    !(lobby.invites?.length === lobby.number_of_players && lobby.invites.every((i) => i.status === "ACCEPTED"))
                  }
                  className="px-10 py-4 text-xl font-orbitron font-black tracking-widest bg-[#00F0FF] hover:bg-[#0FF0FC] text-[#010F10] rounded-2xl shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border-4 border-[#00F0FF]/40"
                >
                  {startingLobby ? "STARTING…" : "START ON-CHAIN"}
                </button>
              </div>
            ) : null}
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

            <div className="grid md:grid-cols-2 gap-6">
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
                {mode === "agent_vs_agent" ? "Your agent (Slot 1)" : "Pick your agent"}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                {mode === "agent_vs_agent"
                  ? "Other seats are filled via invite links. Share the link or QR from the lobby after creating."
                  : "This agent will play for you against the AI."}
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {Array.from({ length: 1 }).map((_, idx) => (
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

