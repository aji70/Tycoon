"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { apiClient, ApiError } from "@/lib/api";
import { clearPendingReferralCode, peekPendingReferralCode } from "@/lib/referralCapture";

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

function attachErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const key = (err.data as { error?: string } | undefined)?.error;
    switch (key) {
      case "invalid_code":
        return "Enter a valid code (letters and numbers only).";
      case "code_not_found":
        return "That code was not found.";
      case "self_referral":
        return "You cannot use your own code.";
      case "already_referred":
        return "A referrer is already linked to your account.";
      case "user_not_found":
        return "Session expired — sign in again.";
      default:
        return err.message || "Could not apply code.";
    }
  }
  return "Could not apply code.";
}

export default function ProfileReferralCard({ enabled = true, className = "" }: Props) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [attachInput, setAttachInput] = useState("");
  const [attachSubmitting, setAttachSubmitting] = useState(false);
  const pendingPrefilled = useRef(false);

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
  const canAttachReferrer = data?.referredByUserId == null;

  useEffect(() => {
    if (!data || !canAttachReferrer || pendingPrefilled.current) return;
    const pending = peekPendingReferralCode();
    if (pending) {
      setAttachInput(pending);
      pendingPrefilled.current = true;
    }
  }, [data, canAttachReferrer]);

  const submitAttach = useCallback(async () => {
    const raw = attachInput.trim().toLowerCase();
    if (!raw) {
      toast.error("Enter a referral code.");
      return;
    }
    setAttachSubmitting(true);
    try {
      const res = await apiClient.post<{ success?: boolean; data?: { referrerUserId?: number }; error?: string }>(
        "referral/attach",
        { referralCode: raw }
      );
      const body = res.data as { success?: boolean; data?: { referrerUserId?: number }; error?: string } | undefined;
      if (!body?.success) {
        toast.error(attachErrorMessage(new ApiError(400, body?.error || "Attach failed", body)));
        return;
      }
      clearPendingReferralCode();
      await queryClient.invalidateQueries({ queryKey: ["referral-me"] });
      toast.success("Referral code applied.");
      setAttachInput("");
    } catch (e) {
      toast.error(attachErrorMessage(e));
    } finally {
      setAttachSubmitting(false);
    }
  }, [attachInput, queryClient]);

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
            Share your link. New players who open the site with <span className="font-mono text-white/80">?ref=</span> your code
            often get the code applied at sign-in; if you play with a wallet only, you can paste a friend&apos;s code below.
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
          {canAttachReferrer && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80 mb-2">Have a friend&apos;s code?</p>
              <p className="text-[11px] text-white/45 mb-2">
                One-time: link your account to their referral. You can&apos;t change this later.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                <label className="sr-only" htmlFor="tycoon-profile-referral-code">
                  Friend referral code
                </label>
                <input
                  id="tycoon-profile-referral-code"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={attachInput}
                  onChange={(e) => setAttachInput(e.target.value.trim().toLowerCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitAttach();
                    }
                  }}
                  placeholder="e.g. t1a2b3c4d5"
                  className="flex-1 min-w-0 rounded-xl bg-black/35 border border-white/15 px-3 py-2.5 text-sm font-mono text-emerald-100 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                <button
                  type="button"
                  disabled={attachSubmitting}
                  onClick={() => void submitAttach()}
                  className="shrink-0 rounded-xl bg-cyan-600/85 hover:bg-cyan-500 disabled:opacity-50 text-black text-xs font-bold px-4 py-2.5 transition"
                >
                  {attachSubmitting ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying…
                    </span>
                  ) : (
                    "Apply code"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
