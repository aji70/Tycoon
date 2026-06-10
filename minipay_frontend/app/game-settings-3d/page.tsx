"use client";

import GameSettingsOptimized from "@/components/settings/GameSettingsOptimized";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useIsRegistered } from "@/context/ContractProvider";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * Multiplayer 3D game settings. Create a game → redirects to 3D waiting room (game-waiting-3d).
 */
export default function GameSettings3DPage() {
  const router = useRouter();
  const { address } = useAccount();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
  } = useIsRegistered(address);

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-[#0E282A] to-slate-950 flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
        <p className="text-xl font-orbitron">Checking registration...</p>
      </div>
    );
  }

  if (isUserRegistered === false) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-[#0E282A] to-slate-950 flex flex-col items-center justify-center gap-8 px-8 text-center">
        <AlertCircle className="w-20 h-20 text-cyan-400/80" />
        <div>
          <h2 className="text-3xl font-bold text-white mb-4 font-orbitron">
            Registration Required
          </h2>
          <p className="text-lg text-slate-300 max-w-md">
            You need to register your wallet before creating a multiplayer game.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-900 font-bold rounded-xl border-2 border-cyan-400/50 transition-all transform hover:scale-105"
        >
          Go to Home Page
        </button>
      </div>
    );
  }

  return (
    <main className="w-full overflow-x-hidden min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950">
      <GameSettingsOptimized redirectToWaitingRoom="/game-waiting-3d" />
    </main>
  );
}
