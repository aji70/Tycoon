"use client";

import React, { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { Bot, Loader2 } from "lucide-react";

export interface UserAgentOption {
  id: number;
  name: string;
  callback_url: string | null;
  hosted_url: string | null;
}

interface MyAgentToggleProps {
  gameId: number | null | undefined;
  myAgentOn: boolean;
  onBindingsChange?: () => void;
  /** Compact style for sidebar */
  compact?: boolean;
}

export function MyAgentToggle({ gameId, myAgentOn, onBindingsChange, compact }: MyAgentToggleProps) {
  const [agents, setAgents] = useState<UserAgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [turningOn, setTurningOn] = useState(false);
  const [turningOff, setTurningOff] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await apiClient.get<ApiResponse<UserAgentOption[]>>("/agents");
      if (res.data?.success && Array.isArray(res.data.data)) {
        const withUrl = (res.data.data as UserAgentOption[]).filter(
          (a) => (a.hosted_url || a.callback_url)?.startsWith("http")
        );
        setAgents(withUrl);
        if (withUrl.length > 0 && !selectedAgentId) setSelectedAgentId(withUrl[0].id);
      } else {
        setAgents([]);
      }
    } catch {
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (gameId) fetchAgents();
  }, [gameId, fetchAgents]);

  const handleTurnOn = useCallback(async () => {
    if (!gameId || !selectedAgentId) return;
    setTurningOn(true);
    try {
      await apiClient.post(`/games/${gameId}/use-my-agent`, { user_agent_id: selectedAgentId });
      onBindingsChange?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to use agent";
      console.error(msg);
    } finally {
      setTurningOn(false);
    }
  }, [gameId, selectedAgentId, onBindingsChange]);

  const handleTurnOff = useCallback(async () => {
    if (!gameId) return;
    setTurningOff(true);
    try {
      await apiClient.post(`/games/${gameId}/stop-using-my-agent`);
      onBindingsChange?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to stop agent";
      console.error(msg);
    } finally {
      setTurningOff(false);
    }
  }, [gameId, onBindingsChange]);

  if (!gameId) return null;

  const busy = turningOn || turningOff;

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-600/60 bg-slate-800/60 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" />
            My agent
          </span>
          {myAgentOn ? (
            <button
              type="button"
              onClick={handleTurnOff}
              disabled={busy}
              className="text-xs px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-white disabled:opacity-50"
            >
              {turningOff ? <Loader2 className="w-3 h-3 animate-spin" /> : "On"}
            </button>
          ) : (
            <>
              {agents.length > 0 ? (
                <select
                  value={selectedAgentId ?? ""}
                  onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                  className="text-xs bg-slate-700 border border-slate-500 rounded px-1.5 py-0.5 text-slate-200"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={handleTurnOn}
                disabled={busy || agents.length === 0}
                className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-50"
              >
                {turningOn ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-800/80 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold text-cyan-300">My agent plays for me</h3>
      </div>
      {loadingAgents ? (
        <p className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading agents...</p>
      ) : myAgentOn ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400">Agent is playing</span>
          <button
            type="button"
            onClick={handleTurnOff}
            disabled={busy}
            className="text-xs px-2 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            {turningOff ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Turn off"}
          </button>
        </div>
      ) : agents.length === 0 ? (
        <p className="text-xs text-slate-400">Add an agent in My Agents and set its URL to use it here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <select
            value={selectedAgentId ?? ""}
            onChange={(e) => setSelectedAgentId(Number(e.target.value))}
            className="text-sm bg-slate-700 border border-slate-500 rounded-lg px-2 py-1.5 text-slate-200"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleTurnOn}
            disabled={busy}
            className="text-sm px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {turningOn ? <Loader2 className="w-4 h-4 animate-spin" /> : "Use this agent"}
          </button>
        </div>
      )}
    </div>
  );
}
