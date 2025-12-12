import { useMediaQuery } from "@/components/useMediaQuery";
import PlayWithAISettings from "@/components/settings/game-ai";
import PlayWithAIMobile from "@/components/settings/game-aimobile";

export default function GameSettingsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full overflow-x-hidden">
      {isMobile ? <PlayWithAIMobile /> : <PlayWithAISettings />}
    </main>
  );
}