"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface RoomErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for (room) routes (board, game-play, etc.).
 * When the user presses the device back button to return to the board,
 * WebGL/Canvas or other state can throw — this shows a recovery UI instead of a full crash.
 */
export default function RoomError({ error, reset }: RoomErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("[Room error] Board/game crashed (e.g. after device back):", error?.message, error?.stack);
  }, [error]);

  return (
    <main className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-[#003B3E] bg-[#0B191A]/90 p-6 space-y-5">
        <h2 className="text-lg font-bold text-[#00F0FF] font-orbitron">
          Something went wrong
        </h2>
        <p className="text-slate-300 text-sm font-dmSans">
          The board may have had trouble loading after you pressed back. Reload the page or go home.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="w-full py-3 px-4 rounded-xl bg-[#00F0FF] text-[#010F10] font-semibold font-orbitron hover:bg-[#00F0FF]/90 transition-colors"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-3 px-4 rounded-xl border border-[#00F0FF]/50 text-[#00F0FF] font-medium hover:bg-[#00F0FF]/10 transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </main>
  );
}
