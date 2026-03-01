"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Multiplayer 3D board (mobile). Redirects to board-3d-mobile for the same UI as AI mobile 3D.
 * Route: /board-3d-multi-mobile?gameCode=XXX → /board-3d-mobile?gameCode=XXX
 */
export default function Board3DMultiMobilePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [gameCode, setGameCode] = useState<string>("");

  useEffect(() => {
    const code = searchParams.get("gameCode") || (typeof window !== "undefined" ? localStorage.getItem("gameCode") : null);
    const trimmed = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (trimmed) {
      setGameCode(trimmed);
      if (typeof window !== "undefined") {
        localStorage.setItem("gameCode", trimmed);
      }
      router.replace(`/board-3d-mobile?gameCode=${encodeURIComponent(trimmed)}`);
    }
  }, [searchParams, router]);

  if (gameCode) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-cyan-400 bg-[#010F10]">
        Opening game…
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-white bg-[#010F10]">
      <p className="text-gray-400 text-center">No game code. Use a link from your multiplayer game to join.</p>
      <button
        onClick={() => router.push("/")}
        className="px-6 py-3 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-500"
      >
        Go home
      </button>
    </div>
  );
}
