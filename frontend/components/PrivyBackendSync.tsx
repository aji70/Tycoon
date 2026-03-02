"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";

const TOKEN_KEY = "token";
function getApiBase() {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "https://base-monopoly-production.up.railway.app/api";
}

type SyncState = "idle" | "checking" | "needs_username" | "submitting" | "done";

/**
 * When the user is signed in with Privy, ensures they have a backend user (with username) and our JWT.
 * If first-time Privy user, shows a modal to choose username and calls POST /auth/privy-signin.
 */
export default function PrivyBackendSync() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const refetchGuest = guestAuth?.refetchGuest;

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const callPrivySignin = useCallback(
    async (usernameBody?: string) => {
      const apiBase = getApiBase();
      if (!apiBase) return;
      try {
        const token = await getAccessToken();
        if (!token) return;
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
        setError(data?.message ?? "Sign-in failed");
        setSyncState("idle");
      } catch (e) {
        setError((e as Error)?.message ?? "Request failed");
        setSyncState("idle");
      }
    },
    [getAccessToken, refetchGuest]
  );

  useEffect(() => {
    if (!ready || !authenticated || syncState !== "idle" || !refetchGuest) return;
    setSyncState("checking");
    callPrivySignin();
  }, [ready, authenticated]); // Run when Privy auth state becomes true; callPrivySignin/refetchGuest are stable

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
