"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { House, Plus, Pencil, Trash2, Bot, Loader2, ExternalLink, Wallet } from "lucide-react";
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
  created_at: string;
  updated_at: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const guestAuth = useGuestAuthOptional();
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formCallbackUrl, setFormCallbackUrl] = useState("");
  const [formErc8004Id, setFormErc8004Id] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAgents = React.useCallback(async () => {
    setLoading(true);
    setAuthFailed(false);
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

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormCallbackUrl("");
    setFormErc8004Id("");
  };

  const openEdit = (a: UserAgent) => {
    setEditingId(a.id);
    setFormName(a.name);
    setFormCallbackUrl(a.callback_url || "");
    setFormErc8004Id(a.erc8004_agent_id || "");
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
      if (editingId) {
        await apiClient.patch<ApiResponse<UserAgent>>(`/agents/${editingId}`, {
          name,
          callback_url: formCallbackUrl.trim() || null,
          erc8004_agent_id: formErc8004Id.trim() || null,
        });
        toast.success("Agent updated");
      } else {
        await apiClient.post<ApiResponse<UserAgent>>("/agents", {
          name,
          callback_url: formCallbackUrl.trim() || null,
          erc8004_agent_id: formErc8004Id.trim() || null,
          chain_id: 42220,
        });
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

  const handleSignInWithWallet = async () => {
    if (!address || !guestAuth?.loginByWallet || !signMessageAsync) return;
    setSignInLoading(true);
    try {
      const message = `Sign in to Tycoon at ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      const chain = chainIdToBackendChain(chainId);
      const res = await guestAuth.loginByWallet({ address, chain, message, signature });
      if (res.success) {
        await guestAuth.refetchGuest?.();
        setAuthFailed(false);
        await fetchAgents();
        toast.success("Signed in");
      } else {
        toast.error(res.message ?? "Sign in failed. Register on-chain first (e.g. from Play vs AI).");
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Sign in failed");
    } finally {
      setSignInLoading(false);
    }
  };

  if (authFailed) {
    const hasWallet = isConnected && !!address;
    return (
      <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-8 text-center">
          <Bot className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
          <p className="text-gray-400 mb-6">
            Sign in or connect your wallet to create and manage your AI agents.
          </p>
          <div className="flex flex-col gap-3">
            {hasWallet && guestAuth?.loginByWallet && (
              <button
                onClick={handleSignInWithWallet}
                disabled={signInLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl hover:bg-[#0FF0FC] transition disabled:opacity-70"
              >
                {signInLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                Sign in with wallet
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="w-full px-6 py-3 rounded-xl border border-cyan-500/50 text-cyan-400 font-medium hover:bg-cyan-500/10 transition"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
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
                      ) : (
                        "No URL (draft)"
                      )}
                    </p>
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
