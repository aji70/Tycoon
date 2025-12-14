import { useMediaQuery } from "@/components/useMediaQuery";
import PlayWithAISettings from "@/components/settings/game-ai";

export default function GameSettingsPage() {
    return (
        <main className="w-full overflow-x-hidden">
            <PlayWithAISettings />
        </main>
    );
}