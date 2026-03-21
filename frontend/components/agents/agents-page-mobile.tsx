"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { House, Plus, Pencil, Trash2, Bot, Loader2, ExternalLink, Key, ShieldCheck, Server, Link2, CheckCircle2, XCircle, Trophy, Eye, EyeOff, Wallet, X } from "lucide-react";
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

/** API stores USDC amounts as integer strings (6 decimals). */
function usdcStoredToDecimalInput(stored: string | null | undefined): string {
  if (stored == null || String(stored).trim() === "") return "";
  try {
    let n = BigInt(String(stored));
    const neg = n < 0n;
    if (neg) n = -n;
    const whole = n / 1_000_000n;
    const frac = n % 1_000_000n;
    let out = (neg ? "-" : "") + whole.toString();
    if (frac !== 0n) {
      const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
      out += "." + fracStr;
    }
    return out;
  } catch {
    return "";
  }
}

function formatUsdcDisplay(stored: string | null | undefined): string {
  if (stored == null || String(stored).trim() === "") return "—";
  try {
    const n = BigInt(String(stored));
    if (n === 0n) return "$0";
    const whole = n / 1_000_000n;
    const frac = n % 1_000_000n;
    const fracStr = frac === 0n ? "" : "." + frac.toString().padStart(6, "0").replace(/0+$/, "");
    return `$${whole}${fracStr}`;
  } catch {
    return "—";
  }
}

function tournamentSpendSummary(tp: TournamentPermission | undefined): { enabled: boolean; text: string } {
  if (!tp?.enabled) {
    return {
      enabled: false,
      text: "Challenge wallet spending is off. Tap trophy to set max per entry and optional daily cap.",
    };
  }
  const per = formatUsdcDisplay(tp.max_entry_fee_usdc);
  const hasDaily = tp.daily_cap_usdc != null && String(tp.daily_cap_usdc).trim() !== "";
  const dailyPart = hasDaily
    ? `${formatUsdcDisplay(tp.daily_cap_usdc)} max per day`
    : "no daily total cap";
  return {
    enabled: true,
    text: `Challenge cap: ${per} per entry · ${dailyPart}`,
  };
}

export type AgentsPageMobileProps = {
  embeddedInArena?: boolean;
  onSpendingCapsSaved?: () => void | Promise<void>;
  openTournamentSpendingForAgentId?: number | null;
  onTournamentSpendingModalOpened?: () => void;
};

