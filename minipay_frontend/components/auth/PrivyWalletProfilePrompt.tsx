"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useChainId, useSignMessage } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { toast } from "react-toastify";

function chainIdToBackendChain(chainId: number): string {
  return "CELO";
}

const zero = "0x0000000000000000000000000000000000000000";

function isValidAddr(a: string | null | undefined): a is string {
  if (!a || typeof a !== "string") return false;
  const s = a.trim();
  if (s.toLowerCase() === zero) return false;
  return /^0x[a-fA-F0-9]{40}$/i.test(s);
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export type PrivyWalletProfilePromptProps = {
  guestId: number;
  guestUsername: string;
  linkedWalletAddress: string | null | undefined;
  connectedAddress: string;
  /** True when we’re in the “guest / link” profile path and the account has no linked EOA yet */
  showLinkFirstPrompt: boolean;
};

/**
 * Privy (or guest JWT) user on /profile with wagmi connected:
 * - Wrong linked wallet: offer to replace linked wallet with the connected one (No = default, dismiss only).
 * - No linked wallet: offer to link this wallet (Yes = default).
 */
export default function PrivyWalletProfilePrompt({
  guestId,
  guestUsername,
  linkedWalletAddress,
  connectedAddress,
  showLinkFirstPrompt,
}: PrivyWalletProfilePromptProps) {
  const auth = useGuestAuthOptional();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const chain = chainIdToBackendChain(chainId);

  const hasLinked = isValidAddr(linkedWalletAddress);
  const wrongLinked =
    hasLinked && linkedWalletAddress!.toLowerCase().trim() !== connectedAddress.toLowerCase().trim();

  const dismissWrongKey = `tycoon-wrong-linked-prompt-${guestId}-${connectedAddress.toLowerCase()}`;
  const dismissLinkKey = `tycoon-link-wallet-prompt-${guestId}-${connectedAddress.toLowerCase()}`;

  const [openWrong, setOpenWrong] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (wrongLinked) {
      try {
        if (!sessionStorage.getItem(dismissWrongKey)) setOpenWrong(true);
        else setOpenWrong(false);
      } catch {
        setOpenWrong(true);
      }
    } else {
      setOpenWrong(false);
    }
  }, [wrongLinked, dismissWrongKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (showLinkFirstPrompt && !hasLinked) {
      try {
        if (!sessionStorage.getItem(dismissLinkKey)) setOpenLink(true);
        else setOpenLink(false);
      } catch {
        setOpenLink(true);
      }
    } else {
      setOpenLink(false);
    }
  }, [showLinkFirstPrompt, hasLinked, dismissLinkKey]);

  const dismissWrong = () => {
    try {
      sessionStorage.setItem(dismissWrongKey, "1");
    } catch {
      /* ignore */
    }
    setOpenWrong(false);
  };

  const dismissLink = () => {
    try {
      sessionStorage.setItem(dismissLinkKey, "1");
    } catch {
      /* ignore */
    }
    setOpenLink(false);
  };

  const replaceLinkedWithConnected = useCallback(async () => {
    if (!auth?.unlinkWallet || !auth?.linkWallet) return;
    setBusy(true);
    try {
      const u = await auth.unlinkWallet();
      if (!u.success) {
        toast.error((u as { message?: string }).message ?? "Could not unlink your current linked wallet");
        return;
      }
      await auth.refetchGuest?.();
      const message = `Link Tycoon account: ${guestUsername}`;
      const signature = await signMessageAsync({ message });
      const res = await auth.linkWallet({
        walletAddress: connectedAddress,
        chain,
        message,
        signature,
      });
      if (res.success) {
        toast.success("This wallet is now your linked wallet.");
        try {
          sessionStorage.setItem(dismissWrongKey, "1");
        } catch {
          /* ignore */
        }
        setOpenWrong(false);
      } else {
        toast.error(res.message ?? "Link failed after unlink. Try linking again from Account below.");
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [auth, signMessageAsync, connectedAddress, chain, dismissWrongKey, guestUsername]);

  const linkConnectedOnly = useCallback(async () => {
    if (!auth?.linkWallet) return;
    setBusy(true);
    try {
      const message = `Link Tycoon account: ${guestUsername}`;
      const signature = await signMessageAsync({ message });
      const res = await auth.linkWallet({
        walletAddress: connectedAddress,
        chain,
        message,
        signature,
      });
      if (res.success) {
        toast.success("Wallet linked.");
        try {
          sessionStorage.setItem(dismissLinkKey, "1");
        } catch {
          /* ignore */
        }
        setOpenLink(false);
      } else {
        toast.error(res.message ?? "Link failed");
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to sign or link");
    } finally {
      setBusy(false);
    }
  }, [auth, signMessageAsync, connectedAddress, chain, dismissLinkKey, guestUsername]);

  if (!openWrong && !openLink) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && (openWrong ? dismissWrong() : dismissLink())}
    >
      {openWrong ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privy-wrong-linked-title"
          className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-[#061416] p-5 shadow-xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="privy-wrong-linked-title" className="text-lg font-semibold text-white mb-2">
            Different wallet connected
          </h2>
          <p className="text-sm text-white/80 leading-relaxed mb-1">
            You’re signed in as <span className="text-cyan-300 font-medium">{guestUsername}</span>. Your Tycoon account is linked to{" "}
            <span className="font-mono text-cyan-200/90">{shortAddr(linkedWalletAddress!)}</span>, but your app wallet is{" "}
            <span className="font-mono text-cyan-200/90">{shortAddr(connectedAddress)}</span>.
          </p>
          <p className="text-sm text-white/70 mb-5">
            You can keep viewing your Tycoon account here (stats, perks, smart wallet), or replace your linked wallet with the one you have connected now. Replacing unlinks the old address and links this one—you’ll sign a message to confirm.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={dismissWrong}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-cyan-500/45 bg-cyan-500/15 text-cyan-100 text-sm font-semibold hover:bg-cyan-500/25 disabled:opacity-50"
            >
              No — keep my Tycoon account here
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void replaceLinkedWithConnected()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-amber-500/50 bg-amber-500/15 text-amber-100 text-sm font-semibold hover:bg-amber-500/25 disabled:opacity-50"
            >
              {busy ? "Working…" : "Yes — replace linked wallet with this one"}
            </button>
          </div>
        </div>
      ) : null}

      {openLink ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privy-link-first-title"
          className="w-full max-w-md rounded-2xl border border-cyan-500/35 bg-[#061416] p-5 shadow-xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="privy-link-first-title" className="text-lg font-semibold text-white mb-2">
            Link this wallet?
          </h2>
          <p className="text-sm text-white/80 leading-relaxed mb-5">
            Connect wallet <span className="font-mono text-cyan-200/90">{shortAddr(connectedAddress)}</span> to your Tycoon account so the same progress and stats load when you use this wallet in the app.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={dismissLink}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white/85 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              Not now
            </button>
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={() => void linkConnectedOnly()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-cyan-500/50 bg-cyan-500/25 text-cyan-100 text-sm font-semibold hover:bg-cyan-500/35 disabled:opacity-50"
            >
              {busy ? "Working…" : "Yes — link this wallet"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
