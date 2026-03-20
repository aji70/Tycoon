"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { House, Plus, Pencil, Trash2, Bot, Loader2, ExternalLink, Key, ShieldCheck, Server, Link2, CheckCircle2, XCircle, Trophy, Eye, EyeOff } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import {
  mergeGameplayIntoBehaviorProfile,
  normalizeBuildStyle,
  normalizeBuyStyle,
  normalizeTradeBehavior,
  syncAgentSettingsFromSavedProfile,
} from "@/lib/agentBehaviorProfile";
import { ApiResponse } from "@/types/api";
import { toast } from "react-toastify";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useRegisterAgentERC8004, useVerifyErc8004AgentId } from "@/context/ContractProvider";
import { getInjectedEoaAddress } from "@/lib/utils/erc8004InjectedEoa";
import { useAgentSettings, TradeBehavior, BuildStyle, BuyStyle } from "@/hooks/useAgentSettings";

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
  is_public?: boolean;
  created_at: string;
  updated_at: string;
}

type HostingType = "tycoon" | "my_key" | "my_url";

type RiskTolerance = "low" | "medium" | "high";
type LiquidityStyle = "tight" | "balanced" | "flush";
type PropertyFocus = "balanced" | "monopolies" | "rail_util" | "high_rent" | "cashflow";

type AgentBehaviorProfile = {
  goal?: "win" | "maximize_prize" | "survive" | "aggressive_growth";
  risk?: RiskTolerance;
  liquidity?: LiquidityStyle;
  property_focus?: PropertyFocus;
  trade_behavior?: TradeBehavior;
  buy_style?: BuyStyle;
  build_style?: BuildStyle;
  notes?: string;
};

function behaviorToPrompt(name: string, profile: AgentBehaviorProfile) {
  const goal = profile.goal || "win";
  const risk = profile.risk || "medium";
  const liquidity = profile.liquidity || "balanced";
  const focus = profile.property_focus || "balanced";
  const trade = normalizeTradeBehavior(profile.trade_behavior);
  const buy = normalizeBuyStyle(profile.buy_style);
  const build = normalizeBuildStyle(profile.build_style);
  const notes = (profile.notes || "").trim();

  return [
    `You are "${name}" — an autonomous Tycoon (Monopoly-style) agent.`,
    "",
    "## Objective",
    `- Primary objective: ${goal.replace(/_/g, " ")}.`,
    "",
    "## Risk & bankroll",
    `- Risk tolerance: ${risk}.`,
    `- Liquidity style: ${liquidity}. Keep enough cash to avoid forced liquidation; prefer decisions that maintain solvency.`,
    "",
    "## Strategy preferences",
    `- Property focus: ${focus}.`,
    `- Buy style: ${buy}.`,
    `- Build style: ${build}.`,
    `- Trade behavior: ${trade}.`,
    "",
    "## Decision rules (must follow)",
    "- Never take actions that you cannot afford.",
    "- Avoid getting trapped with low cash when rent threats are high.",
    "- Prefer completing monopolies and building efficiently when it improves expected net worth.",
    "- When trading, propose clear win-win terms; do not accept trades that reduce your expected net worth unless it prevents imminent bankruptcy.",
    "",
    notes ? "## Extra user instructions\n" + notes : "",
  ]
    .filter(Boolean)
    .join("\n");
}

type HostedCreditsData = {
  balance: number;
  daily: { used: number; cap: number; remaining: number };
  purchase_usdc_available?: boolean;
  purchase_ngn_available?: boolean;
  credits_per_usdc?: number;
  credits_per_1000_ngn?: number;
  usdc_recipient?: string | null;
};

type TournamentPermission = {
  user_id: number;
  user_agent_id: number;
  enabled: boolean;
  max_entry_fee_usdc: string;
  daily_cap_usdc: string | null;
  chain: string | null;
};

const ARENA_MANAGE_AGENTS_PATH = "/arena?tab=my-agents&sub=manage";

export type AgentsPageProps = { embeddedInArena?: boolean };

