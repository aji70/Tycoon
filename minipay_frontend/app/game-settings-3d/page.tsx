"use client";

import { useMediaQuery } from "@/components/useMediaQuery";
import GameSettings from "@/components/settings/game-settings";
import GameSettingsMobile from "@/components/settings/game-settings-mobile";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useIsRegistered } from "@/context/ContractProvider";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * Multiplayer 3D game settings. Create a game → redirects to 3D waiting room (game-waiting-3d).
 */
export default function GameSettings3DPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();
  const { address } = useAccount();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
  } = useIsRegistered(address);

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xl font-orbitron">Checking registration...</p>
      </div>
    );
  }

  if (isUserRegistered === false) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center gap-8 px-8 text-center">
        <AlertCircle className="w-20 h-20 text-red-400" />
        <div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Registration Required
          </h2>
          <p className="text-lg text-gray-300 max-w-md">
            You need to register your wallet before creating a multiplayer 3D game.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:bg-[#00F0FF]/80 transition-all transform hover:scale-105"
        >
          Go to Home Page
        </button>
      </div>
    );
  }

  return (
    <main className="w-full overflow-x-hidden">
      {isMobile ? (
        <GameSettingsMobile redirectToWaitingRoom="/game-waiting-3d" />
      ) : (
        <GameSettings redirectToWaitingRoom="/game-waiting-3d" />
      )}
    </main>
  );
}
