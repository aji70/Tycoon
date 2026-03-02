"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MessageCircle, RefreshCw, Home } from "lucide-react";

export default function RoomsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Rooms page error:", error);
  }, [error]);

  return (
    <main className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md w-full rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1214] to-[#061012] p-8 text-center shadow-xl">
        <div className="flex justify-center mb-4">
          <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-cyan-500/20 border border-cyan-400/30">
            <MessageCircle className="w-7 h-7 text-cyan-400" />
          </span>
        </div>
        <h1 className="text-xl font-bold text-white font-orbitron mb-2">
          Something went wrong
        </h1>
        <p className="text-cyan-400/80 text-sm font-dmSans mb-6">
          The lobby chat couldn’t load. This can happen on some mobile browsers. Try again or go back home.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold transition"
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
