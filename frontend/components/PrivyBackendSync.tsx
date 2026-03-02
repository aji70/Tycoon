"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "react-toastify";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";

const TOKEN_KEY = "token";
function getApiBase() {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "https://base-monopoly-production.up.railway.app/api";
}

type SyncState = "idle" | "checking" | "needs_username" | "submitting" | "done" | "sync_failed";

/**
 * When the user is signed in with Privy, ensures they have a backend user (with username) and our JWT.
 * If first-time Privy user, shows a modal to choose username and calls POST /auth/privy-signin.
 */
export default function PrivyBackendSync() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const refetchGuest = guestAuth?.refetchGuest;
  const retryCountRef = useRef(0);
  const RETRY_DELAY_MS = 1500;
  const MAX_TOKEN_RETRIES = 2;

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const callPrivySignin = useCallback(
    async (usernameBody?: string) => {
      const apiBase = getApiBase();
      if (!apiBase) {
        setError("API URL not configured");
        setSyncState("sync_failed");
        toast.error("Sign-in with server failed: API URL not configured.");
        return;
      }
      try {
        const token = await getAccessToken();
        if (!token) {
          if (usernameBody != null) {
            setError("Session expired. Please sign in again.");
            setSyncState("sync_failed");
            toast.error("Session expired. Please sign in again.");
            return;
          }
          if (retryCountRef.current < MAX_TOKEN_RETRIES) {
            retryCountRef.current += 1;
            setTimeout(() => callPrivySignin(), RETRY_DELAY_MS);
            return;
          }
          retryCountRef.current = 0;
          setError("Could not get session. Please try again.");
          setSyncState("sync_failed");
          toast.error("Could not get session. Please try again.");
          return;
        }
        retryCountRef.current = 0;
        const res = await fetch(`${apiBase}/auth/privy-signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(usernameBody != null ? { username: usernameBody } : {}),
        });
        const data = await res.json();
        if (res.ok && data?.data?.token) {
          if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, data.data.token);
          await refetchGuest?.();
          setSyncState("done");
          setError(null);
          return;
        }
        if (res.status === 400 && (data?.message ?? "").toLowerCase().includes("username")) {
          setSyncState("needs_username");
          setError(null);
          return;
        }
        if (res.status === 409) {
          setError(data?.message ?? "Username already taken");
          setSyncState("needs_username");
          return;
        }
        const msg = data?.message ?? "Sign-in failed";
        setError(msg);
        setSyncState("sync_failed");
        toast.error(`Sign-in with server failed: ${msg}`);
      } catch (e) {
        const msg = (e as Error)?.message ?? "Request failed";
        setError(msg);
        setSyncState("sync_failed");
        toast.error(`Sign-in with server failed: ${msg}`);
      }
    },
    [getAccessToken, refetchGuest]
  );

  useEffect(() => {
    if (!authenticated) {
      retryCountRef.current = 0;
      setSyncState("idle");
      setError(null);
      return;
    }
  }, [authenticated]);

  useEffect(() => {
    if (!ready || !authenticated || !refetchGuest) return;
    if (syncState !== "idle") return;
    setSyncState("checking");
    callPrivySignin();
  }, [ready, authenticated]); // Run when Privy auth state becomes true; callPrivySignin/refetchGuest are stable

  const handleRetry = useCallback(() => {
    setError(null);
    setSyncState("checking");
    callPrivySignin();
  }, [callPrivySignin]);

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }
    setError(null);
    setSyncState("submitting");
    callPrivySignin(trimmed).finally(() => {
      setSyncState((s) => (s === "submitting" ? "needs_username" : s));
    });
  };

  // Sync failed: show banner with retry (user is Privy-signed-in but backend registration failed)
  if (syncState === "sync_failed") {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[10000] md:left-auto md:right-4 md:max-w-sm flex items-center justify-between gap-3 rounded-xl bg-[#0E1415] border border-red-500/50 p-4 shadow-xl">
        <p className="text-sm text-red-300 flex-1">{error ?? "Sign-in with server failed."}</p>
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
          Your sign-in is already done with Privy (no password). This username is your in-game name and is linked to your Privy account. Next time you sign in with Privy, you’re in—no password needed.
        </p>
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            minLength={2}
            maxLength={50}
            className="w-full h-12 px-4 rounded-xl bg-[#010F10] border border-[#003B3E] text-[#17ffff] font-orbitron placeholder:text-[#455A64] focus:border-[#00F0FF] focus:outline-none"
            disabled={syncState === "submitting"}
            autoFocus
          />
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
