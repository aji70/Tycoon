"use client";

import React, { useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useProfileOwner, useTransferProfileTo } from "@/context/ContractProvider";
import { Link2, Unlink, Loader2, Mail, Wallet, ArrowRightLeft } from "lucide-react";
import { Address, isAddress } from "viem";

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
  const [createWalletLoading, setCreateWalletLoading] = useState(false);
  const [transferToAddress, setTransferToAddress] = useState("");
  const hasSmartWallet = !!(guestUser?.smart_wallet_address && String(guestUser.smart_wallet_address).trim() && guestUser.smart_wallet_address !== "0x0000000000000000000000000000000000000000");
  const smartWalletAddress = hasSmartWallet ? (guestUser!.smart_wallet_address as Address) : undefined;
  const { data: profileOwner, isLoading: profileOwnerLoading } = useProfileOwner(smartWalletAddress);
  const { transfer: transferProfileTo, isPending: transferPending } = useTransferProfileTo();
  const zeroAddr = "0x0000000000000000000000000000000000000000" as Address;
  const isConnectedOwner = !!address && !!profileOwner && profileOwner !== zeroAddr && address.toLowerCase() === profileOwner.toLowerCase();
  const needsTransferToLink = hasSmartWallet && !!profileOwner && profileOwner !== zeroAddr && !!address && address.toLowerCase() !== profileOwner.toLowerCase();

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

  const handleCreateSmartWallet = async () => {
    if (!auth?.createSmartWallet) return;
    setError(null);
    setCreateWalletLoading(true);
    try {
      const res = await auth.createSmartWallet({ chain });
      if (!res.success) setError(res.message ?? "Failed to create smart wallet");
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to create smart wallet");
    } finally {
      setCreateWalletLoading(false);
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

  const handleTransferProfileTo = async () => {
    const addr = transferToAddress.trim();
    if (!addr || !isAddress(addr)) {
      setError("Enter a valid 0x address");
      return;
    }
    setError(null);
    try {
      await transferProfileTo(addr as Address);
      setTransferToAddress("");
      auth?.refetchGuest?.();
    } catch (e) {
      setError((e as Error)?.message ?? "Transfer failed");
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
          {needsTransferToLink && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200/90">
              <p className="font-medium mb-1">Transfer profile first</p>
              <p className="text-white/80">
                Your smart wallet is owned by <span className="font-mono text-cyan-300">{profileOwner?.slice(0, 6)}...{profileOwner?.slice(-4)}</span>. To link this wallet ({address?.slice(0, 6)}...{address?.slice(-4)}): connect with the owner wallet above, use &quot;Transfer profile to address&quot; below and enter this wallet, then connect back here and click Link.
              </p>
            </div>
          )}
          {!guestUser.linked_wallet_address && isConnected && address && !needsTransferToLink && (
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
          {!guestUser.linked_wallet_address && isConnected && !needsTransferToLink && (
            <p className="text-xs text-white/50 mt-1">
              Link this wallet to your account. If the wallet is already registered, accounts will be merged.
            </p>
          )}
          {hasSmartWallet && (profileOwnerLoading || isConnectedOwner) && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-sm text-white/70 mb-2">Transfer profile to another wallet</p>
              {!profileOwnerLoading && profileOwner && profileOwner !== zeroAddr && (
                <p className="text-xs text-white/50 mb-2">Current on-chain owner: {profileOwner.slice(0, 6)}...{profileOwner.slice(-4)}</p>
              )}
              {isConnectedOwner && (
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={transferToAddress}
                    onChange={(e) => setTransferToAddress(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTransferProfileTo}
                    disabled={transferPending || !transferToAddress.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-300 text-sm font-medium hover:bg-amber-500/35 disabled:opacity-50"
                  >
                    {transferPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                    Transfer to address
                  </button>
                </div>
              )}
              {!isConnectedOwner && !profileOwnerLoading && (
                <p className="text-xs text-white/50">Connect with the current owner wallet to transfer.</p>
              )}
            </div>
          )}

          {/* Create smart wallet: when user has no smart wallet (works without linking EOA) */}
          {!hasSmartWallet && auth?.createSmartWallet && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-sm text-white/70 mb-2">Smart wallet (for gasless play, rewards)</p>
              <button
                type="button"
                onClick={handleCreateSmartWallet}
                disabled={createWalletLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium hover:bg-cyan-500/35 disabled:opacity-50"
              >
                {createWalletLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Create smart wallet
              </button>
              <p className="text-xs text-white/50 mt-1">You can have a smart wallet without linking an external wallet.</p>
            </div>
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
