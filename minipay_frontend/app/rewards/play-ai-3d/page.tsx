"use client";

import Link from "next/link";
import { Box, ArrowLeft } from "lucide-react";

/**
 * Standalone entry page for "Play AI (3D Board)".
 * Link here from admin/rewards or elsewhere without editing the main rewards page.
 */
export default function RewardsPlayAI3DPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur border-2 border-amber-500/40 rounded-2xl p-8 shadow-xl shadow-amber-900/20 text-center">
        <Box className="w-16 h-16 text-amber-400 mx-auto mb-4" />
        <h1 className="text-2xl font-orbitron font-bold text-amber-300 mb-2">
          Play AI (3D Board)
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Create a game vs AI and play on the 3D board.
        </p>
        <Link
          href="/play-ai-3d"
          className="inline-flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-900 border-2 border-amber-400/50 transition-all"
        >
          Launch 3D AI Duel
        </Link>
        <Link
          href="/rewards"
          className="inline-flex items-center gap-2 mt-4 text-slate-400 hover:text-amber-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
      </div>
    </div>
  );
}
