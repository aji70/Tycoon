"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { Wallet, X } from "lucide-react";

const SKIP_KEY = "tycoon_add_wallet_modal_skipped";

function getSkipped(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  return window.localStorage.getItem(SKIP_KEY) === "1";
}

function setSkipped(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(SKIP_KEY, "1");
    }
  } catch {
    // ignore
  }
}

/**
 * Shown once after Privy sign-in when the user has no smart wallet yet.
 * [Add wallet] → profile (to link wallet); [Skip] → dismiss and remember.
 */
export default function AddWalletPromptModal() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;

  const [skipped, setSkippedState] = React.useState(false);

  React.useEffect(() => {
    setSkippedState(getSkipped());
  }, []);

  const hasSmartWallet =
    !!guestUser?.smart_wallet_address && String(guestUser.smart_wallet_address).trim() !== "";
  const show =
    authenticated &&
    !!guestUser &&
    !hasSmartWallet &&
    !skipped;

  const handleAddWallet = () => {
    setSkipped();
    setSkippedState(true);
    router.push("/profile");
  };

  const handleSkip = () => {
    setSkipped();
    setSkippedState(true);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0E1415] border border-[#003B3E] rounded-2xl shadow-xl max-w-md w-full p-6 relative">
        <button
          type="button"
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 rounded-lg text-[#869298] hover:text-[#00F0FF] hover:bg-[#003B3E]/50 transition"
          aria-label="Skip"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#003B3E]/50 flex items-center justify-center mb-4">
            <Wallet className="w-7 h-7 text-[#00F0FF]" />
          </div>
          <h3 className="text-lg font-orbitron font-bold text-[#00F0FF] mb-2">
            Add a wallet to play
          </h3>
          <p className="text-sm text-[#869298] mb-6">
            Link a wallet in your profile to unlock Challenge AI, Multiplayer, and Join Room. You can do it now or later from Profile.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={handleAddWallet}
              className="flex-1 h-12 rounded-xl bg-[#00F0FF] text-[#010F10] font-orbitron font-bold hover:bg-[#00D4E6] transition"
            >
              Add wallet
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 h-12 rounded-xl border border-[#003B3E] text-[#869298] font-dmSans font-medium hover:border-[#00F0FF]/50 hover:text-[#00F0FF]/80 transition"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
