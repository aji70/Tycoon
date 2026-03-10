"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { House, Plus, Pencil, Trash2, Bot, Loader2, ExternalLink, Key } from "lucide-react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { toast } from "react-toastify";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";

function chainIdToBackendChain(chainId: number): string {
  if (chainId === 137 || chainId === 80001) return "POLYGON";
  if (chainId === 42220 || chainId === 44787) return "CELO";
  if (chainId === 8453 || chainId === 84531) return "BASE";
  return "CELO";
}

export interface UserAgent {
  id: number;
  user_id: number;
  name: string;
  callback_url: string | null;
  config: Record<string, unknown> | null;
  status: string;
  hosted_url: string | null;
  erc8004_agent_id: string | null;
  chain_id: number | null;
  provider?: string | null;
  has_api_key?: boolean;
  created_at: string;
  updated_at: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const guestAuth = useGuestAuthOptional();
  const triedWalletAutoLogin = React.useRef(false);
  const [walletLinkRetry, setWalletLinkRetry] = useState(0);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [walletNotRegistered, setWalletNotRegistered] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formCallbackUrl, setFormCallbackUrl] = useState("");
  const [formErc8004Id, setFormErc8004Id] = useState("");
  const [formProvider, setFormProvider] = useState("anthropic");
  const [formApiKey, setFormApiKey] = useState("");
  const [formClearApiKey, setFormClearApiKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAgents = React.useCallback(async () => {
    setLoading(true);
    setAuthFailed(false);
    setWalletNotRegistered(false);
    try {
      const res = await apiClient.get<ApiResponse<UserAgent[]>>("/agents");
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAgents(res.data.data);
      } else {
        setAgents([]);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setAuthFailed(true);
        setAgents([]);
      } else {
        toast.error("Failed to load agents");
        setAgents([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // When a connected wallet user gets 401, automatically link wallet (one signature) so they can use Agents
  React.useEffect(() => {
    if (!authFailed || !isConnected || !address) return;
    if (!guestAuth?.loginByWallet || !signMessageAsync) return;
    if (triedWalletAutoLogin.current && walletLinkRetry === 0) return;
    triedWalletAutoLogin.current = true;
    setLinkingWallet(true);
    const message = `Sign in to Tycoon at ${Date.now()}`;
    const chain = chainIdToBackendChain(chainId);
    signMessageAsync({ message })
      .then((signature) => guestAuth.loginByWallet!({ address, chain, message, signature }))
      .then(async (res) => {
        if (res.success) {
          await guestAuth.refetchGuest?.();
          setWalletNotRegistered(false);
          setAuthFailed(false);
          setLoading(true);
          try {
            const r = await apiClient.get<ApiResponse<UserAgent[]>>("/agents");
            if (r.data?.success && Array.isArray(r.data.data)) {
              setAgents(r.data.data);
            }
          } finally {
            setLoading(false);
          }
        } else {
          // Only show "Account needed" when backend says no user (404 / "No account")
          const msg = (res.message ?? "").toLowerCase();
          const isNoAccount = msg.includes("no account") || msg.includes("not found") || msg.includes("register");
          setWalletNotRegistered(isNoAccount);
          if (!isNoAccount) {
            triedWalletAutoLogin.current = false;
            toast.error(res.message ?? "Could not link wallet");
          }
        }
      })
      .catch((err) => {
        // User rejected signature or network error – don't treat as "not registered"; allow retry
        triedWalletAutoLogin.current = false;
        const msg = (err as Error)?.message ?? "";
        if (!msg.toLowerCase().includes("reject") && !msg.toLowerCase().includes("denied")) {
          toast.error("Could not link wallet. Try again.");
        }
      })
      .finally(() => setLinkingWallet(false));
  }, [authFailed, isConnected, address, chainId, guestAuth, signMessageAsync, walletLinkRetry]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormCallbackUrl("");
    setFormErc8004Id("");
    setFormProvider("anthropic");
    setFormApiKey("");
    setFormClearApiKey(false);
  };

  const openEdit = (a: UserAgent) => {
    setEditingId(a.id);
    setFormName(a.name);
    setFormCallbackUrl(a.callback_url || "");
    setFormErc8004Id(a.erc8004_agent_id || "");
    setFormProvider(a.provider || "anthropic");
    setFormApiKey(""); // never show existing key; leave blank to keep
    setFormClearApiKey(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        callback_url: formCallbackUrl.trim() || null,
        erc8004_agent_id: formErc8004Id.trim() || null,
        provider: formProvider.trim() || "anthropic",
      };
      if (formApiKey.trim()) payload.api_key = formApiKey.trim();
      else if (editingId && formClearApiKey) payload.api_key = null; // clear saved key
      if (editingId) {
        await apiClient.patch<ApiResponse<UserAgent>>(`/agents/${editingId}`, payload);
        toast.success("Agent updated");
      } else {
        await apiClient.post<ApiResponse<UserAgent>>("/agents", { ...payload, chain_id: 42220 });
        toast.success("Agent created");
      }
      resetForm();
      await fetchAgents();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Request failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this agent? You can add it again later.")) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/agents/${id}`);
      toast.success("Agent deleted");
      await fetchAgents();
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setDeletingId(null);
    }
  };

  if (authFailed) {
    const hasWallet = isConnected && !!address;
    if (hasWallet && !walletNotRegistered) {
      return (
        <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-8 text-center">
            {linkingWallet ? (
              <>
                <Loader2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-spin" />
                <p className="text-cyan-300 font-medium">Linking your wallet...</p>
                <p className="text-gray-400 text-sm mt-2">Approve the signature in your wallet</p>
              </>
            ) : (
              <>
                <Bot className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
                <p className="text-cyan-300 font-medium mb-2">Approve the signature in your wallet to continue</p>
                <button
                  onClick={() => setWalletLinkRetry((n) => n + 1)}
                  className="px-6 py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl hover:bg-[#0FF0FC] transition"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      );
    }
    if (hasWallet && walletNotRegistered) {
      return (
        <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-8 text-center">
            <Bot className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Account needed</h2>
            <p className="text-gray-400 mb-6">
              This wallet isn’t linked to a Tycoon account yet. Create or link an account from the home page, then return here to manage your agents.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full px-6 py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl hover:bg-[#0FF0FC] transition"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
    if (!hasWallet) {
      return (
        <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-8 text-center">
            <Bot className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Connect your wallet</h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to create and manage your AI agents.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full px-6 py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl hover:bg-[#0FF0FC] transition"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col p-6">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            <House className="w-5 h-5" />
            <span className="font-bold">BACK</span>
          </button>
          <h1 className="text-3xl md:text-4xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            MY AGENTS
          </h1>
          <div className="w-20" />
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Create agents by URL to use in AI games. Your agent must expose <code className="text-cyan-400/90">POST /decision</code> (e.g. Tycoon Celo Agent).
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-cyan-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="font-orbitron">Loading agents...</span>
          </div>
        ) : (
          <>
            {/* List */}
            <div className="space-y-4 mb-8">
              {agents.length === 0 && !showForm && (
                <div className="bg-black/60 rounded-2xl border border-cyan-500/30 p-8 text-center text-gray-400">
                  <Bot className="w-12 h-12 text-cyan-500/50 mx-auto mb-3" />
                  <p>No agents yet. Create one to use in Play vs AI.</p>
                </div>
              )}
              {agents.map((a) => (
                <div
                  key={a.id}
                  className="bg-black/60 rounded-2xl border border-cyan-500/30 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{a.name}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {a.callback_url ? (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {a.callback_url}
                        </span>
                      ) : a.has_api_key ? (
                        <span className="flex items-center gap-1 text-cyan-400/90">
                          <Key className="w-3 h-3 shrink-0" />
                          API key saved
                        </span>
                      ) : (
                        "No URL or API key (draft)"
                      )}
                    </p>
                    {a.has_api_key && !a.callback_url && (
                      <p className="text-xs text-cyan-400/80 mt-0.5">Uses saved key (e.g. Claude)</p>
                    )}
                    {a.erc8004_agent_id && (
                      <p className="text-xs text-purple-400 mt-1">ERC-8004: {a.erc8004_agent_id}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(a)}
                      className="p-2 rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="p-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                      aria-label="Delete"
                    >
                      {deletingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Create / Edit form */}
            {showForm ? (
              <form onSubmit={handleSubmit} className="bg-black/60 rounded-2xl border border-cyan-500/30 p-6 space-y-4 mb-8">
                <h3 className="text-lg font-bold text-cyan-300">{editingId ? "Edit agent" : "New agent"}</h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Tycoon Bot"
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Callback URL</label>
                  <input
                    type="url"
                    value={formCallbackUrl}
                    onChange={(e) => setFormCallbackUrl(e.target.value)}
                    placeholder="https://your-agent.example.com"
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Provider (for API key)</label>
                  <select
                    value={formProvider}
                    onChange={(e) => setFormProvider(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/40 text-white focus:border-cyan-400 outline-none"
                  >
                    <option value="anthropic">Claude (Anthropic)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API key (optional)</label>
                  <input
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder={editingId ? "Leave blank to keep existing; enter new to change" : "Save a key to use agent without callback URL"}
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 outline-none"
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500 mt-1">Stored encrypted. Used when you choose this agent on the board (no callback URL needed).</p>
                  {editingId && (
                    <label className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                      <input
                        type="checkbox"
                        checked={formClearApiKey}
                        onChange={(e) => setFormClearApiKey(e.target.checked)}
                        className="rounded border-cyan-500/40"
                      />
                      Clear saved API key
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">ERC-8004 Agent ID (optional)</label>
                  <input
                    type="text"
                    value={formErc8004Id}
                    onChange={(e) => setFormErc8004Id(e.target.value)}
                    placeholder="From Celo / agentscan"
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl hover:bg-[#0FF0FC] transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingId ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 rounded-xl border border-gray-500 text-gray-400 hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-dashed border-cyan-500/50 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10 transition"
              >
                <Plus className="w-5 h-5" />
                Create agent
              </button>
            )}
          </>
        )}

        <p className="text-gray-500 text-sm mt-6">
          <a href="/play-ai" className="text-cyan-400 hover:underline">Play vs AI</a> — use one of your agents when creating a game (coming soon).
        </p>
      </div>
    </div>
  );
}
