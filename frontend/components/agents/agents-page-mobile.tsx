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
  use_tycoon_key?: boolean;
  created_at: string;
  updated_at: string;
}

type HostingType = "tycoon" | "my_key" | "my_url";

export default function AgentsPageMobile() {
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
  const [formHostingType, setFormHostingType] = useState<HostingType>("tycoon");
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
            if (r.data?.success && Array.isArray(r.data.data)) setAgents(r.data.data);
          } finally {
            setLoading(false);
          }
        } else {
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
    setFormHostingType("tycoon");
  };

  const openEdit = (a: UserAgent) => {
    setEditingId(a.id);
    setFormName(a.name);
    setFormCallbackUrl(a.callback_url || "");
    setFormErc8004Id(a.erc8004_agent_id || "");
    setFormProvider(a.provider || "anthropic");
    setFormApiKey("");
    setFormClearApiKey(false);
    setFormHostingType(
      a.use_tycoon_key ? "tycoon" : a.has_api_key ? "my_key" : a.callback_url ? "my_url" : "tycoon"
    );
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (formHostingType === "my_url" && !formCallbackUrl.trim()) {
      toast.error("Callback URL required");
      return;
    }
    if (formHostingType === "my_key" && !editingId && !formApiKey.trim()) {
      toast.error("API key required");
      return;
    }
    setSubmitting(true);
    try {
      const useTycoonKey = formHostingType === "tycoon";
      const payload: Record<string, unknown> = {
        name,
        callback_url: formHostingType === "my_url" ? formCallbackUrl.trim() || null : null,
        erc8004_agent_id: formErc8004Id.trim() || null,
        provider: formProvider.trim() || "anthropic",
        use_tycoon_key: useTycoonKey,
      };
      if (formHostingType === "my_key") {
        if (formApiKey.trim()) payload.api_key = formApiKey.trim();
        else if (editingId && formClearApiKey) payload.api_key = null;
      }
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
    const hasWallet = isConnected && !!address;
    if (hasWallet && !walletNotRegistered) {
      return (
        <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-4 pt-24">
          <div className="max-w-sm w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-6 text-center">
            {linkingWallet ? (
              <>
                <Loader2 className="w-14 h-14 text-cyan-400 mx-auto mb-3 animate-spin" />
                <p className="text-cyan-300 font-medium text-sm">Linking your wallet...</p>
                <p className="text-gray-400 text-xs mt-2">Approve the signature in your wallet</p>
              </>
            ) : (
              <>
                <Bot className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
                <p className="text-cyan-300 font-medium text-sm mb-2">Approve the signature in your wallet to continue</p>
                <button
                  onClick={() => setWalletLinkRetry((n) => n + 1)}
                  className="w-full py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl text-sm"
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
        <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-4 pt-24">
          <div className="max-w-sm w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-6 text-center">
            <Bot className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Account needed</h2>
            <p className="text-gray-400 text-sm mb-5">
              This wallet isn’t linked to a Tycoon account yet. Create or link an account from the home page, then return here.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl text-sm"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
    if (!hasWallet) {
      return (
        <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-4 pt-24">
          <div className="max-w-sm w-full bg-black/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-6 text-center">
            <Bot className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Connect your wallet</h2>
            <p className="text-gray-400 text-sm mb-5">
              Connect your wallet to create and manage your AI agents.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-xl text-sm"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
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
                      {a.use_tycoon_key ? (
                        <span className="text-cyan-400/90">Tycoon-hosted</span>
                      ) : a.callback_url ? (
                        <span className="flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {a.callback_url}
                        </span>
                      ) : a.has_api_key ? (
                        <span className="flex items-center gap-0.5 text-cyan-400/90">
                          <Key className="w-3 h-3 shrink-0" />
                          API key saved
                        </span>
                      ) : (
                        "No URL or key"
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
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">How it runs</label>
                  <select
                    value={formHostingType}
                    onChange={(e) => setFormHostingType(e.target.value as HostingType)}
                    className="w-full px-3 py-2.5 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm"
                  >
                    <option value="tycoon">Tycoon-hosted</option>
                    <option value="my_key">My API key</option>
                    <option value="my_url">My URL</option>
                  </select>
                </div>
                {formHostingType === "my_url" && (
                  <input
                    type="url"
                    value={formCallbackUrl}
                    onChange={(e) => setFormCallbackUrl(e.target.value)}
                    placeholder="Callback URL *"
                    className="w-full px-3 py-2.5 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm"
                  />
                )}
                {formHostingType === "my_key" && (
                  <div>
                    <select
                      value={formProvider}
                      onChange={(e) => setFormProvider(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm"
                    >
                      <option value="anthropic">Claude (Anthropic)</option>
                    </select>
                    <input
                      type="password"
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                      placeholder={editingId ? "Leave blank to keep" : "API key *"}
                      className="w-full px-3 py-2.5 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm mt-1"
                      autoComplete="off"
                    />
                    {editingId && (
                      <label className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <input
                          type="checkbox"
                          checked={formClearApiKey}
                          onChange={(e) => setFormClearApiKey(e.target.checked)}
                          className="rounded border-cyan-500/40"
                        />
                        Clear saved key
                      </label>
                    )}
                  </div>
                )}
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
