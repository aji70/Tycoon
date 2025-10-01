"use client";
import GameBoard from "@/components/game/game-board";
import GameRoom from "@/components/game/game-room";
import GamePlayers from "@/components/game/players";
import { apiClient } from "@/lib/api";
import { Game } from "@/types/game";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function GamePlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [gameCode, setGameCode] = useState<string>("");
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      const code =
        searchParams.get("gameCode") || localStorage.getItem("gameCode");
      if (code && code.length === 6) {
        setGameCode(code);
        const response = await apiClient.get<Game>(`/games/code/${code}`);
        if (response?.code === code) {
          setGame(response);
          return;
        }
        router.replace("/join-room");
      } else {
        router.replace("/join-room");
      }
    };
    initializeGame();
  }, [gameCode, router]);
  return game ? (
    <main className="w-full h-screen overflow-x-hidden relative flex flex-row lg:gap-2">
      <GamePlayers gameId={game?.id} />
      <div className="lg:flex-1 w-full">
        <GameBoard />
      </div>
      <GameRoom />
    </main>
  ) : (
    <></>
  );
}
