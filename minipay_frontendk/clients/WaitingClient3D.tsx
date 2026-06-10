"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useIsRegistered } from "@/context/ContractProvider";
import { Loader2, AlertCircle } from "lucide-react";

function isTournamentMatchCode(code: string | null): boolean {
  return /^T\d+-R\d+-M\d+$/i.test((code ?? "").trim());
}

const GameWaiting3DLobby = dynamic(
  () => import("@/components/settings/game-waiting-3d-lobby"),
  { ssr: false }
);

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#010F10] flex items-center justify-center">
      <p className="text-cyan-400 text-xl font-medium animate-pulse">
        Entering 3D lobby…
      </p>
    </div>
  );
}

function RegistrationLoading() {
  return (
    <div className="min-h-screen bg-[#010F10] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
        <p className="text-lg text-cyan-300">Checking registration…</p>
      </div>
    </div>
  );
}

function NotRegisteredScreen() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-8 px-8 text-center">
      <AlertCircle className="w-20 h-20 text-red-400" />
      <div>
        <h2 className="text-3xl font-bold text-white mb-4">Registration Required</h2>
        <p className="text-lg text-gray-300 max-w-md">
          You need to register your wallet before entering the 3D game lobby.
        </p>
      </div>
      <button
        onClick={() => router.push("/")}
        className="px-8 py-4 bg-cyan-500 text-[#010F10] font-bold rounded-lg hover:bg-cyan-400 transition"
      >
        Go to Home Page
      </button>
    </div>
  );
}

/**
 * Waiting room client for multiplayer 3D. Uses the minimal 3D lobby; when game starts, redirects to board-3d-multi.
 */
export default function GameWaitingClient3D() {
  const { address } = useAccount();
  const searchParams = useSearchParams();
  const gameCode = searchParams.get("gameCode") ?? "";

  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);
  const isTournamentLobby = isTournamentMatchCode(gameCode);

  if (!isTournamentLobby) {
    if (isRegisteredLoading) return <RegistrationLoading />;
    if (isUserRegistered === false) return <NotRegisteredScreen />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <GameWaiting3DLobby />
    </Suspense>
  );
}
