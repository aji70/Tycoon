"use client";

import { useAppKit } from "@reown/appkit/react";
import { usePrivy } from "@privy-io/react-auth";
import { Wallet, LogIn, X } from "lucide-react";

type StickyBarProps = {
  canAct: boolean;
  authLoading: boolean;
};

/** Shown at top of join flow when visitor has no wallet session and no guest JWT. */
export function JoinRoomAuthStickyBar({ canAct, authLoading }: StickyBarProps) {
  const { open } = useAppKit();
  const { ready, login } = usePrivy();

  if (authLoading || canAct) return null;

  return (
    <div className="sticky top-0 z-30 -mx-6 sm:-mx-8 lg:-mx-12 mb-6 rounded-xl border border-amber-500/40 bg-[#0A1214]/95 backdrop-blur-md px-4 py-3 shadow-lg shadow-black/40">
      <p className="text-amber-100/95 text-xs sm:text-sm font-orbitron text-center mb-3 leading-snug">
        Connect a wallet or sign in free (email / social) to browse open games, continue a match, or host.
        You can still enter a room code below without signing in.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:justify-center sm:items-center">
        <button
          type="button"
          onClick={() => open()}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] px-4 py-2.5 font-orbitron font-bold text-black hover:opacity-95 transition-opacity"
        >
          <Wallet className="w-4 h-4 shrink-0" />
          Connect wallet
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => void login()}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-[#00F0FF]/60 bg-[#010F10]/80 px-4 py-2.5 font-orbitron font-bold text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors disabled:opacity-50"
        >
          <LogIn className="w-4 h-4 shrink-0" />
          Sign in free
        </button>
      </div>
    </div>
  );
}

type ModalProps = {
  open: boolean;
  hint: string;
  onDismiss: () => void;
};

export function JoinRoomAuthModal({ open, hint, onDismiss }: ModalProps) {
  const { open: openWallet } = useAppKit();
  const { ready, login } = usePrivy();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-room-auth-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#00F0FF]/40 bg-[#0A1A1B] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 id="join-room-auth-title" className="text-lg font-orbitron font-bold text-[#00F0FF] mb-2 pr-10">
          Sign in to continue
        </h2>
        <p className="text-sm text-slate-300 mb-5 leading-relaxed">{hint}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => openWallet()}
            className="inline-flex flex-1 items-center justify-center gap-2 min-h-[44px] rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] px-4 py-2.5 font-orbitron font-bold text-black"
          >
            <Wallet className="w-4 h-4" />
            Connect wallet
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => void login()}
            className="inline-flex flex-1 items-center justify-center gap-2 min-h-[44px] rounded-xl border border-[#00F0FF]/50 px-4 py-2.5 font-orbitron font-bold text-[#00F0FF] hover:bg-[#00F0FF]/10 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            Sign in free
          </button>
        </div>
        <p className="text-[0.65rem] text-slate-500 mt-4 leading-snug">
          After you connect or sign in, we continue what you started. Cancel clears this step.
        </p>
      </div>
    </div>
  );
}
