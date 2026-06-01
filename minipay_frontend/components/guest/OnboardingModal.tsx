"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { usePrivy } from "@privy-io/react-auth";
import { X, Wallet, Gamepad2, Dices, Sparkles } from "lucide-react";

const ONBOARDING_STORAGE_KEY = "tycoon_onboarding_done";

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
}

export function setOnboardingDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
}

interface OnboardingModalProps {
  onDismiss?: () => void;
}

export default function OnboardingModal({ onDismiss }: OnboardingModalProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { open: openAppKit } = useAppKit();
  const { ready, authenticated, login } = usePrivy();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    if (hasSeenOnboarding()) return;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum;
    setIsMiniPay(Boolean(eth?.isMiniPay));
  }, []);

  const handleDismiss = () => {
    setOnboardingDone();
    setOpen(false);
    onDismiss?.();
  };

  const handleConnect = () => {
    if (openAppKit) {
      openAppKit?.();
      return;
    }
    if (!isMiniPay && ready && !authenticated) {
      login();
    }
  };

  const handleCreateGame = () => {
    setOnboardingDone();
    setOpen(false);
    router.push("/game-settings-3d");
    onDismiss?.();
  };

  const handleJoinGame = () => {
    setOnboardingDone();
    setOpen(false);
    router.push("/join-room-3d");
    onDismiss?.();
  };

  const handlePlayAI = () => {
    setOnboardingDone();
    setOpen(false);
    router.push("/play-ai-3d");
    onDismiss?.();
  };

  if (!open) return null;

  const isSignedIn = isConnected || authenticated;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#003B3E] bg-[#0A1618] shadow-[0_0_60px_rgba(0,240,255,0.12)] overflow-hidden">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 p-2.5">
              <Sparkles className="w-8 h-8 text-[#00F0FF]" />
            </div>
            <h2 id="onboarding-title" className="font-orbitron text-xl sm:text-2xl font-bold text-white">
              Welcome to Tycoon
            </h2>
          </div>

          <p className="text-slate-300 text-sm sm:text-base font-dmSans mb-6 leading-relaxed">
            Get started in two steps: connect (or sign in), then create or join a game.
          </p>

          {step === 1 && (
            <>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3 rounded-xl bg-[#0E1415]/80 border border-[#003B3E] p-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] font-orbitron font-bold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-white font-dmSans">Sign in or connect wallet</p>
                    <p className="text-slate-400 text-sm mt-0.5">Use email (magic link, no password) or connect a Web3 wallet to play.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-[#0E1415]/80 border border-[#003B3E] p-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] font-orbitron font-bold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-white font-dmSans">Create or join a game</p>
                    <p className="text-slate-400 text-sm mt-0.5">Start a multiplayer room, join with a code, or play solo vs AI.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {!isSignedIn && (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-[#010F10] font-orbitron font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                  >
                    <Wallet className="w-5 h-5" />
                    Connect wallet
                  </button>
                )}
                {isSignedIn && (
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-[#010F10] font-orbitron font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                  >
                    Next: Create or join game
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-3 rounded-xl border border-[#003B3E] text-slate-400 font-dmSans text-sm hover:text-[#00F0FF] hover:border-[#00F0FF]/40 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-slate-400 text-sm mb-6">Choose how you want to play:</p>
              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={handleCreateGame}
                  className="w-full py-4 rounded-xl border border-[#003B3E] bg-[#0E1415]/80 text-left px-5 flex items-center gap-4 hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/5 transition-all group"
                >
                  <div className="rounded-xl bg-[#00F0FF]/10 p-2.5 group-hover:bg-[#00F0FF]/20 transition-colors">
                    <Gamepad2 className="w-6 h-6 text-[#00F0FF]" />
                  </div>
                  <div>
                    <p className="font-orbitron font-semibold text-white">Create game</p>
                    <p className="text-slate-400 text-sm font-dmSans">Start a new multiplayer room and invite friends</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleJoinGame}
                  className="w-full py-4 rounded-xl border border-[#003B3E] bg-[#0E1415]/80 text-left px-5 flex items-center gap-4 hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/5 transition-all group"
                >
                  <div className="rounded-xl bg-[#00F0FF]/10 p-2.5 group-hover:bg-[#00F0FF]/20 transition-colors">
                    <Dices className="w-6 h-6 text-[#00F0FF]" />
                  </div>
                  <div>
                    <p className="font-orbitron font-semibold text-white">Join with code</p>
                    <p className="text-slate-400 text-sm font-dmSans">Enter a 6-letter code to join a friend&apos;s game</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handlePlayAI}
                  className="w-full py-4 rounded-xl border border-[#003B3E] bg-[#0E1415]/80 text-left px-5 flex items-center gap-4 hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/5 transition-all group"
                >
                  <div className="rounded-xl bg-[#00F0FF]/10 p-2.5 group-hover:bg-[#00F0FF]/20 transition-colors">
                    <Sparkles className="w-6 h-6 text-[#00F0FF]" />
                  </div>
                  <div>
                    <p className="font-orbitron font-semibold text-white">Play vs AI</p>
                    <p className="text-slate-400 text-sm font-dmSans">Solo game against AI opponents — no code needed</p>
                  </div>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2.5 text-slate-500 text-sm font-dmSans hover:text-[#00F0FF] transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full mt-2 py-3 rounded-xl border border-[#003B3E] text-slate-400 font-dmSans text-sm hover:text-[#00F0FF] hover:border-[#00F0FF]/40 transition-colors"
              >
                I&apos;ll explore on my own
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
