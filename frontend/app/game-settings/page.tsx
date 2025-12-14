"use client";

import { useMediaQuery } from "@/components/useMediaQuery";
import GameSettings from "@/components/settings/game-settings"
import GameSttingsMobile from "@/components/settings/game-settings-mobile"

export default function GameSettingsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full overflow-x-hidden">
      {isMobile ? <GameSttingsMobile /> : <GameSettings />}
    </main>
  );
}
