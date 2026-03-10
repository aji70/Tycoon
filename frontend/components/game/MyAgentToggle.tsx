"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { Bot, Key, Loader2 } from "lucide-react";

export interface UserAgentOption {
  id: number;
  name: string;
  callback_url: string | null;
  hosted_url: string | null;
  has_api_key?: boolean;
  use_tycoon_key?: boolean;
}

/** When user chooses "Use my API key" (Option B) — key is not stored, only passed to parent for the session. */
export interface MyAgentApiKeyState {
  provider: string;
  apiKey: string;
}

interface MyAgentToggleProps {
  gameId: number | null | undefined;
  myAgentOn: boolean;
  onBindingsChange?: () => void;
  /** API key mode (user's key in memory). When set, "my agent" is on via proxy. */
  myAgentApiKey?: MyAgentApiKeyState | null;
  onUseApiKey?: (opts: MyAgentApiKeyState) => void;
  onStopApiKey?: () => void;
  /** Compact style for sidebar */
  compact?: boolean;
}

const PROVIDERS = [{ id: "anthropic", name: "Claude (Anthropic)" }];

export function MyAgentToggle({
  gameId,
  myAgentOn,
  onBindingsChange,
  myAgentApiKey = null,
  onUseApiKey,
  onStopApiKey,
  compact,
}: MyAgentToggleProps) {
  const [agents, setAgents] = useState<UserAgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [turningOn, setTurningOn] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const [apiKeyProvider, setApiKeyProvider] = useState("anthropic");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [useApiKeyBusy, setUseApiKeyBusy] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await apiClient.get<ApiResponse<UserAgentOption[]>>("/agents");
      if (res.data?.success && Array.isArray(res.data.data)) {
        const usable = (res.data.data as UserAgentOption[]).filter(
          (a) => a.use_tycoon_key || (a.hosted_url || a.callback_url)?.startsWith("http") || a.has_api_key
        );
        setAgents(usable);
        if (usable.length > 0 && !selectedAgentId) setSelectedAgentId(usable[0].id);
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

  const agentOn = myAgentOn || !!myAgentApiKey;

  const handleTurnOffAny = useCallback(() => {
    if (myAgentApiKey) {
      onStopApiKey?.();
    } else {
      handleTurnOff();
    }
  }, [myAgentApiKey, onStopApiKey, handleTurnOff]);

  const handleUseApiKey = useCallback(() => {
    const key = apiKeyInput.trim();
    if (!key || !onUseApiKey) return;
    setUseApiKeyBusy(true);
    onUseApiKey({ provider: apiKeyProvider, apiKey: key });
    setApiKeyInput("");
    setUseApiKeyBusy(false);
  }, [apiKeyInput, apiKeyProvider, onUseApiKey]);

  if (!gameId) return null;

  const busy = turningOn || turningOff;

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-600/60 bg-slate-800/60 p-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" />
            My agent
          </span>
          {agentOn ? (
            <button
              type="button"
              onClick={handleTurnOffAny}
              disabled={busy}
              className="text-xs px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-white disabled:opacity-50"
            >
              {turningOff ? <Loader2 className="w-3 h-3 animate-spin" /> : "On"}
            </button>
          ) : (
            <>
              {agents.length > 0 ? (
                <>
                  <span className="text-[10px] text-slate-400 shrink-0">My Agents:</span>
                  <select
                    value={selectedAgentId ?? ""}
                    onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                    className="text-xs bg-slate-700 border border-slate-500 rounded px-1.5 py-0.5 text-slate-200 min-w-0"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTurnOn}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 shrink-0"
                  >
                    {turningOn ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use"}
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-slate-500">
                  <Link href="/agents" className="text-cyan-400 hover:underline">My Agents</Link> — add one to use here
                </span>
              )}
            </>
          )}
        </div>
        {!agentOn && onUseApiKey && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Key className="w-3 h-3" /> Or paste API key (no server)
            </span>
            <input
              type="password"
              placeholder="Claude API key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="text-xs bg-slate-700 border border-slate-500 rounded px-2 py-1 text-slate-200 placeholder:text-slate-500"
            />
            <p className="text-[10px] text-slate-500">Remembered until you close this tab. Not stored on our servers.</p>
            <button
              type="button"
              onClick={handleUseApiKey}
              disabled={useApiKeyBusy || !apiKeyInput.trim()}
              className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
            >
              Use key
            </button>
          </div>
        )}
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
      ) : agentOn ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400">{myAgentApiKey ? "Playing with your API key" : "Agent is playing"}</span>
          <button
            type="button"
            onClick={handleTurnOffAny}
            disabled={busy}
            className="text-xs px-2 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            {turningOff ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Turn off"}
          </button>
        </div>
      ) : (
        <>
          {agents.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-400">Use an agent from <Link href="/agents" className="text-cyan-400 hover:underline">My Agents</Link></span>
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
          ) : (
            <p className="text-xs text-slate-400">
              Add agents in <Link href="/agents" className="text-cyan-400 hover:underline">My Agents</Link> (name + URL) to use one here
              {onUseApiKey ? " — or use your API key below." : "."}
            </p>
          )}
          {onUseApiKey && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-600">
              <span className="text-xs text-slate-400 flex items-center gap-1"><Key className="w-3.5 h-3.5" /> Or paste your API key (not stored)</span>
              <select
                value={apiKeyProvider}
                onChange={(e) => setApiKeyProvider(e.target.value)}
                className="text-sm bg-slate-700 border border-slate-500 rounded-lg px-2 py-1.5 text-slate-200"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="password"
                placeholder="Paste your API key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="text-sm bg-slate-700 border border-slate-500 rounded-lg px-2 py-1.5 text-slate-200 placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">Remembered until you close this tab. Not stored on our servers.</p>
              <button
                type="button"
                onClick={handleUseApiKey}
                disabled={useApiKeyBusy || !apiKeyInput.trim()}
                className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                Use my key
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
