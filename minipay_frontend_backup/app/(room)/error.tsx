"use client";

import { useEffect } from "react";

interface RoomErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for (room) routes (board, game-play, etc.).
 * When the board/game crashes (e.g. WebGL after back), reload the page instead of showing an error modal.
 */
export default function RoomError({ error }: RoomErrorProps) {
  useEffect(() => {
    console.error("[Room error] Board/game crashed, reloading:", error?.message, error?.stack);
    window.location.reload();
  }, [error]);

  return (
    <main className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
        <p className="text-sm">Reloading…</p>
      </div>
    </main>
  );
}
