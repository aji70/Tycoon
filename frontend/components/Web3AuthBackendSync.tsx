"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { usePrivy } from "@/hooks/usePrivy";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { clearPendingReferralCode, peekPendingReferralCode } from "@/lib/referralCapture";

const TOKEN_KEY = "token";
function getApiBase() {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "https://base-monopoly-production.up.railway.app/api";
}

type SyncState = "idle" | "checking" | "needs_username" | "submitting" | "done" | "sync_failed";

/**
 * When the user is signed in with Web3Auth, ensures they have a backend user and our JWT.
 * First-time users pick a username via POST /auth/web3auth-signin.
 */
export default function Web3AuthBackendSync() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const refetchGuest = guestAuth?.refetchGuest;
  const guestUser = guestAuth?.guestUser ?? null;
  const guestLoading = guestAuth?.isLoading ?? false;
  const retryCountRef = useRef(0);
  const requestIdRef = useRef(0);
  const RETRY_DELAY_MS = 1500;
  const MAX_TOKEN_RETRIES = 2;

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [username, setUsername] = useState("");
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const callWeb3AuthSignin = useCallback(
    async (usernameBody?: string, referralOverride?: string | null) => {
      const apiBase = getApiBase();
      if (!apiBase) {
        setError("API URL not configured");
        setSyncState("sync_failed");
        toast.error("Sign-in with server failed: API URL not configured.");
        return;
      }
      const thisRequestId = ++requestIdRef.current;
      const isLatest = () => thisRequestId === requestIdRef.current;
      try {
        const token = await getAccessToken();
        if (!token) {
          if (usernameBody != null) {
            if (isLatest()) {
              setError("Session expired. Please sign in again.");
              setSyncState("sync_failed");
              toast.error("Session expired. Please sign in again.");
            }
            return;
          }
          if (retryCountRef.current < MAX_TOKEN_RETRIES) {
            retryCountRef.current += 1;
            setTimeout(() => callWeb3AuthSignin(), RETRY_DELAY_MS);
            return;
          }
          retryCountRef.current = 0;
          if (isLatest()) {
            setError("Could not get session. Please try again.");
            setSyncState("sync_failed");
            toast.error("Could not get session. Please try again.");
          }
          return;
        }
        retryCountRef.current = 0;
        const typedRef = (referralOverride ?? "").trim().toLowerCase();
        const pendingRef = peekPendingReferralCode();
        const refToSend = typedRef.length > 0 ? typedRef : pendingRef ?? "";
        const bodyPayload: Record<string, string> = {};
        if (usernameBody != null) bodyPayload.username = usernameBody;
        if (refToSend && /^[a-z0-9]{2,32}$/.test(refToSend)) {
          bodyPayload.referralCode = refToSend;
        }
        const res = await fetch(`${apiBase}/auth/web3auth-signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(bodyPayload),
        });
        const text = await res.text();
        let data: { success?: boolean; message?: string; data?: { token?: string } } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          if (!isLatest()) return;
          const msg = `Server returned ${res.status} (not JSON). Is the backend running and using the same Web3Auth Client ID?`;
          setError(msg);
          setSyncState("sync_failed");
          toast.error(`Sign-in with server failed: ${msg}`);
          console.error("[Web3AuthBackendSync] web3auth-signin non-JSON response", res.status, text?.slice(0, 200));
          return;
        }
        if (!isLatest()) return;
        if (!res.ok) {
          console.error("[Web3AuthBackendSync] web3auth-signin failed", {
            status: res.status,
            url: `${apiBase}/auth/web3auth-signin`,
            body: data,
          });
        }
        if (res.ok && data?.data?.token) {
          if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, data.data.token);
          clearPendingReferralCode();
          await refetchGuest?.();
          setSyncState("done");
          setError(null);
          return;
        }
        if (res.status === 400 && (data?.message ?? "").toLowerCase().includes("username")) {
          const pending = peekPendingReferralCode();
          setReferralCodeInput((prev) => (prev.trim() ? prev : pending ?? ""));
          setSyncState("needs_username");
          setError(null);
          return;
        }
        if (res.status === 409) {
          const pending = peekPendingReferralCode();
          setReferralCodeInput((prev) => (prev.trim() ? prev : pending ?? ""));
          setError(data?.message ?? "Username already taken");
          setSyncState("needs_username");
          return;
        }
        const msg = data?.message ?? "Sign-in failed";
        setError(msg);
        setSyncState("sync_failed");
        toast.error(`Web3Auth sign-in worked, but the game server couldn't link your session: ${msg}`);
      } catch (e) {
        if (!isLatest()) return;
        const msg = (e as Error)?.message ?? "Request failed";
        setError(msg);
        setSyncState("sync_failed");
        console.error("[Web3AuthBackendSync] web3auth-signin request threw", e);
        toast.error(`Web3Auth sign-in worked, but the game server link failed: ${msg}`);
      }
    },
    [getAccessToken, refetchGuest]
  );

  useEffect(() => {
    if (!authenticated) {
      retryCountRef.current = 0;
      setSyncState("idle");
      setError(null);
      setUsername("");
      setReferralCodeInput("");
      return;
    }
  }, [authenticated]);

  useEffect(() => {
    if (!ready || !authenticated || !refetchGuest) return;
    if (guestLoading) return;

    if (guestUser) {
      setSyncState((s) => (s === "needs_username" || s === "submitting" ? s : "done"));
      return;
    }

    if (
      syncState === "needs_username" ||
      syncState === "submitting" ||
      syncState === "sync_failed" ||
      syncState === "checking"
    ) {
      return;
    }

    setSyncState("checking");
    queueMicrotask(() => {
      void callWeb3AuthSignin();
    });
  }, [ready, authenticated, refetchGuest, guestLoading, guestUser, syncState, callWeb3AuthSignin]);

  const handleRetry = useCallback(() => {
    setError(null);
    setSyncState("checking");
    callWeb3AuthSignin();
  }, [callWeb3AuthSignin]);

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }
    setError(null);
    setSyncState("submitting");
    callWeb3AuthSignin(trimmed, referralCodeInput).finally(() => {
      setSyncState((s) => (s === "submitting" ? "needs_username" : s));
    });
  };

  if (syncState === "sync_failed") {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[10000] md:left-auto md:right-4 md:max-w-sm flex items-center justify-between gap-3 rounded-xl bg-[#0E1415] border border-red-500/50 p-4 shadow-xl">
        <p className="text-sm text-red-300 flex-1">
          {error ?? "Web3Auth sign-in worked, but the game server couldn't link your session."}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="shrink-0 h-10 px-4 rounded-lg bg-[#00F0FF] text-[#010F10] font-orbitron font-bold hover:bg-[#00D4E6] transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (syncState !== "needs_username" && syncState !== "submitting") return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0E1415] border border-[#003B3E] rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-orbitron font-bold text-[#00F0FF] mb-2">Choose your username</h3>
        <p className="text-sm text-[#869298] mb-4">
          Your sign-in is already done with Web3Auth (no password). This username is your in-game name and is
          linked to your account. Next time you sign in, you&apos;re in—no password needed.
        </p>
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <div>
            <label htmlFor="web3auth-choose-username" className="sr-only">
              Username
            </label>
            <input
              id="web3auth-choose-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              minLength={2}
              maxLength={50}
              className="w-full h-12 px-4 rounded-xl bg-[#010F10] border border-[#003B3E] text-[#17ffff] font-orbitron placeholder:text-[#455A64] focus:border-[#00F0FF] focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#010F10]"
              disabled={syncState === "submitting"}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="web3auth-referral-code" className="block text-xs text-[#869298] mb-1.5">
              Referral code <span className="text-[#455A64]">(optional)</span>
            </label>
            <input
              id="web3auth-referral-code"
              type="text"
              value={referralCodeInput}
              onChange={(e) => setReferralCodeInput(e.target.value.toLowerCase())}
              placeholder="e.g. friend’s code if you have one"
              maxLength={32}
              autoComplete="off"
              className="w-full h-11 px-4 rounded-xl bg-[#010F10] border border-[#003B3E] text-[#a8d4d6] text-sm font-mono placeholder:text-[#455A64] focus:border-[#00F0FF] focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#010F10]"
              disabled={syncState === "submitting"}
            />
            <p className="text-[11px] text-[#455A64] mt-1.5">
              If you opened an invite link, this may already be filled. You can change it before continuing.
            </p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={syncState === "submitting" || username.trim().length < 2}
            className="w-full h-12 rounded-xl bg-[#00F0FF] text-[#010F10] font-orbitron font-bold hover:bg-[#00D4E6] disabled:opacity-50 transition"
          >
            {syncState === "submitting" ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
