"use client";

import Link from "next/link";

/**
 * 3D board is for AI games only. Redirects to the AI 3D page.
 */
export default function GamePlay3DPage() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[#010F10] text-white">
      <h1 className="text-2xl font-bold text-cyan-400">3D board</h1>
      <p className="text-gray-400 text-center max-w-md">
        The 3D board is for AI games. Create an AI game or open one with a code.
      </p>
      <Link
        href="/ai-play-3d"
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00FFAA] to-[#00F0FF] text-black font-semibold hover:opacity-90"
      >
        Go to AI 3D
      </Link>
      <Link href="/" className="text-sm text-gray-500 hover:text-cyan-400 mt-4">
        Back to home
      </Link>
    </div>
  );
}
