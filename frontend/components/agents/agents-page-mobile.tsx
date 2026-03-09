"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { House, Plus, Pencil, Trash2, Bot, Loader2, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { toast } from "react-toastify";

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

export default function AgentsPageMobile() {
  const router = useRouter();
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);
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
    if (!confirm("Delete this agent?")) return;
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
    return (
      <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-4 pt-24">
        <div className="max-w-sm w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-6 text-center">
          <Bot className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Sign in required</h2>
          <p className="text-gray-400 text-sm mb-5">
            Sign in or connect your wallet to manage your AI agents.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col px-4 pt-24 pb-10">
      <div className="max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 text-sm"
          >
            <House className="w-4 h-4" />
            <span className="font-bold">BACK</span>
          </button>
          <h1 className="text-xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            MY AGENTS
          </h1>
          <div className="w-14" />
        </div>

        <p className="text-gray-400 text-xs mb-4">
          Add agents by URL to use in AI games. Agent must expose <code className="text-cyan-400/90">POST /decision</code>.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-cyan-400 text-sm">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {agents.length === 0 && !showForm && (
                <div className="bg-black/60 rounded-xl border border-cyan-500/30 p-6 text-center text-gray-400 text-sm">
                  <Bot className="w-10 h-10 text-cyan-500/50 mx-auto mb-2" />
                  <p>No agents yet.</p>
                </div>
              )}
              {agents.map((a) => (
                <div
                  key={a.id}
                  className="bg-black/60 rounded-xl border border-cyan-500/30 p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{a.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {a.callback_url ? (
                        <span className="flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {a.callback_url}
                        </span>
                      ) : (
                        "No URL"
                      )}
                    </p>
                    {a.erc8004_agent_id && (
                      <p className="text-xs text-purple-400">ERC-8004: {a.erc8004_agent_id}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="p-2 rounded-lg border border-cyan-500/40 text-cyan-400"
                      aria-label="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="p-2 rounded-lg border border-red-500/40 text-red-400"
                      aria-label="Delete"
                    >
                      {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {showForm ? (
              <form onSubmit={handleSubmit} className="bg-black/60 rounded-xl border border-cyan-500/30 p-4 space-y-3 mb-6">
                <h3 className="text-sm font-bold text-cyan-300">{editingId ? "Edit" : "New agent"}</h3>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Name *"
                  className="w-full px-3 py-2.5 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm"
                  required
                />
                <input
                  type="url"
                  value={formCallbackUrl}
                  onChange={(e) => setFormCallbackUrl(e.target.value)}
                  placeholder="Callback URL"
                  className="w-full px-3 py-2.5 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm"
                />
                <input
                  type="text"
                  value={formErc8004Id}
                  onChange={(e) => setFormErc8004Id(e.target.value)}
                  placeholder="ERC-8004 ID (optional)"
                  className="w-full px-3 py-2.5 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg text-sm flex items-center justify-center gap-1"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingId ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2.5 rounded-lg border border-gray-500 text-gray-400 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-cyan-500/50 text-cyan-400 text-sm"
              >
                <Plus className="w-4 h-4" />
                Create agent
              </button>
            )}
            <p className="text-gray-500 text-xs mt-4">
              <a href="/play-ai" className="text-cyan-400">Play vs AI</a> — use your agents when creating a game (coming soon).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
