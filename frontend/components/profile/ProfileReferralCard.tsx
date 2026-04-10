"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Copy, Check, Loader2 } from "lucide-react";
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

  const query = useQuery({
    queryKey: ["referral-me"],
    queryFn: async () => {
      const res = await apiClient.get("referral/me");
      const backend = res.data as { success?: boolean; data?: ReferralMePayload } | undefined;
      return backend?.data ?? null;
    },
    enabled: enabled && hasBackendToken(),
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

  if (!enabled || !hasBackendToken()) {
    return null;
  }

  if (query.isLoading) {
    return (
      <div
        className={`rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex items-center gap-3 text-emerald-200/80 text-sm ${className}`}
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

  if (!code) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/90 mb-1">Invite friends</p>
          <p className="text-xs text-white/60 mb-3">
            Share your link. When they sign up with Privy, your code is applied automatically if they opened the site with{" "}
            <span className="font-mono text-white/80">?ref=</span> your code.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-sm text-emerald-200 bg-black/30 px-3 py-1.5 rounded-lg border border-emerald-500/20 truncate max-w-full">
              {code}
            </span>
            <button
              type="button"
              onClick={() => copyText("Code", code, "code")}
              className="p-2 rounded-lg bg-white/10 hover:bg-emerald-500/20 border border-white/10 text-emerald-200 transition shrink-0"
              title="Copy code"
            >
              {copied === "code" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {shareUrl ? (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => copyText("Link", shareUrl, "link")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-black text-xs font-bold transition"
              >
                {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy invite link
              </button>
            </div>
          ) : null}
          <p className="text-[11px] text-white/45 mt-3">
            Friends invited (signed up with your code):{" "}
            <span className="text-emerald-300/90 font-semibold tabular-nums">{data?.directReferralsCount ?? 0}</span>
          </p>
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
