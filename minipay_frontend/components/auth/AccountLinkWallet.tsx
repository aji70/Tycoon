"use client";

import React, { useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { usePrivy } from "@/hooks/usePrivy";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { Link2, Unlink, Loader2, Mail } from "lucide-react";
import { toast } from "react-toastify";

/** Chain id to backend chain name */
function chainIdToBackendChain(chainId: number): string {
  return "CELO";
}

export default function AccountLinkWallet() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const auth = useGuestAuthOptional();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const isPrivySignedIn = privyReady && privyAuthenticated;
  const guestUser = auth?.guestUser ?? null;
  const chain = chainIdToBackendChain(chainId);

  const handleLinkWallet = async () => {
    if (!address || !guestUser || !auth?.linkWallet) return;
    setError(null);
    setLoading(true);
    try {
      const message = `Link Tycoon account: ${guestUser.username}`;
      const signature = await signMessageAsync({ message });
      const res = await auth.linkWallet({
        walletAddress: address,
        chain,
        message,
        signature,
      });
      if (res.success) {
        setError(null);
        await auth.refetchGuest?.();
        toast.success("Wallet linked. Your profile will update to show the full connected view.");
      } else {
        setError(res.message ?? "Link failed");
      }
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to sign or link");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkWallet = async () => {
    if (!auth?.unlinkWallet) return;
    const ok = window.confirm(
      "Unlink this wallet from your Tycoon account?\n\nYou may lose easy access to this profile on this device until you link again."
    );
    if (!ok) return;
    setError(null);
    setLoading(true);
    try {
      const res = await auth.unlinkWallet();
      if (!res.success) setError(res.message ?? "Unlink failed");
    } catch (e) {
      setError((e as Error)?.message ?? "Unlink failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#0E282A] bg-[#011112]/80 p-5 space-y-3">
      <h3 className="text-base font-semibold text-cyan-400">Account, wallet & login</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {guestUser && (
        <>
          {guestUser.linked_wallet_address ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-white/80">
                Wallet linked: {guestUser.linked_wallet_address.slice(0, 6)}...{guestUser.linked_wallet_address.slice(-4)}
              </p>
              <button
                type="button"
                onClick={handleUnlinkWallet}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Unlink wallet
              </button>
            </div>
          ) : (
            <p className="text-sm text-white/70">
              Link your wallet to use the same account when you connect (staked games, same stats).
              {!isConnected && (
                <span className="block mt-1 text-cyan-300/90">
                  Connect your wallet in the navbar, then return here to click &quot;Link this wallet&quot;.
                </span>
              )}
            </p>
          )}
          {!guestUser.linked_wallet_address && isConnected && address && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLinkWallet}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium hover:bg-cyan-500/35 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Link this wallet
              </button>
            </div>
          )}
          {!guestUser.linked_wallet_address && isConnected && (
            <p className="text-xs text-white/50 mt-1">
              Link this wallet to your account. If the wallet is already registered, accounts will be merged.
            </p>
          )}
        </>
      )}

      {guestUser && (
        <div className="pt-3 border-t border-white/10">
          {guestUser.email || guestUser.email_verified ? (
            <p className="text-sm text-white/90">
              Connected email: <span className="text-cyan-300">{guestUser.email ?? "—"}</span>
              {!guestUser.email_verified && guestUser.email && (
                <span className="text-white/60 text-xs ml-1">(check inbox to verify)</span>
              )}
            </p>
          ) : isPrivySignedIn ? (
            <p className="text-sm text-white/70">You signed in with Privy — same account on any device.</p>
          ) : !guestUser.linked_wallet_address && auth?.connectEmail ? (
            <>
              <p className="text-sm text-white/70 mb-2">Link your email to use the same profile from any device.</p>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!email.trim() || !emailPassword) return;
                  setEmailLoading(true);
                  setError(null);
                  const res = await auth.connectEmail(email.trim(), emailPassword);
                  setEmailLoading(false);
                  if (!res.success) setError(res.message ?? "Failed");
                }}
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm"
                />
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium disabled:opacity-50"
                >
                  {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Link email
                </button>
              </form>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