export default function AgentsPage({ embeddedInArena = false }: AgentsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [behaviorProfile, setBehaviorProfile] = useState<AgentBehaviorProfile>({
    goal: "win",
    risk: "medium",
    liquidity: "balanced",
    property_focus: "balanced",
    trade_behavior: "smart",
      buy_style: "balanced",
      build_style: "balanced",
      notes: "",
    });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingDiscoverId, setTogglingDiscoverId] = useState<number | null>(null);
  const [registeringErc8004Id, setRegisteringErc8004Id] = useState<number | null>(null);
  const { register: registerOnCelo, isPending: isRegisteringErc8004 } = useRegisterAgentERC8004();
  const { verifyAgentId, isCelo, getAgentIdOwnedByAddress } = useVerifyErc8004AgentId();
  const [verifyingErc8004, setVerifyingErc8004] = useState(false);
  const [erc8004VerifyResult, setErc8004VerifyResult] = useState<{ valid: boolean; isOwner?: boolean; error?: string } | null>(null);
  /** Result of on-load check: null = not run, 'loading', 'has_one' (we filled), 'has_none' (show Create CTA) */
  const [erc8004LoadState, setErc8004LoadState] = useState<null | "loading" | "has_one" | "has_none">(null);
  const [hostedCredits, setHostedCredits] = useState<HostedCreditsData | null>(null);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [usdcTxHash, setUsdcTxHash] = useState("");
  const [purchasingUsdc, setPurchasingUsdc] = useState(false);
  const [purchasingNgn, setPurchasingNgn] = useState(false);
  const { agentSettings, updateAgentSettings } = useAgentSettings();
  const [tournamentPerms, setTournamentPerms] = useState<Record<number, TournamentPermission>>({});
  const [permModalAgent, setPermModalAgent] = useState<UserAgent | null>(null);
  const [permEnabled, setPermEnabled] = useState(false);
  const [permMaxFee, setPermMaxFee] = useState("0");
  const [permChain, setPermChain] = useState<string>("CELO");
  const [permPin, setPermPin] = useState("");
  const [permSaving, setPermSaving] = useState(false);

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
      const permRes = await apiClient.get<ApiResponse<TournamentPermission[]>>("/agents/tournament-permissions");
      const list = (permRes as any)?.data?.data?.data;
      if (Array.isArray(list)) {
        const map: Record<number, TournamentPermission> = {};
        for (const p of list) {
          if (p?.user_agent_id != null) map[Number(p.user_agent_id)] = p;
        }
        setTournamentPerms(map);
      } else {
        setTournamentPerms({});
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
      setHostedCredits(null);
      setTournamentPerms({});
    } finally {
      setLoading(false);
    }
  }, []);

  const openTournamentPerms = (a: UserAgent) => {
    const p = tournamentPerms[a.id];
    setPermModalAgent(a);
    setPermEnabled(!!p?.enabled);
    setPermMaxFee("0");
    setPermChain((p?.chain || "CELO") as string);
    setPermPin("");
  };

  const saveTournamentPerms = async () => {
    if (!permModalAgent) return;
    setPermSaving(true);
    try {
      const payload: any = {
        enabled: permEnabled,
        chain: permChain,
        max_entry_fee_usdc: permMaxFee,
      };
      if (permEnabled) payload.pin = permPin;
      const res = await apiClient.post(`/agents/${permModalAgent.id}/tournament-permissions`, payload);
      if ((res as any)?.data?.success) {
        toast.success("Tournament permission saved");
        await fetchAgents();
        setPermModalAgent(null);
      } else {
        toast.error("Could not save permission");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to save permission";
      toast.error(msg);
    } finally {
      setPermSaving(false);
    }
  };

  React.useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Check for NGN redirect (reference from Flutterwave)
  React.useEffect(() => {
    const ref = searchParams.get("reference") ?? searchParams.get("tx_ref");
    if (!ref) return;
    apiClient
      .get<{ success: boolean; found?: boolean; fulfilled?: boolean }>(`/agents/hosted-credits/purchase/ngn/verify?reference=${encodeURIComponent(ref)}`)
      .then((r) => {
        if (r.data?.success && r.data.fulfilled) {
          toast.success("Credits added!");
          fetchAgents();
          router.replace(embeddedInArena ? ARENA_MANAGE_AGENTS_PATH : "/agents", { scroll: false });
        }
      })
      .catch(() => {});
  }, [fetchAgents, router, searchParams, embeddedInArena]);

  // On form load: check if AppKit address or injected EOA owns an ERC-8004 agent on Celo (registration uses injected EOA).
  React.useEffect(() => {
    if (!showForm || !isCelo || !getAgentIdOwnedByAddress) {
      if (!showForm) setErc8004LoadState(null);
      return;
    }
    if (formErc8004Id.trim()) return; // already have a value (e.g. from edit or previous fill)
    let cancelled = false;
    setErc8004LoadState("loading");
    (async () => {
      const injected = await getInjectedEoaAddress().catch(() => null);
      const probe = address ?? injected ?? null;
      if (!probe) {
        if (!cancelled) setErc8004LoadState("has_none");
        return;
      }
      try {
        const id = await getAgentIdOwnedByAddress(probe);
        if (cancelled) return;
        if (id != null) {
          setFormErc8004Id(String(id));
          setErc8004VerifyResult({ valid: true, isOwner: true });
          setErc8004LoadState("has_one");
          return;
        }
        const withId = agents.find((a) => a.erc8004_agent_id && String(a.erc8004_agent_id).trim());
        if (withId?.erc8004_agent_id) {
          const result = await verifyAgentId(String(withId.erc8004_agent_id), probe);
          if (!cancelled && result.valid && result.isOwner) {
            setFormErc8004Id(String(withId.erc8004_agent_id));
            setErc8004VerifyResult({ valid: true, isOwner: true });
            setErc8004LoadState("has_one");
            return;
          }
        }
        if (!cancelled) setErc8004LoadState("has_none");
      } catch {
        if (!cancelled) setErc8004LoadState(null);
      }
    })();
    return () => { cancelled = true; };
  }, [showForm, address, isCelo, getAgentIdOwnedByAddress, verifyAgentId, agents, formErc8004Id]);

  const handlePurchaseUsdc = async () => {
    if (!usdcTxHash.trim()) {
      toast.error("Paste your transaction hash");
      return;
    }
    setPurchasingUsdc(true);
    try {
      const res = await apiClient.post<{ success: boolean; credits?: number; balance?: number; already_credited?: boolean }>(
        "/agents/hosted-credits/purchase/usdc",
        { tx_hash: usdcTxHash.trim() }
      );
      if (res.data?.success) {
        if (res.data.already_credited) toast.info("Credits already added for this transaction");
        else toast.success(`Added ${res.data.credits ?? 100} credits!`);
        setBuyCreditsOpen(false);
        setUsdcTxHash("");
        fetchAgents();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Purchase failed";
      toast.error(msg);
    } finally {
      setPurchasingUsdc(false);
    }
  };

  const handlePurchaseNgn = async () => {
    setPurchasingNgn(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const returnPath = embeddedInArena ? `${base}/arena?tab=my-agents&sub=manage` : `${base}/agents`;
      const res = await apiClient.post<{ success: boolean; link?: string; reference?: string }>(
        "/agents/hosted-credits/purchase/ngn/initialize",
        { callback_url: returnPath }
      );
      if (res.data?.success && res.data.link) {
        window.location.href = res.data.link;
      } else {
        toast.error("Could not start NGN payment");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "NGN purchase failed";
      toast.error(msg);
    } finally {
      setPurchasingNgn(false);
    }
  };

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
    setFormHostingType("tycoon");
    setBehaviorProfile({
      goal: "win",
      risk: "medium",
      liquidity: "balanced",
      property_focus: "balanced",
      trade_behavior: "smart",
      buy_style: "balanced",
      build_style: "balanced",
      notes: "",
    });
    setErc8004VerifyResult(null);
    setErc8004LoadState(null);
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
    const p = (a.config as any)?.behavior_profile;
    if (p && typeof p === "object") {
      setBehaviorProfile({
        goal: p.goal || "win",
        risk: p.risk || "medium",
        liquidity: p.liquidity || "balanced",
        property_focus: p.property_focus || "balanced",
        trade_behavior: normalizeTradeBehavior(p.trade_behavior),
        buy_style: normalizeBuyStyle(p.buy_style),
        build_style: normalizeBuildStyle(p.build_style),
        notes: typeof p.notes === "string" ? p.notes : "",
      });
      syncAgentSettingsFromSavedProfile(p, updateAgentSettings);
    } else {
      setBehaviorProfile({
        goal: "win",
        risk: "medium",
        liquidity: "balanced",
        property_focus: "balanced",
        trade_behavior: "smart",
        buy_style: "balanced",
        build_style: "balanced",
        notes: "",
      });
    }
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
      toast.error("Callback URL is required for “My callback URL”");
      return;
    }
    if (formHostingType === "my_key" && !editingId && !formApiKey.trim()) {
      toast.error("API key is required for “My API key”");
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
      const mergedProfile = mergeGameplayIntoBehaviorProfile(
        { ...behaviorProfile } as Record<string, unknown>,
        agentSettings
      ) as unknown as AgentBehaviorProfile;
      const generated = behaviorToPrompt(name, mergedProfile);
      configPayload.behavior_profile = mergedProfile;
      configPayload.behavior_prompt = generated;
      // Use the generated behavior prompt as the agent "skill" every time.
      configPayload.skill = generated;
      let safeConfig: Record<string, unknown> | null = null;
      try {
        safeConfig = JSON.parse(JSON.stringify(configPayload)) as Record<string, unknown>;
      } catch {
        toast.error("Could not save agent settings (invalid data). Try shortening notes.");
        return;
      }
      payload.config = Object.keys(safeConfig).length > 0 ? safeConfig : null;
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
      const msg =
        err instanceof ApiError
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as Error).message)
            : "Request failed";
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

  const toggleDiscoverVisibility = async (a: UserAgent) => {
    const next = !a.is_public;
    setTogglingDiscoverId(a.id);
    try {
      await apiClient.patch<ApiResponse<UserAgent>>(`/agents/${a.id}`, { is_public: next });
      toast.success(next ? "Listed in Arena → Discover" : "Hidden from Discover");
      await fetchAgents();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as Error).message)
            : "Could not update visibility";
      toast.error(msg);
    } finally {
      setTogglingDiscoverId(null);
    }
  };

  const handleRegisterOnCelo = async (a: UserAgent) => {
    if (!isCelo) {
      toast.error("Switch to Celo network to register on ERC-8004");
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
        toast.success(`Registered on Celo. Agent ID: ${newAgentId}`);
        await fetchAgents();
      } else {
        toast.error("Registration succeeded but could not read agent ID");
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "Registration failed";
      toast.error(msg);
    } finally {
      setRegisteringErc8004Id(null);
    }
  };

  /** Create a new ERC-8004 agent ID on Celo from the form (only when editing an existing agent). */
  const handleCreateOnCeloFromForm = async () => {
    if (!editingId) {
      toast.info("Save the agent first, then use 'Create on Celo' to get an ERC-8004 ID.");
      return;
    }
    if (!isCelo) {
      toast.error("Switch to Celo network to create an ERC-8004 agent");
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
        toast.success(`Created on Celo. Your ERC-8004 Agent ID: ${newAgentId}`);
        await fetchAgents();
      } else {
        toast.error("Registration succeeded but could not read agent ID");
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "Registration failed";
      toast.error(msg);
    } finally {
      setRegisteringErc8004Id(null);
    }
  };

  const authGateShell = embeddedInArena
    ? "py-8 flex flex-col items-center justify-center px-4"
    : "min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-6";

  if (authFailed) {
    const hasWallet = isConnected && !!address;
    if (hasWallet && !walletNotRegistered) {
      return (
        <div className={authGateShell}>
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
        <div className={authGateShell}>
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
        <div className={authGateShell}>
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

  const mainShell = embeddedInArena
    ? "w-full flex flex-col py-1"
    : "min-h-screen bg-settings bg-cover bg-fixed flex flex-col p-6";

  return (
    <div className={mainShell}>
      <div className="max-w-4xl mx-auto w-full">
        {!embeddedInArena && (
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-orbitron font-semibold text-sm uppercase tracking-wider transition"
            >
              <House className="w-5 h-5" />
              BACK
            </button>
            <h1 className="text-3xl md:text-4xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,240,255,0.3)]">
              MY AGENTS
            </h1>
            <div className="w-20" />
          </div>
        )}
        {hostedCredits != null && agents.some((a) => a.use_tycoon_key) && (
          <div className="flex flex-col items-center gap-2 mb-4">
            <p className="text-sm text-cyan-400/90 text-center">
              Tycoon-hosted credits: {hostedCredits.balance > 0 && <strong>{hostedCredits.balance} purchased</strong>}
              {hostedCredits.balance > 0 && hostedCredits.daily.remaining > 0 && " + "}
              {hostedCredits.daily.remaining > 0 && (
                <>
                  <strong>{hostedCredits.daily.remaining}</strong> / {hostedCredits.daily.cap} free today
                </>
              )}
              {hostedCredits.balance === 0 && hostedCredits.daily.remaining === 0 && (
                <>No credits — add API key, try tomorrow, or buy credits</>
              )}
            </p>
            {(hostedCredits.purchase_usdc_available || hostedCredits.purchase_ngn_available) && (
              <button
                type="button"
                onClick={() => setBuyCreditsOpen(true)}
                className="text-xs text-cyan-400 hover:underline"
              >
                Buy credits ($1 USDC or ₦1000)
              </button>
            )}
          </div>
        )}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-400 font-orbitron font-semibold hover:bg-cyan-500/30 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:border-cyan-400/60 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add agent
          </button>
        </div>

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
                <div className="bg-gradient-to-b from-slate-900/60 to-black/60 rounded-2xl border-2 border-cyan-500/30 border-dashed p-8 text-center text-gray-400">
                  <Bot className="w-12 h-12 text-cyan-500/50 mx-auto mb-3" />
                  <p className="font-orbitron text-sm text-cyan-400/80">No agents yet.</p>
                  <p className="text-sm mt-1">Create one to use in Play vs AI.</p>
                </div>
              )}
              {agents.map((a) => (
                <div
                  key={a.id}
                  className="bg-gradient-to-b from-slate-900/80 to-black/80 rounded-2xl border-2 border-cyan-500/30 p-4 flex flex-wrap items-center justify-between gap-4 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate flex items-center gap-2">
                      <span className="truncate">{a.name}</span>
                      {tournamentPerms[a.id]?.enabled ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                          Auto-join
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {a.use_tycoon_key ? (
                        <span className="flex items-center gap-1 text-cyan-400/90">Tycoon-hosted (we run the AI)</span>
                      ) : a.callback_url ? (
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
                    {a.has_api_key && !a.callback_url && !a.use_tycoon_key && (
                      <p className="text-xs text-cyan-400/80 mt-0.5">Uses saved key (e.g. Claude)</p>
                    )}
                    {a.erc8004_agent_id && (
                      <p className="text-xs text-purple-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>ERC-8004: {a.erc8004_agent_id}</span>
                        <a
                          href={`https://www.8004scan.io/agents`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline"
                        >
                          View reputation
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDiscoverVisibility(a)}
                      disabled={togglingDiscoverId === a.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition disabled:opacity-50 ${
                        a.is_public
                          ? "border-emerald-500/45 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15"
                          : "border-white/15 text-gray-400 hover:border-cyan-500/40 hover:text-cyan-300"
                      }`}
                      title={
                        a.is_public
                          ? "Shown in Arena → Discover. Click to hide."
                          : "Not listed in Discover. Click to make visible for challenges."
                      }
                    >
                      {togglingDiscoverId === a.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : a.is_public ? (
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {a.is_public ? "In Discover" : "Discover off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTournamentPerms(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition text-sm"
                      title="Allow this agent to join tournaments automatically (with capped entry fee)."
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Tournaments
                    </button>
                    {!a.erc8004_agent_id && isCelo && (
                      <button
                        type="button"
                        onClick={() => handleRegisterOnCelo(a)}
                        disabled={isRegisteringErc8004 && registeringErc8004Id === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition disabled:opacity-50 text-sm"
                        title="Register on Celo via your browser wallet (MetaMask etc.). You pay gas; the NFT is owned by that EOA."
                      >
                        {isRegisteringErc8004 && registeringErc8004Id === a.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Register on Celo
                      </button>
                    )}
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

            {/* Create / Edit form — gaming panel style */}
            {showForm ? (
              <form onSubmit={handleSubmit} className="relative bg-gradient-to-b from-slate-900/95 to-black/95 rounded-2xl border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,240,255,0.15)] p-6 space-y-6 mb-8 overflow-hidden">
                {/* Decorative corner */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none" />
                <h3 className="text-xl font-orbitron font-bold text-cyan-300 tracking-wide">
                  {editingId ? "EDIT AGENT" : "NEW AGENT"}
                </h3>

                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-2">Agent name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Tycoon Bot"
                    className="w-full px-4 py-3 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-3">How will this agent run?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormHostingType("tycoon")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        formHostingType === "tycoon"
                          ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                          : "border-cyan-500/30 bg-black/40 hover:border-cyan-500/60 hover:bg-cyan-500/5"
                      }`}
                    >
                      <Server className={`w-8 h-8 ${formHostingType === "tycoon" ? "text-cyan-400" : "text-cyan-500/70"}`} />
                      <span className={`font-orbitron font-semibold text-sm ${formHostingType === "tycoon" ? "text-cyan-300" : "text-gray-300"}`}>
                        Tycoon-hosted
                      </span>
                      <span className="text-xs text-gray-500 text-center">We run the AI — no setup</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormHostingType("my_key")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        formHostingType === "my_key"
                          ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                          : "border-cyan-500/30 bg-black/40 hover:border-cyan-500/60 hover:bg-cyan-500/5"
                      }`}
                    >
                      <Key className={`w-8 h-8 ${formHostingType === "my_key" ? "text-cyan-400" : "text-cyan-500/70"}`} />
                      <span className={`font-orbitron font-semibold text-sm ${formHostingType === "my_key" ? "text-cyan-300" : "text-gray-300"}`}>
                        My API key
                      </span>
                      <span className="text-xs text-gray-500 text-center">Save your key, we call Claude</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormHostingType("my_url")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        formHostingType === "my_url"
                          ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                          : "border-cyan-500/30 bg-black/40 hover:border-cyan-500/60 hover:bg-cyan-500/5"
                      }`}
                    >
                      <Link2 className={`w-8 h-8 ${formHostingType === "my_url" ? "text-cyan-400" : "text-cyan-500/70"}`} />
                      <span className={`font-orbitron font-semibold text-sm ${formHostingType === "my_url" ? "text-cyan-300" : "text-gray-300"}`}>
                        My URL
                      </span>
                      <span className="text-xs text-gray-500 text-center">Your server or tunnel</span>
                    </button>
                  </div>
                </div>

                {formHostingType === "my_url" && (
                  <div>
                    <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-2">Callback URL *</label>
                    <input
                      type="url"
                      value={formCallbackUrl}
                      onChange={(e) => setFormCallbackUrl(e.target.value)}
                      placeholder="https://your-agent.example.com"
                      className="w-full px-4 py-3 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none"
                    />
                  </div>
                )}

                {formHostingType === "my_key" && (
                  <>
                    <div>
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-2">Provider</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setFormProvider("anthropic")}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                            formProvider === "anthropic"
                              ? "border-purple-400 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                              : "border-cyan-500/30 bg-black/40 hover:border-cyan-500/60"
                          }`}
                        >
                          <Bot className={formProvider === "anthropic" ? "text-purple-400" : "text-gray-500"} />
                          <span className={`font-orbitron font-semibold text-sm ${formProvider === "anthropic" ? "text-purple-300" : "text-gray-400"}`}>
                            Claude (Anthropic)
                          </span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-2">API key *</label>
                      <input
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder={editingId ? "Leave blank to keep existing; enter new to change" : "Paste your API key"}
                        className="w-full px-4 py-3 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none"
                        autoComplete="off"
                      />
                      <p className="text-xs text-gray-500 mt-1">Stored encrypted. We use it when you choose this agent on the board.</p>
                      {editingId && (
                        <label className="flex items-center gap-2 mt-2 text-sm text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formClearApiKey}
                            onChange={(e) => setFormClearApiKey(e.target.checked)}
                            className="rounded border-cyan-500/40 bg-black/50"
                          />
                          Clear saved API key
                        </label>
                      )}
                    </div>
                  </>
                )}

                {formHostingType === "tycoon" && (
                  <p className="text-sm text-cyan-400/90 py-1">We run the AI for this agent. Just name it and use it in game — no setup.</p>
                )}

                <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-slate-900/60 to-black/60 p-5 space-y-4">
                  <p className="text-sm font-orbitron font-bold text-amber-200 tracking-wide uppercase">
                    Behavior setup (recommended)
                  </p>
                  <p className="text-xs text-slate-400">
                    Answer these to “train” the agent’s style. This is saved to your agent and used in every game decision.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-amber-300/90 mb-1">
                        Goal
                      </label>
                      <select
                        value={behaviorProfile.goal ?? "win"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, goal: e.target.value as any }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="win">Win (net worth)</option>
                        <option value="maximize_prize">Maximize prize odds</option>
                        <option value="survive">Play safe / avoid bankruptcy</option>
                        <option value="aggressive_growth">Aggressive growth</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-amber-300/90 mb-1">
                        Risk tolerance
                      </label>
                      <select
                        value={behaviorProfile.risk ?? "medium"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, risk: e.target.value as any }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-amber-300/90 mb-1">
                        Liquidity style
                      </label>
                      <select
                        value={behaviorProfile.liquidity ?? "balanced"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, liquidity: e.target.value as any }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="tight">Tight (invest aggressively)</option>
                        <option value="balanced">Balanced</option>
                        <option value="flush">Flush (keep lots of cash)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-amber-300/90 mb-1">
                        Property focus
                      </label>
                      <select
                        value={behaviorProfile.property_focus ?? "balanced"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, property_focus: e.target.value as any }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="monopolies">Monopolies first</option>
                        <option value="rail_util">Rail/Utilities focus</option>
                        <option value="high_rent">High rent squares</option>
                        <option value="cashflow">Cashflow stability</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-orbitron uppercase tracking-wider text-amber-300/90 mb-1">
                        Extra instructions (optional)
                      </label>
                      <textarea
                        value={behaviorProfile.notes ?? ""}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. 'Always keep $300 cash buffer', 'Never mortgage railroads', 'Prefer orange/red sets'..."
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-amber-500/30 text-white placeholder-gray-500 min-h-[90px]"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-2">Generated prompt preview</p>
                    <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
{behaviorToPrompt(
                        formName.trim() || "My Agent",
                        mergeGameplayIntoBehaviorProfile(
                          { ...behaviorProfile } as Record<string, unknown>,
                          agentSettings
                        ) as unknown as AgentBehaviorProfile
                      )}
                    </pre>
                  </div>
                </div>

                {/* Agent behaviour settings */}
                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">Agent behaviour when playing as you</label>
                  <p className="text-xs text-gray-500 mb-4">
                    Trading, buying, and building — these are saved on your agent when you click Update / Create.
                  </p>
                  <div className="space-y-4">
                    {(
                      [
                        {
                          key: "tradeBehavior" as const,
                          label: "Trading — incoming offers",
                          options: [
                            { value: "never_sell" as TradeBehavior, label: "Never sell", desc: "Always decline trades that ask for your properties" },
                            { value: "smart" as TradeBehavior, label: "Smart", desc: "Block monopoly-completing trades; evaluate others by value" },
                            { value: "generous" as TradeBehavior, label: "Generous", desc: "Accept any offer with a 10%+ value premium" },
                          ],
                        },
                        {
                          key: "buildStyle" as const,
                          label: "Building",
                          options: [
                            { value: "conservative" as BuildStyle, label: "Conservative", desc: "Build only when cash > $800; keep $600 after" },
                            { value: "balanced" as BuildStyle, label: "Balanced", desc: "Build when cash > $300; keep $150 after" },
                            { value: "aggressive" as BuildStyle, label: "Aggressive", desc: "Build from $150+; spend down to $0" },
                          ],
                        },
                        {
                          key: "buyStyle" as const,
                          label: "Buying",
                          options: [
                            { value: "conservative" as BuyStyle, label: "Conservative", desc: "Only high-value / near-monopoly buys; $600 reserve" },
                            { value: "balanced" as BuyStyle, label: "Balanced", desc: "Strategic buys; $400 reserve" },
                            { value: "aggressive" as BuyStyle, label: "Aggressive", desc: "Almost everything affordable; $200 reserve" },
                          ],
                        },
                      ] as const
                    ).map(({ key, label, options }) => (
                      <div key={key}>
                        <p className="text-xs text-cyan-400/70 uppercase tracking-wide font-semibold mb-2">{label}</p>
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              title={opt.desc}
                              onClick={() => updateAgentSettings({ [key]: opt.value })}
                              className={`px-4 py-2 rounded-xl border-2 text-sm transition-all duration-200 ${
                                agentSettings[key] === opt.value
                                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 font-semibold shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                                  : "border-cyan-500/30 bg-black/40 text-gray-400 hover:border-cyan-500/60 hover:bg-cyan-500/5"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {options.find((o) => o.value === agentSettings[key])?.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-2">ERC-8004 Agent ID (optional)</label>
                  {!editingId && (
                    <p className="text-xs text-cyan-400/80 mb-2">Save this agent first, then use <strong>Create on Celo</strong> below to get an on-chain ERC-8004 ID (you pay gas).</p>
                  )}
                  {erc8004LoadState === "loading" && (
                    <p className="text-xs text-cyan-400/80 mb-2 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      Checking Celo for your agent…
                    </p>
                  )}
                  {erc8004LoadState === "has_none" && !formErc8004Id.trim() && (
                    <p className="text-xs text-amber-400/90 mb-2">You don’t have an ERC-8004 agent on Celo. Use <strong>Create on Celo</strong> to get one (you pay gas).</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={formErc8004Id}
                      onChange={(e) => {
                        setFormErc8004Id(e.target.value);
                        setErc8004VerifyResult(null);
                      }}
                      placeholder={erc8004LoadState === "has_none" ? "Create on Celo to get an ID" : "e.g. 12345 — or create one on Celo"}
                      className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white placeholder-gray-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateOnCeloFromForm}
                      disabled={isRegisteringErc8004 || !editingId || !isCelo}
                      title={!editingId ? "Save the agent first" : !isCelo ? "Switch to Celo" : "Register on ERC-8004 using your injected browser wallet (EOA); you pay gas"}
                      className="shrink-0 px-4 py-3 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-orbitron font-semibold text-sm hover:bg-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isRegisteringErc8004 && registeringErc8004Id === editingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Create on Celo
                    </button>
                    {!(erc8004LoadState === "has_none" && !formErc8004Id.trim()) && (
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
                          const injected = await getInjectedEoaAddress().catch(() => null);
                          const ownerProbe = address ?? injected ?? undefined;
                          const result = await verifyAgentId(formErc8004Id, ownerProbe);
                          setErc8004VerifyResult(result);
                          if (result.valid) {
                            if (result.isOwner) toast.success("Verified — you own this agent");
                            else toast.warning("Agent exists but your wallet is not the owner");
                          } else toast.error(result.error ?? "Verification failed");
                        } finally {
                          setVerifyingErc8004(false);
                        }
                      }}
                      disabled={verifyingErc8004 || !formErc8004Id.trim()}
                      className="shrink-0 px-4 py-3 rounded-xl border-2 border-purple-500/50 bg-purple-500/10 text-purple-300 font-orbitron font-semibold text-sm hover:bg-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                    >
                      {verifyingErc8004 ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Verify
                    </button>
                    )}
                  </div>
                  {erc8004VerifyResult && (
                    <div className={`mt-2 flex items-start gap-2 text-sm ${erc8004VerifyResult.valid ? (erc8004VerifyResult.isOwner ? "text-emerald-400" : "text-amber-400") : "text-amber-400"}`}>
                      {erc8004VerifyResult.valid ? (
                        erc8004VerifyResult.isOwner ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>You own this agent on Celo. You can link it to this Tycoon agent.</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>This agent exists on Celo but your connected wallet is not the on-chain owner. Only the owner can use this ID here.</span>
                          </>
                        )
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{erc8004VerifyResult.error}</span>
                        </>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {erc8004LoadState === "has_none" && !formErc8004Id.trim()
                      ? "Create on Celo to mint a new ERC-8004 ID (your wallet pays gas)."
                      : "Create on Celo to mint a new ID, or paste an existing ID and Verify ownership."}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-[#00F0FF] text-[#010F10] font-orbitron font-bold rounded-xl hover:bg-[#0FF0FC] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50 flex items-center gap-2 border-2 border-[#00F0FF]/50"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingId ? "UPDATE" : "CREATE"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 rounded-xl border-2 border-gray-500/60 text-gray-400 hover:bg-white/5 hover:border-gray-400 transition font-orbitron font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-dashed border-cyan-500/50 text-cyan-400 font-orbitron font-semibold hover:border-cyan-400 hover:bg-cyan-500/10 hover:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-all"
              >
                <Plus className="w-5 h-5" />
                Create agent
              </button>
            )}
          </>
        )}

        <p className="text-gray-500 text-sm mt-6">
          <a href="/arena" className="text-cyan-400 hover:underline">Arena</a> — challenge public agents using the agents you create here.
          {" · "}
          <a href="/play-ai" className="text-cyan-400 hover:underline">Play vs AI</a> — use one of your agents when creating a game (coming soon).
        </p>

        {permModalAgent && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPermModalAgent(null)}>
            <div className="bg-[#0d1117] rounded-2xl border border-amber-500/30 p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-300" />
                    Tournament auto-join
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">Agent: {permModalAgent.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermModalAgent(null)}
                  className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-200 hover:bg-white/5 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <label className="flex items-center justify-between gap-3 text-sm text-gray-200">
                  <span>Enable (spend from smart wallet)</span>
                  <input
                    type="checkbox"
                    checked={permEnabled}
                    onChange={(e) => setPermEnabled(e.target.checked)}
                    className="rounded border-gray-600 bg-black/40"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Max entry fee (USDC)</p>
                    <input
                      value={permMaxFee}
                      onChange={(e) => setPermMaxFee(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Chain</p>
                    <select
                      value={permChain}
                      onChange={(e) => setPermChain(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                    >
                      <option value="CELO">CELO</option>
                      <option value="BASE">BASE</option>
                      <option value="POLYGON">POLYGON</option>
                    </select>
                  </div>
                </div>

                {permEnabled && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Confirm with withdrawal PIN</p>
                    <input
                      type="password"
                      value={permPin}
                      onChange={(e) => setPermPin(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                      placeholder="PIN"
                    />
                    <p className="text-xs text-amber-300 mt-2">
                      Required only when enabling. After that, this agent can auto-join within your cap.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPermModalAgent(null)}
                    className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveTournamentPerms}
                    disabled={permSaving}
                    className="px-5 py-2 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-black font-extrabold disabled:opacity-60 flex items-center gap-2"
                  >
                    {permSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {buyCreditsOpen && hostedCredits && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setBuyCreditsOpen(false)}>
            <div className="bg-[#0d1117] rounded-2xl border border-cyan-500/40 p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-white mb-4">Buy hosted agent credits</h3>
              <p className="text-gray-400 text-sm mb-4">100 credits = 100 AI decisions. $1 USDC or ₦1000 NGN.</p>

              {hostedCredits.purchase_usdc_available && (
                <div className="mb-4">
                  <p className="text-sm text-cyan-400 font-medium mb-2">Pay with USDC (Celo)</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Send $1 USDC to <code className="bg-black/50 px-1 rounded text-cyan-300 truncate block">{hostedCredits.usdc_recipient || "…"}</code> on Celo, then paste the transaction hash:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={usdcTxHash}
                      onChange={(e) => setUsdcTxHash(e.target.value)}
                      placeholder="0x..."
                      className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-cyan-500/40 text-white text-sm font-mono placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={handlePurchaseUsdc}
                      disabled={purchasingUsdc || !usdcTxHash.trim()}
                      className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 flex items-center gap-2"
                    >
                      {purchasingUsdc && <Loader2 className="w-4 h-4 animate-spin" />}
                      Verify
                    </button>
                  </div>
                </div>
              )}

              {hostedCredits.purchase_ngn_available && (
                <div className="mb-4">
                  <p className="text-sm text-cyan-400 font-medium mb-2">Pay with Naira (NGN)</p>
                  <button
                    type="button"
                    onClick={handlePurchaseNgn}
                    disabled={purchasingNgn}
                    className="w-full px-4 py-3 rounded-lg bg-green-600/20 border border-green-500/50 text-green-400 hover:bg-green-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {purchasingNgn && <Loader2 className="w-5 h-5 animate-spin" />}
                    Pay ₦1000
                  </button>
                </div>
              )}

              <button type="button" onClick={() => setBuyCreditsOpen(false)} className="w-full py-2 text-gray-400 hover:text-white">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
