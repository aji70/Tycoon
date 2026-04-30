"use client";

import { useEffect } from "react";

interface RoomsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Crash guard for rooms route — shows full error details for debugging instead of generic "Application error" page */
export default function RoomsError({ error, reset }: RoomsErrorProps) {
  useEffect(() => {
    // Always log to console for debugging
    console.error("[Rooms crash guard] Error:", error);
    console.error("[Rooms crash guard] Stack:", error?.stack);
  }, [error]);

  const message = error?.message ?? "Unknown error";
  const stack = error?.stack ?? "";
  const digest = (error as Error & { digest?: string })?.digest;

  return (
    <main className="w-full min-h-screen bg-[#010F10] flex flex-col p-4 md:p-8">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <div className="rounded-2xl overflow-hidden border border-red-500/40 bg-gradient-to-b from-red-950/30 to-[#061012] p-6 space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-red-400 font-orbitron">
            Rooms crashed — debug info
          </h2>
          <p className="text-amber-200 font-medium">
            Use this info to debug the mobile rooms crash:
          </p>

          {/* Error message — most useful for debugging */}
          <div>
            <p className="text-cyan-400/90 text-xs font-mono mb-1 uppercase tracking-wider">
              Error message
            </p>
            <pre className="p-3 bg-black/50 rounded-lg text-red-300 text-sm font-mono break-all whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
              {message}
            </pre>
          </div>

          {/* Stack trace — crucial for finding the source */}
          {stack && (
            <div>
              <p className="text-cyan-400/90 text-xs font-mono mb-1 uppercase tracking-wider">
                Stack trace
              </p>
              <pre className="p-3 bg-black/50 rounded-lg text-amber-300/90 text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-48 overflow-y-auto">
                {stack}
              </pre>
            </div>
          )}

          {digest && (
            <p className="text-slate-500 text-xs font-mono">Digest: {digest}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={reset}
              className="px-6 py-3 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:bg-[#00F0FF]/80 transition-all font-orbitron"
            >
              Try again
            </button>
            <a
              href="/rooms"
              className="px-6 py-3 border border-cyan-500/50 text-cyan-400 font-bold rounded-lg hover:bg-cyan-500/10 transition-all font-orbitron"
            >
              Reload page
            </a>
          </div>
          <p className="text-slate-400 text-sm">
            Error details are also in the browser console. On mobile, enable remote debugging or use
            <span className="font-mono text-cyan-400"> chrome://inspect </span>
            to inspect.
          </p>
        </div>
      </div>
    </main>
  );
}
