"use client";

import { useMediaQuery } from "@/components/useMediaQuery";
import PlayWithAISettings from "@/components/settings/game-ai";
import PlayWithAISettingsMobile from "@/components/settings/game-ai-mobile";

export default function GameSettingsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full overflow-x-hidden">
      {isMobile ? <PlayWithAISettingsMobile /> : <PlayWithAISettings />}
    </main>
  );
}
