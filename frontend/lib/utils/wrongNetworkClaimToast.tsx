"use client";

import { toast } from "react-hot-toast";
import { Globe } from "lucide-react";

const WRONG_NETWORK_MSG =
  "Your wallet is on the wrong network. Switch to Celo to claim your rewards.";

/**
 * Show a toast with a "Switch to Celo" button when claim fails due to wrong network.
 * Call this instead of the generic error toast when contractGame is missing and user
 * is not on Celo (chain 42220).
 */
export function showWrongNetworkClaimToast(openNetworkSwitcher: () => void) {
  toast.custom(
    (t) => (
      <div className="rounded-xl bg-[#0a1628] border border-cyan-500/30 p-4 shadow-xl max-w-sm">
        <div className="flex items-start gap-3">
          <Globe className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-gray-200 text-sm font-medium">{WRONG_NETWORK_MSG}</p>
            <button
              onClick={() => {
                openNetworkSwitcher();
                toast.dismiss(t.id);
              }}
              className="mt-3 w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-[#010F10] font-bold rounded-lg transition-colors text-sm"
            >
              Switch to Celo
            </button>
          </div>
        </div>
      </div>
    ),
    { duration: 10000 }
  );
}
