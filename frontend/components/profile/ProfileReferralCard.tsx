"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Gift, Copy, Check, Loader2, Zap } from "lucide-react";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";

type ReferralMePayload = {
  referralCode?: string | null;
  directReferralsCount?: number;
  referredByUserId?: number | null;
  referredByUsername?: string | null;
  referredAt?: string | null;
  shareQuery?: string | null;
};

function hasBackendToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem("token")?.trim());
  } catch {
    return false;
  }
}

function buildShareUrl(shareQuery: string | null | undefined, code: string | null | undefined): string {
  if (typeof window === "undefined") return "";
  const q = (shareQuery && shareQuery.trim()) || (code ? `ref=${encodeURIComponent(code)}` : "");
  if (!q) return "";
  return `${window.location.origin}/?${q}`;
}

type Props = {
  /** If false, skip fetch (no JWT). */
  enabled?: boolean;
  className?: string;
};

export default function ProfileReferralCard({ enabled = true, className = "" }: Props) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [generating, setGenerating] = useState(false);
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["referral-me", address],
    queryFn: async () => {
      const hasToken = hasBackendToken();
      const params: Record<string, string> = {};

      // If wallet connected but no token, pass address to backend
      if (address && !hasToken) {
        params.address = address;
      }

      const res = await apiClient.get("referral/me", { params });
      const backend = res.data as { success?: boolean; data?: ReferralMePayload } | undefined;
      return backend?.data ?? null;
    },
    enabled: enabled && (hasBackendToken() || !!address),
    staleTime: 60_000,
    retry: false,
  });

  const data = query.data;
  const code = data?.referralCode ?? null;
  const shareUrl = buildShareUrl(data?.shareQuery ?? null, code);

  const copyText = useCallback(async (label: string, text: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  const handleGenerateCode = useCallback(async () => {
    if (!address) return;
    setGenerating(true);
    try {
      await apiClient.get("referral/me", { params: { address } });
      await queryClient.invalidateQueries({ queryKey: ["referral-me", address] });
      toast.success("Referral code generated!");
    } catch (err) {
      toast.error("Failed to generate code");
    } finally {
      setGenerating(false);
    }
  }, [address, queryClient]);

  if (!enabled) {
    return null;
  }

  if (query.isLoading) {
    return (
      <div
        className={`rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4 flex items-center gap-3 text-cyan-200/80 text-sm ${className}`}
      >
        <Loader2 className="w-5 h-5 animate-spin shrink-0" />
        Loading referral link…
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50 ${className}`}>
        Referral link unavailable (update the app or sign in again).
      </div>
    );
  }

  const showPlaceholder = !code && !query.isLoading && !query.isError;

  if (showPlaceholder) {
    if (address) {
      return (
        <div
          className={`rounded-2xl border border-cyan-500/30 bg-slate-800/60 p-4 sm:p-5 shadow-lg shadow-cyan-500/5 ${className}`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90 mb-2 font-orbitron">Invite Friends</p>
              <p className="text-xs text-cyan-300/70 mb-3">
                Generate your unique referral code and start earning <span className="font-semibold text-amber-400">$0.10 USDC</span> for every friend who joins!
              </p>
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                className="w-full px-3 py-2 rounded-xl border-2 border-cyan-400 bg-cyan-500/20 text-cyan-300 text-xs font-bold font-orbitron transition hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-1 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 inline mr-1" />
                    Generate Code
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`rounded-2xl border border-cyan-500/30 bg-slate-800/60 p-4 sm:p-5 shadow-lg shadow-cyan-500/5 ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-cyan-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90 mb-1 font-orbitron">Invite Friends</p>
            <p className="text-xs text-cyan-300/70">
              Sign in to see your unique referral code and start earning <span className="font-semibold text-amber-400">$0.10 USDC</span> for every friend who joins!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-cyan-500/30 bg-slate-800/60 p-4 sm:p-5 shadow-lg shadow-cyan-500/5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-cyan-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90 mb-1 font-orbitron">Invite Friends</p>
          <p className="text-xs text-cyan-300/70 mb-1">
            Earn <span className="font-semibold text-amber-400">$0.10 USDC</span> for every friend who signs up with your code
          </p>
          <p className="text-xs text-white/60 mb-3">
            Share your link. New players who open the site with <span className="font-mono text-white/80">?ref=</span> your code will have it applied at sign-in.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="font-mono text-sm text-cyan-300 bg-[#0A1A1B] px-3 py-1.5 rounded-lg border border-cyan-500/40 truncate max-w-full">
              {code}
            </span>
            <button
              type="button"
              onClick={() => copyText("Code", code!, "code")}
              className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition shrink-0"
              title="Copy code"
            >
              {copied === "code" ? <Check className="w-4 h-4 text-cyan-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {shareUrl ? (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => copyText("Link", shareUrl, "link")}
                className="w-full px-3 py-2 rounded-xl border-2 border-cyan-400 bg-cyan-500/20 text-cyan-300 text-xs font-bold font-orbitron transition hover:shadow-lg hover:shadow-cyan-500/30"
              >
                {copied === "link" ? <Check className="w-4 h-4 inline mr-1" /> : <Copy className="w-4 h-4 inline mr-1" />}
                Copy Invite Link
              </button>
            </div>
          ) : null}
          {(() => {
            const referralCount = data?.directReferralsCount ?? 0;
            const earnedAmount = (referralCount * 0.10).toFixed(2);
            return (
              <div className="mt-3 pt-3 border-t border-cyan-500/20 space-y-1">
                <p className="text-[11px] text-cyan-300/70">
                  Friends invited:{" "}
                  <span className="font-semibold text-cyan-300 tabular-nums">{referralCount}</span>
                  {" "}·{" "}
                  Total earned:{" "}
                  <span className="font-bold text-amber-400 tabular-nums">${earnedAmount} USDC</span>
                </p>
              </div>
            );
          })()}
          {data?.referredByUserId != null && (
            <p className="text-[11px] text-white/40 mt-1">
              You were referred by{" "}
              <span className="text-white/70">{data.referredByUsername ?? `user #${data.referredByUserId}`}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
