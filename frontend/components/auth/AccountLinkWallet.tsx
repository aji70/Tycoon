"use client";

import React, { useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { Link2, Unlink, Loader2, Mail, Merge } from "lucide-react";

/** Chain id to backend chain name */
function chainIdToBackendChain(chainId: number): string {
  if (chainId === 137 || chainId === 80001) return "POLYGON";
  if (chainId === 42220 || chainId === 44787) return "CELO";
  if (chainId === 8453 || chainId === 84531) return "BASE";
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
      if (res.success) setError(null);
      else setError(res.message ?? "Link failed");
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to sign or link");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkWallet = async () => {
    if (!auth?.unlinkWallet) return;
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
      <h3 className="text-base font-semibold text-cyan-400">Account & login</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Guest & Privy: Link / Unlink wallet */}
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
              {guestUser?.is_guest && auth?.mergeGuestIntoWallet && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!address || !guestUser?.is_guest || !auth?.mergeGuestIntoWallet) return;
                    setError(null);
                    setLoading(true);
                    try {
                      const message = `Merge Tycoon guest account into wallet: ${Date.now()}`;
                      const signature = await signMessageAsync({ message });
                      const res = await auth.mergeGuestIntoWallet({
                        walletAddress: address,
                        chain,
                        message,
                        signature,
                      });
                      if (res.success) setError(null);
                      else setError(res.message ?? "Merge failed");
                    } catch (e) {
                      setError((e as Error)?.message ?? "Merge failed");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
                  Merge into wallet account
                </button>
              )}
            </div>
          )}
          {!guestUser.linked_wallet_address && isConnected && (
            <p className="text-xs text-white/50 mt-1">
              Link: keep this guest account and add the wallet. Merge: move this account’s games and stats into your wallet account (guest account is removed).
            </p>
          )}
        </>
      )}

      {/* Email: one line when logged in — connected email or prompt to link */}
      {guestUser && (
        <div className="pt-3 border-t border-white/10">
          {guestUser.email || guestUser.email_verified ? (
            <p className="text-sm text-white/90">
              Connected email: <span className="text-cyan-300">{guestUser.email ?? "—"}</span>
              {!guestUser.email_verified && guestUser.email && (
                <span className="text-white/60 text-xs ml-1">(check inbox to verify)</span>
              )}
            </p>
          ) : auth?.connectEmail ? (
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