export default function AgentsPageMobile({
  embeddedInArena = false,
  onSpendingCapsSaved,
  openTournamentSpendingForAgentId = null,
  onTournamentSpendingModalOpened,
}: AgentsPageMobileProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const guestAuth = useGuestAuthOptional();
  const triedWalletAutoLogin = React.useRef(false);
  const tournamentJumpHandledRef = React.useRef<number | null>(null);
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
  const [erc8004LoadState, setErc8004LoadState] = useState<null | "loading" | "has_one" | "has_none">(null);
  const [hostedCredits, setHostedCredits] = useState<HostedCreditsData | null>(null);
  const { agentSettings, updateAgentSettings } = useAgentSettings();
  const [tournamentPerms, setTournamentPerms] = useState<Record<number, TournamentPermission>>({});
  const [permModalAgent, setPermModalAgent] = useState<UserAgent | null>(null);
  const [permEnabled, setPermEnabled] = useState(false);
  const [permMaxFee, setPermMaxFee] = useState("0");
  const [permDailyCap, setPermDailyCap] = useState("");
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

  const openTournamentPerms = React.useCallback((a: UserAgent) => {
    const p = tournamentPerms[a.id];
    setPermModalAgent(a);
    setPermEnabled(!!p?.enabled);
    const maxDec = usdcStoredToDecimalInput(p?.max_entry_fee_usdc);
    setPermMaxFee(maxDec === "" ? "0" : maxDec);
    setPermDailyCap(usdcStoredToDecimalInput(p?.daily_cap_usdc));
    setPermChain((p?.chain || "CELO") as string);
    setPermPin("");
  }, [tournamentPerms]);

  React.useEffect(() => {
    if (openTournamentSpendingForAgentId == null) {
      tournamentJumpHandledRef.current = null;
      return;
    }
    if (loading) return;
    const id = openTournamentSpendingForAgentId;
    if (tournamentJumpHandledRef.current === id) return;
    const agent = agents.find((x) => x.id === id);
    if (!agent) {
      if (agents.length > 0) onTournamentSpendingModalOpened?.();
      return;
    }
    tournamentJumpHandledRef.current = id;
    openTournamentPerms(agent);
    onTournamentSpendingModalOpened?.();
  }, [
    openTournamentSpendingForAgentId,
    loading,
    agents,
    openTournamentPerms,
    onTournamentSpendingModalOpened,
  ]);

  const saveTournamentPerms = async () => {
    if (!permModalAgent) return;
    setPermSaving(true);
    try {
      const payload: any = {
        enabled: permEnabled,
        chain: permChain,
        max_entry_fee_usdc: permMaxFee,
        daily_cap_usdc: permDailyCap.trim() ? permDailyCap.trim() : null,
      };
      if (permEnabled) payload.pin = permPin;
      const res = await apiClient.post(`/agents/${permModalAgent.id}/tournament-permissions`, payload);
      if ((res as any)?.data?.success) {
        toast.success("Saved");
        await fetchAgents();
        setPermModalAgent(null);
        await onSpendingCapsSaved?.();
      } else {
        toast.error("Could not save");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed";
      toast.error(msg);
    } finally {
      setPermSaving(false);
    }
  };

  React.useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // On form load: AppKit address or injected EOA (registration uses injected EOA).
  React.useEffect(() => {
    if (!showForm || !isCelo || !getAgentIdOwnedByAddress) {
      if (!showForm) setErc8004LoadState(null);
      return;
    }
    if (formErc8004Id.trim()) return;
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
      const mergedProfile = mergeGameplayIntoBehaviorProfile(
        { ...behaviorProfile } as Record<string, unknown>,
        agentSettings
      ) as unknown as AgentBehaviorProfile;
      const generated = behaviorToPrompt(name, mergedProfile);
      configPayload.behavior_profile = mergedProfile;
      configPayload.behavior_prompt = generated;
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

  const toggleDiscoverVisibility = async (a: UserAgent) => {
    const next = !a.is_public;
    setTogglingDiscoverId(a.id);
    try {
      await apiClient.patch<ApiResponse<UserAgent>>(`/agents/${a.id}`, { is_public: next });
      toast.success(next ? "Listed in Discover" : "Hidden from Discover");
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
      toast.error("Switch to Celo to register on ERC-8004");
      return;
    }
    const existingId = a.erc8004_agent_id ? String(a.erc8004_agent_id).trim() : "";
    if (existingId) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          `Replace ERC-8004 ID ${existingId} with a newly minted identity? The old link will be overwritten.`
        );
      if (!ok) return;
    }
    setRegisteringErc8004Id(a.id);
    try {
      const newAgentId = await registerOnCelo(a.id);
      if (newAgentId != null) {
        await apiClient.patch<ApiResponse<UserAgent>>(`/agents/${a.id}`, { erc8004_agent_id: String(newAgentId) });
        toast.success(
          existingId ? `Re-linked on Celo. New ID: ${newAgentId}` : `Registered on Celo. ID: ${newAgentId}`
        );
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
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          `Replace ID ${formErc8004Id.trim()} by minting a new ERC-8004 NFT?`
        );
      if (!ok) return;
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

  const authGateShell = embeddedInArena
    ? "py-8 flex flex-col items-center justify-center px-4"
    : "min-h-screen bg-settings bg-cover bg-fixed flex flex-col items-center justify-center p-4 pt-24";

  if (authFailed) {
    const hasWallet = isConnected && !!address;
    if (hasWallet && !walletNotRegistered) {
      return (
        <div className={authGateShell}>
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
        <div className={authGateShell}>
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
        <div className={authGateShell}>
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

  const mainShell = embeddedInArena
    ? "w-full flex flex-col px-0 pt-2 pb-8"
    : "min-h-screen bg-settings bg-cover bg-fixed flex flex-col px-4 pt-24 pb-10";

  return (
    <div className={mainShell}>
      {permModalAgent && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 overflow-y-auto"
          onClick={() => setPermModalAgent(null)}
          role="presentation"
        >
          <div
            className={`rounded-2xl overflow-hidden max-w-md w-full my-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ${
              embeddedInArena
                ? "border border-cyan-400/30 bg-[#060c10]"
                : "border-2 border-amber-400/40 bg-[#0d1117]"
            }`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tournament-spending-modal-title-mobile"
          >
            <div
              className={`px-4 pt-4 pb-3 border-b border-white/[0.08] ${
                embeddedInArena
                  ? "bg-gradient-to-r from-cyan-500/15 via-teal-500/5 to-amber-500/10"
                  : "bg-gradient-to-r from-amber-500/10 to-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <h3 id="tournament-spending-modal-title-mobile" className="text-base font-bold text-white flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 border border-white/10 shrink-0">
                      <Wallet className="w-4 h-4 text-cyan-300" aria-hidden />
                    </span>
                    <span className="leading-tight">Smart wallet caps</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    <span className="text-slate-400">Agent</span>{" "}
                    <span className="text-cyan-100/90 font-medium truncate">{permModalAgent.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermModalAgent(null)}
                  className="shrink-0 p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-200">Allow spending</p>
                  <p className="text-[10px] text-slate-500">Smart wallet</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={permEnabled}
                  onClick={() => setPermEnabled(!permEnabled)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    permEnabled ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                      permEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Max / match</p>
                  <input
                    value={permMaxFee}
                    onChange={(e) => setPermMaxFee(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-cyan-500/25 text-white text-sm"
                    placeholder="1"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Chain</p>
                  <select
                    value={permChain}
                    onChange={(e) => setPermChain(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-cyan-500/25 text-white text-sm"
                  >
                    <option value="CELO">CELO</option>
                    <option value="BASE">BASE</option>
                    <option value="POLYGON">POLYGON</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Daily cap (optional)</p>
                <input
                  value={permDailyCap}
                  onChange={(e) => setPermDailyCap(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-cyan-500/25 text-white text-sm"
                  placeholder="e.g. 10"
                />
              </div>
              {permEnabled && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Withdrawal PIN</p>
                  <input
                    type="password"
                    value={permPin}
                    onChange={(e) => setPermPin(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-amber-500/30 text-white text-sm"
                    placeholder="Confirm"
                  />
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPermModalAgent(null)}
                  className="w-full py-2.5 rounded-xl border border-white/15 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveTournamentPerms}
                  disabled={permSaving}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {permSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save caps
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-lg mx-auto w-full">
        {!embeddedInArena && (
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
        )}
        {!embeddedInArena && hostedCredits != null && agents.some((a) => a.use_tycoon_key) && (
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
              {agents.map((a) => {
                const capRow = tournamentSpendSummary(tournamentPerms[a.id]);
                return (
                <div
                  key={a.id}
                  className={
                    embeddedInArena
                      ? "bg-gradient-to-br from-[rgba(12,22,30,0.95)] to-[rgba(4,10,16,0.98)] rounded-xl border border-cyan-500/25 p-3 flex flex-col gap-2 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
                      : "bg-gradient-to-b from-slate-900/80 to-black/80 rounded-xl border-2 border-cyan-500/30 p-3 flex flex-col gap-2"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
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
                      <p className="text-xs text-purple-400 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 flex-wrap">
                          <span>ERC-8004: {a.erc8004_agent_id}</span>
                          <a href="https://www.8004scan.io/agents" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Reputation</a>
                        </span>
                        <span className="text-[10px] text-gray-500">Linked: display XP bonus + ~12% more activity XP.</span>
                      </p>
                    )}
                    <p className={`text-[10px] mt-0.5 font-medium ${a.is_public ? "text-emerald-400/90" : "text-gray-500"}`}>
                      {a.is_public ? "Listed in Arena Discover" : "Not in Discover"}
                    </p>
                    {embeddedInArena ? (
                      <div className="mt-2 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-transparent p-2.5 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="rounded-md p-1.5 bg-cyan-500/15 border border-cyan-400/25 shrink-0">
                            <Wallet className="w-3.5 h-3.5 text-cyan-200" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-200/90">Smart wallet caps</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{capRow.text}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openTournamentPerms(a)}
                          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg border border-cyan-400/35 bg-gradient-to-r from-cyan-500/20 to-amber-500/10 text-cyan-50 font-semibold text-[11px]"
                        >
                          <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-200/90" />
                          {capRow.enabled ? "Edit caps" : "Set up spending"}
                        </button>
                      </div>
                    ) : (
                    <div
                      className={`mt-2 rounded-lg border px-2 py-1.5 text-[11px] leading-snug ${
                        capRow.enabled
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                          : "border-amber-500/45 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      <p className="font-bold uppercase tracking-wide text-[9px] opacity-90 mb-0.5 flex items-center gap-1">
                        <Trophy className="w-3 h-3 shrink-0" />
                        Tournaments &amp; staked
                      </p>
                      <p className="font-medium">{capRow.text}</p>
                    </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-start flex-wrap justify-end max-w-[9rem]">
                    <button
                      type="button"
                      onClick={() => toggleDiscoverVisibility(a)}
                      disabled={togglingDiscoverId === a.id}
                      className={`p-2 rounded-lg border ${
                        a.is_public
                          ? "border-emerald-500/45 text-emerald-300 bg-emerald-500/10"
                          : "border-white/15 text-gray-400"
                      } disabled:opacity-50`}
                      aria-label={a.is_public ? "Remove from Discover" : "Show in Arena Discover"}
                      title={a.is_public ? "Hide from Discover" : "List in Arena Discover"}
                    >
                      {togglingDiscoverId === a.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : a.is_public ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {!embeddedInArena && (
                    <button
                      type="button"
                      onClick={() => openTournamentPerms(a)}
                      className="p-2 rounded-lg border border-amber-500/40 text-amber-300"
                      aria-label="Wallet spending caps for tournaments and staked arena"
                      title="Max per match and optional daily total cap"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                    </button>
                    )}
                    {isCelo && (
                      <button
                        type="button"
                        onClick={() => handleRegisterOnCelo(a)}
                        disabled={isRegisteringErc8004 && registeringErc8004Id === a.id}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-purple-500/40 text-purple-400 text-xs"
                        title={a.erc8004_agent_id ? "Re-link: mint new ID (confirm)" : "Register on Celo (EOA). You pay gas."}
                      >
                        {isRegisteringErc8004 && registeringErc8004Id === a.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3 h-3" />
                        )}
                        {a.erc8004_agent_id ? "Relink" : "Celo"}
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
                  {!embeddedInArena && (
                  <button
                    type="button"
                    onClick={() => openTournamentPerms(a)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-100 font-bold text-[11px] uppercase tracking-wide hover:from-amber-500/35 hover:border-amber-300/60"
                  >
                    <Trophy className="w-4 h-4 shrink-0" />
                    {capRow.enabled ? "Edit wallet spending caps" : "Set up wallet spending"}
                  </button>
                  )}
                </div>
              );
              })}
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
                <div className="rounded-xl border border-amber-500/30 bg-black/60 p-4 space-y-3">
                  <p className="text-xs font-orbitron font-bold text-amber-200 uppercase tracking-wide">Behavior setup</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] text-amber-300/90 uppercase tracking-wide mb-1">Goal</label>
                      <select
                        value={behaviorProfile.goal ?? "win"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, goal: e.target.value as any }))}
                        className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="win">Win (net worth)</option>
                        <option value="maximize_prize">Maximize prize odds</option>
                        <option value="survive">Play safe</option>
                        <option value="aggressive_growth">Aggressive growth</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-300/90 uppercase tracking-wide mb-1">Risk</label>
                      <select
                        value={behaviorProfile.risk ?? "medium"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, risk: e.target.value as any }))}
                        className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-300/90 uppercase tracking-wide mb-1">Liquidity</label>
                      <select
                        value={behaviorProfile.liquidity ?? "balanced"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, liquidity: e.target.value as any }))}
                        className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="tight">Tight</option>
                        <option value="balanced">Balanced</option>
                        <option value="flush">Flush</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-amber-300/90 uppercase tracking-wide mb-1">Property focus</label>
                      <select
                        value={behaviorProfile.property_focus ?? "balanced"}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, property_focus: e.target.value as any }))}
                        className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="monopolies">Monopolies</option>
                        <option value="rail_util">Rail/Utilities</option>
                        <option value="high_rent">High rent</option>
                        <option value="cashflow">Cashflow</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-amber-300/90 uppercase tracking-wide mb-1">Extra instructions</label>
                      <textarea
                        value={behaviorProfile.notes ?? ""}
                        onChange={(e) => setBehaviorProfile((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Cash buffer, trade rules, what to prioritize..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-black/60 border border-amber-500/30 text-white text-sm"
                      />
                    </div>
                  </div>
                  <details className="rounded-lg border border-white/10 bg-black/40 p-3">
                    <summary className="text-[10px] text-slate-300 uppercase tracking-wide cursor-pointer">
                      Prompt preview
                    </summary>
                    <pre className="mt-2 text-[11px] text-slate-200 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
{behaviorToPrompt(
                        formName.trim() || "My Agent",
                        mergeGameplayIntoBehaviorProfile(
                          { ...behaviorProfile } as Record<string, unknown>,
                          agentSettings
                        ) as unknown as AgentBehaviorProfile
                      )}
                    </pre>
                  </details>
                </div>

                {/* Agent behaviour settings */}
                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">Agent behaviour when playing as you</label>
                  <p className="text-xs text-gray-500 mb-3">Saved on the agent when you tap Update / Create.</p>
                  <div className="space-y-4">
                    {(
                      [
                        {
                          key: "tradeBehavior" as const,
                          label: "Trading",
                          options: [
                            { value: "never_sell" as TradeBehavior, label: "Never sell", desc: "Always decline offers for your properties" },
                            { value: "smart" as TradeBehavior, label: "Smart", desc: "Block monopoly-completing trades; evaluate others" },
                            { value: "generous" as TradeBehavior, label: "Generous", desc: "Accept 10%+ premium offers" },
                          ],
                        },
                        {
                          key: "buildStyle" as const,
                          label: "Building",
                          options: [
                            { value: "conservative" as BuildStyle, label: "Conservative", desc: "Build only when cash > $800" },
                            { value: "balanced" as BuildStyle, label: "Balanced", desc: "Build when cash > $300" },
                            { value: "aggressive" as BuildStyle, label: "Aggressive", desc: "Build from $150+" },
                          ],
                        },
                        {
                          key: "buyStyle" as const,
                          label: "Buying",
                          options: [
                            { value: "conservative" as BuyStyle, label: "Conservative", desc: "High-value buys only; $600 reserve" },
                            { value: "balanced" as BuyStyle, label: "Balanced", desc: "Strategic buys; $400 reserve" },
                            { value: "aggressive" as BuyStyle, label: "Aggressive", desc: "Almost everything; $200 reserve" },
                          ],
                        },
                      ] as const
                    ).map(({ key, label, options }) => (
                      <div key={key}>
                        <p className="text-[11px] text-cyan-400/70 uppercase tracking-wide font-semibold mb-2">{label}</p>
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              title={opt.desc}
                              onClick={() => updateAgentSettings({ [key]: opt.value })}
                              className={`px-3 py-1.5 rounded-xl border-2 text-xs transition-all duration-200 ${
                                agentSettings[key] === opt.value
                                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 font-semibold shadow-[0_0_10px_rgba(0,240,255,0.15)]"
                                  : "border-cyan-500/30 bg-black/40 text-gray-400 hover:border-cyan-500/60"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {options.find((o) => o.value === agentSettings[key])?.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-orbitron uppercase tracking-wider text-cyan-400/90 mb-1">ERC-8004 ID (optional)</label>
                  {!editingId && (
                    <p className="text-xs text-cyan-400/80 mb-1.5">Save the agent first, then use Create on Celo to get an on-chain ID.</p>
                  )}
                  {erc8004LoadState === "loading" && (
                    <p className="text-xs text-cyan-400/80 mb-1.5 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      Checking Celo…
                    </p>
                  )}
                  {erc8004LoadState === "has_none" && !formErc8004Id.trim() && (
                    <p className="text-xs text-amber-400/90 mb-1.5">You don’t have an ERC-8004 agent on Celo. Use <strong>Create on Celo</strong> to get one.</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formErc8004Id}
                      onChange={(e) => {
                        setFormErc8004Id(e.target.value);
                        setErc8004VerifyResult(null);
                      }}
                      placeholder={erc8004LoadState === "has_none" ? "Create on Celo to get an ID" : "e.g. 12345 or create on Celo"}
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/70 border-2 border-cyan-500/40 text-white text-sm focus:border-cyan-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateOnCeloFromForm}
                      disabled={isRegisteringErc8004 || !editingId || !isCelo}
                      title={!editingId ? "Save first" : !isCelo ? "Switch to Celo" : "Create ERC-8004 ID with your browser wallet (EOA); you pay gas"}
                      className="shrink-0 px-3 py-2.5 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-orbitron font-semibold text-xs flex items-center gap-1"
                    >
                      {isRegisteringErc8004 && registeringErc8004Id === editingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {formErc8004Id.trim() ? "Mint (replace)" : "Create on Celo"}
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
                    )}
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
            {!embeddedInArena && (
            <p className="text-gray-500 text-xs mt-4">
              <a href="/arena" className="text-cyan-400">Arena</a> — challenge public agents using agents you create here.
              {" · "}
              <a href="/play-ai" className="text-cyan-400">Play vs AI</a> — use your agents when creating a game (coming soon).
            </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
