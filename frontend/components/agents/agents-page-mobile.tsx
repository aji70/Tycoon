"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { House, Plus, Pencil, Trash2, Bot, Loader2, ExternalLink, Key, ShieldCheck, Server, Link2, CheckCircle2, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { toast } from "react-toastify";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useRegisterAgentERC8004, useVerifyErc8004AgentId } from "@/context/ContractProvider";

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

type HostedCreditsData = {
  balance: number;
  daily: { used: number; cap: number; remaining: number };
  purchase_usdc_available?: boolean;
  purchase_ngn_available?: boolean;
  usdc_recipient?: string | null;
};

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
  const [formSkill, setFormSkill] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [registeringErc8004Id, setRegisteringErc8004Id] = useState<number | null>(null);
  const { register: registerOnCelo, isPending: isRegisteringErc8004 } = useRegisterAgentERC8004();
  const { verifyAgentId, isCelo } = useVerifyErc8004AgentId();
  const [verifyingErc8004, setVerifyingErc8004] = useState(false);
  const [erc8004VerifyResult, setErc8004VerifyResult] = useState<{ valid: boolean; isOwner?: boolean; error?: string } | null>(null);
  const [hostedCredits, setHostedCredits] = useState<HostedCreditsData | null>(null);

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
      const credRes = await apiClient.get<ApiResponse<HostedCreditsData>>("/agents/hosted-credits");
      if (credRes.data?.success && credRes.data.data) setHostedCredits(credRes.data.data);
      else setHostedCredits(null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setAuthFailed(true);
        setAgents([]);
      } else {
        toast.error("Failed to load agents");
        setAgents([]);
      }
      setHostedCredits(null);
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
    setFormSkill("");
    setErc8004VerifyResult(null);
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
    setFormSkill(typeof a.config?.skill === "string" ? a.config.skill : "");
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
      const existingConfig = editingId ? agents.find((x) => x.id === editingId)?.config : undefined;
      const configPayload: Record<string, unknown> = existingConfig && typeof existingConfig === "object" ? { ...existingConfig } : {};
      if (formSkill.trim()) configPayload.skill = formSkill.trim();
      else delete configPayload.skill;
      payload.config = Object.keys(configPayload).length > 0 ? configPayload : null;
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

  const handleRegisterOnCelo = async (a: UserAgent) => {
    if (!isCelo) {
      toast.error("Switch to Celo to register on ERC-8004");
      return;
    }
    if (a.erc8004_agent_id) {
      toast.info("Already registered on Celo");
      return;
    }
    setRegisteringErc8004Id(a.id);
    try {
      const newAgentId = await registerOnCelo(a.id);
      if (newAgentId != null) {
        await apiClient.patch<ApiResponse<UserAgent>>(`/agents/${a.id}`, { erc8004_agent_id: String(newAgentId) });
        toast.success(`Registered on Celo. ID: ${newAgentId}`);
        await fetchAgents();
      } else {
        toast.error("Registration succeeded but could not read agent ID");
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Registration failed");
    } finally {
      setRegisteringErc8004Id(null);
    }
  };

  const handleCreateOnCeloFromForm = async () => {
    if (!editingId) {
      toast.info("Save the agent first, then use Create on Celo to get an ERC-8004 ID.");
      return;
    }
    if (!isCelo) {
      toast.error("Switch to Celo to create an ERC-8004 agent");
      return;
    }
    if (formErc8004Id.trim()) {
      toast.info("Clear the ID field first if you want to create a new one on Celo.");
      return;
    }
    setRegisteringErc8004Id(editingId);
    try {
      const newAgentId = await registerOnCelo(editingId);
      if (newAgentId != null) {
        await apiClient.patch<ApiResponse<UserAgent>>(`/agents/${editingId}`, { erc8004_agent_id: String(newAgentId) });
        setFormErc8004Id(String(newAgentId));
        setErc8004VerifyResult({ valid: true, isOwner: true });
        toast.success(`Created on Celo. ID: ${newAgentId}`);
        await fetchAgents();
      } else {
        toast.error("Registration succeeded but could not read agent ID");
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Registration failed");
    } finally {
      setRegisteringErc8004Id(null);
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
            className="flex items-center gap-2 text-cyan-400 text-sm font-orbitron font-semibold uppercase tracking-wider"
          >
            <House className="w-4 h-4" />
            BACK
          </button>
          <h1 className="text-xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500 bg-clip-text text-transparent">
            MY AGENTS
          </h1>
          <div className="w-14" />
        </div>
        {hostedCredits != null && agents.some((a) => a.use_tycoon_key) && (
          <p className="text-xs text-cyan-400/90 mb-3 text-center">
            Credits: {hostedCredits.balance > 0 && <strong>{hostedCredits.balance} purchased</strong>}
            {hostedCredits.balance > 0 && hostedCredits.daily.remaining > 0 && " + "}
            {hostedCredits.daily.remaining > 0 && <><strong>{hostedCredits.daily.remaining}</strong> / {hostedCredits.daily.cap} free today</>}
            {hostedCredits.balance === 0 && hostedCredits.daily.remaining === 0 && " — buy credits or try tomorrow"}
          </p>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-cyan-400 text-sm">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {agents.length === 0 && !showForm && (
                <div className="bg-gradient-to-b from-slate-900/60 to-black/60 rounded-xl border-2 border-dashed border-cyan-500/30 p-6 text-center text-gray-400 text-sm">
                  <Bot className="w-10 h-10 text-cyan-500/50 mx-auto mb-2" />
                  <p className="font-orbitron text-cyan-400/80">No agents yet.</p>
                  <p className="mt-0.5">Create one to use in Play vs AI.</p>
                </div>
              )}
              {agents.map((a) => (
                <div
                  key={a.id}
                  className="bg-gradient-to-b from-slate-900/80 to-black/80 rounded-xl border-2 border-cyan-500/30 p-3 flex items-center justify-between gap-3"
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
                      <p className="text-xs text-purple-400 flex items-center gap-1 flex-wrap">
                        <span>ERC-8004: {a.erc8004_agent_id}</span>
                        <a href="https://www.8004scan.io/agents" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Reputation</a>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!a.erc8004_agent_id && isCelo && (
                      <button
                        type="button"
                        onClick={() => handleRegisterOnCelo(a)}
                        disabled={isRegisteringErc8004 && registeringErc8004Id === a.id}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-purple-500/40 text-purple-400 text-xs"
                        title="Register on Celo (you pay gas)"
                      >
                        {isRegisteringErc8004 && registeringErc8004Id === a.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3 h-3" />
                        )}
                        Celo
                      </button>
                    )}
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
              <form onSubmit={handleSubmit} className="bg-gradient-to-b from-slate-900/95 to-black/95 rounded-xl border-2 border-cyan-500/50 shadow-[0_0_20px_rgba(0,240,255,0.12)] p-4 space-y-4 mb-6">
                <h3 className="text-sm font-orbitron font-bold text-cyan-300 tracking-wide uppercase">
                  {editingId ? "Edit agent" : "New agent"}
                </h3>
                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Tycoon Bot"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white text-sm focus:border-cyan-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-2">How it runs</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormHostingType("tycoon")}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        formHostingType === "tycoon"
                          ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                          : "border-cyan-500/30 bg-black/40"
                      }`}
                    >
                      <Server className={`w-6 h-6 shrink-0 ${formHostingType === "tycoon" ? "text-cyan-400" : "text-cyan-500/70"}`} />
                      <div className="min-w-0">
                        <span className={`font-orbitron font-semibold text-sm block ${formHostingType === "tycoon" ? "text-cyan-300" : "text-gray-300"}`}>
                          Tycoon-hosted
                        </span>
                        <span className="text-xs text-gray-500">We run the AI — no setup</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormHostingType("my_key")}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        formHostingType === "my_key"
                          ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                          : "border-cyan-500/30 bg-black/40"
                      }`}
                    >
                      <Key className={`w-6 h-6 shrink-0 ${formHostingType === "my_key" ? "text-cyan-400" : "text-cyan-500/70"}`} />
                      <div className="min-w-0">
                        <span className={`font-orbitron font-semibold text-sm block ${formHostingType === "my_key" ? "text-cyan-300" : "text-gray-300"}`}>
                          My API key
                        </span>
                        <span className="text-xs text-gray-500">Save your key, we call Claude</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormHostingType("my_url")}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        formHostingType === "my_url"
                          ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                          : "border-cyan-500/30 bg-black/40"
                      }`}
                    >
                      <Link2 className={`w-6 h-6 shrink-0 ${formHostingType === "my_url" ? "text-cyan-400" : "text-cyan-500/70"}`} />
                      <div className="min-w-0">
                        <span className={`font-orbitron font-semibold text-sm block ${formHostingType === "my_url" ? "text-cyan-300" : "text-gray-300"}`}>
                          My URL
                        </span>
                        <span className="text-xs text-gray-500">Your server or tunnel</span>
                      </div>
                    </button>
                  </div>
                </div>
                {formHostingType === "my_url" && (
                  <div>
                    <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">Callback URL *</label>
                    <input
                      type="url"
                      value={formCallbackUrl}
                      onChange={(e) => setFormCallbackUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white text-sm focus:border-cyan-400 outline-none"
                    />
                  </div>
                )}
                {formHostingType === "my_key" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90">Provider</label>
                    <button
                      type="button"
                      onClick={() => setFormProvider("anthropic")}
                      className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 text-left ${
                        formProvider === "anthropic"
                          ? "border-purple-400 bg-purple-500/20"
                          : "border-cyan-500/30 bg-black/40"
                      }`}
                    >
                      <Bot className={formProvider === "anthropic" ? "text-purple-400" : "text-gray-500"} />
                      <span className={`font-orbitron font-semibold text-sm ${formProvider === "anthropic" ? "text-purple-300" : "text-gray-400"}`}>
                        Claude (Anthropic)
                      </span>
                    </button>
                    <div>
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">API key *</label>
                      <input
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder={editingId ? "Leave blank to keep" : "Paste API key"}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white text-sm focus:border-cyan-400 outline-none"
                        autoComplete="off"
                      />
                    </div>
                    {editingId && (
                      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
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
                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">Skill (optional)</label>
                  <textarea
                    value={formSkill}
                    onChange={(e) => setFormSkill(e.target.value)}
                    placeholder="How should the AI play?"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white text-sm focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">ERC-8004 ID (optional)</label>
                  {!editingId && (
                    <p className="text-xs text-cyan-400/80 mb-1.5">Save the agent first, then use Create on Celo to get an on-chain ID.</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formErc8004Id}
                      onChange={(e) => {
                        setFormErc8004Id(e.target.value);
                        setErc8004VerifyResult(null);
                      }}
                      placeholder="e.g. 12345 or create on Celo"
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white text-sm focus:border-cyan-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateOnCeloFromForm}
                      disabled={isRegisteringErc8004 || !editingId || !isCelo}
                      title={!editingId ? "Save first" : !isCelo ? "Switch to Celo" : "Create ERC-8004 ID (you pay gas)"}
                      className="shrink-0 px-3 py-2.5 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-orbitron font-semibold text-xs flex items-center gap-1"
                    >
                      {isRegisteringErc8004 && registeringErc8004Id === editingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create on Celo
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!formErc8004Id.trim()) {
                          toast.error("Enter an agent ID to verify");
                          return;
                        }
                        setVerifyingErc8004(true);
                        setErc8004VerifyResult(null);
                        try {
                          const result = await verifyAgentId(formErc8004Id, address ?? undefined);
                          setErc8004VerifyResult(result);
                          if (result.valid) {
                            if (result.isOwner) toast.success("Verified — you own this agent");
                            else toast.warning("Agent exists but you're not the owner");
                          } else toast.error(result.error ?? "Verification failed");
                        } finally {
                          setVerifyingErc8004(false);
                        }
                      }}
                      disabled={verifyingErc8004 || !formErc8004Id.trim()}
                      className="shrink-0 px-3 py-2.5 rounded-xl border-2 border-purple-500/50 bg-purple-500/10 text-purple-300 font-orbitron font-semibold text-xs flex items-center gap-1"
                    >
                      {verifyingErc8004 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Verify
                    </button>
                  </div>
                  {erc8004VerifyResult && (
                    <div className={`mt-1.5 flex items-start gap-1.5 text-xs ${erc8004VerifyResult.valid ? (erc8004VerifyResult.isOwner ? "text-emerald-400" : "text-amber-400") : "text-amber-400"}`}>
                      {erc8004VerifyResult.valid ? (
                        erc8004VerifyResult.isOwner ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>You own this agent. You can link it here.</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>Agent exists but your wallet is not the owner. Only the owner can use this ID.</span>
                          </>
                        )
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{erc8004VerifyResult.error}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-[#00F0FF] text-[#010F10] font-orbitron font-bold rounded-xl text-sm flex items-center justify-center gap-1 border-2 border-[#00F0FF]/50"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingId ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2.5 rounded-xl border-2 border-gray-500/60 text-gray-400 text-sm font-orbitron"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-cyan-500/50 text-cyan-400 text-sm font-orbitron font-semibold hover:border-cyan-400 hover:bg-cyan-500/10"
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
