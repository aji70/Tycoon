"use client";

import { useMediaQuery } from "@/components/useMediaQuery";
import PlayWithAI3D from "@/components/settings/game-ai-3d";
import PlayWithAI3DMobile from "@/components/settings/game-ai-3d-mobile";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useIsRegistered } from "@/context/ContractProvider";
import { Loader2, AlertCircle } from "lucide-react";

/** New page: AI game settings that redirect to 3D board. Does not edit production play-ai or rewards. */
export default function PlayAI3DPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();
  const { address } = useAccount();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
  } = useIsRegistered(address);

  if (isRegisteredLoading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 flex flex-col items-center justify-center gap-4 text-amber-300">
        <Loader2 className="w-12 h-12 animate-spin text-amber-400" />
        <p className="text-xl font-orbitron">Checking registration...</p>
      </div>
    );
  }

  if (isUserRegistered === false) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/30 flex flex-col items-center justify-center gap-8 px-8 text-center">
        <AlertCircle className="w-20 h-20 text-amber-400/80" />
        <div>
          <h2 className="text-3xl font-bold text-white mb-4 font-orbitron">
            Registration Required
          </h2>
          <p className="text-lg text-slate-300 max-w-md">
            You need to register your wallet before creating a 3D AI game.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-bold rounded-xl border-2 border-amber-400/50 transition-all transform hover:scale-105"
        >
          Go to Home Page
        </button>
      </div>
    );
  }

  return (
    <main className="w-full overflow-x-hidden min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20">
      {isMobile ? <PlayWithAI3DMobile /> : <PlayWithAI3D />}
    </main>
  );
}
