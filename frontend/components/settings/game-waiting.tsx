"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PiTelegramLogoLight } from "react-icons/pi";
import { FaXTwitter } from "react-icons/fa6";
import { IoCopyOutline, IoHomeOutline } from "react-icons/io5";
import { useAccount } from "wagmi";
import {
  useIsInGame,
  useJoinGame,
  useGetGameByCode,
} from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { Game } from "@/lib/types/games";
import { getPlayerSymbolData, PlayerSymbol, symbols } from "@/lib/types/symbol";

interface GameOld {
  gameId: number;
  code: string;
  maxPlayers: number;
  playersJoined: number;
  players: Array<{ id: string; symbol: string; name: string }>;
  isReady: boolean;
  availableSymbols: { value: string; label: string }[];
}

const GameWaiting = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameCode = searchParams.get("gameCode")?.toUpperCase();
  const { address } = useAccount();
  const [game, setGame] = useState<Game | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [availableSymbols, setAvailableSymbols] =
    useState<PlayerSymbol[]>(symbols);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const {
    data: contractGame,
    isLoading: contractGameLoading,
    error: contractGameError,
  } = useGetGameByCode(gameCode, { enabled: !!gameCode });

  const contractId = contractGame?.id || null;

  const {
    write: joinGame,
    isPending: isJoining,
    error: joinError,
  } = useJoinGame(
    contractId ? Number(contractId) : 0,
    playerSymbol?.value ?? "hat"
  );

  // Log contract game data
  useEffect(() => {
    console.log("Game Code Input:", gameCode);
    console.log("Contract Game Loading:", contractGameLoading);
    if (contractGame && !contractGameLoading) {
      console.log("Contract Game Data:", contractGame);
    }
    if (contractGameError) {
      console.error("Contract Game Error:", contractGameError.message);
    }
    if (!contractGame && !contractGameLoading && !contractGameError) {
      console.warn("Contract Game Data is undefined, but no error occurred");
    }
  }, [gameCode, contractGame, contractGameLoading, contractGameError]);

  useEffect(() => {
    if (!gameCode) {
      setError("No game code provided. Please enter a valid game code.");
      setLoading(false);
      return;
    }

    const getAvailableSymbols = (game: Game | null) => {
      if (!game) return symbols;
      // collect taken symbols
      const taken = new Set(game.players.map((p) => p.symbol));
      // filter out taken ones
      const available = symbols.filter((s) => !taken.has(s.value));
      return available;
    };

    const playerInGame = (game: Game | null): boolean => {
      if (!game) return false;
      return !!game.players.find((p) => p.address === address);
    };

    const fetchGame = async () => {
      try {
        const gameData = await apiClient.get<Game>(`/games/code/${gameCode}`);
        if (!gameData) {
          throw new Error(`Game ${gameCode} not found`);
        }
        console.log("game data__________:", gameData);
        if (gameData.status !== "PENDING") {
          throw new Error(`Game ${gameCode} has already started or ended.`);
        }
        setGame(gameData);
        setIsReady(
          gameData.status === "PENDING" &&
            gameData.players.length === gameData.number_of_players
        );
        setAvailableSymbols(getAvailableSymbols(gameData));
        setIsJoined(playerInGame(gameData));
        if (gameData?.players.length === gameData?.number_of_players) {
          const response = await apiClient.put<{
            success: boolean;
            message: string;
          }>(`/games/${gameData.id}`, {
            status: "RUNNING",
          });
          if (response.success) {
            router.push(`/game-play?gameCode=${gameCode}`);
          } else {
            setError("Game not available. Please try again.");
          }
        }
      } catch (error: any) {
        console.error("Error fetching game state:", error);
        setError(
          error.message || "Failed to fetch game data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [gameCode, address]);

  // Use contract data for playersJoined and maxPlayers, with fallback to game
  const playersJoined = contractGame?.joinedPlayers ?? game?.players.length;
  const maxPlayers =
    contractGame?.numberOfPlayers ?? game?.number_of_players ?? 0;

  const gameUrl = `${window.location.origin}/game-waiting?gameCode=${gameCode}`;
  const shareText = `Join my Blockopoly game! Code: ${gameCode}. Waiting room: ${gameUrl}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    gameUrl
  )}&text=${encodeURIComponent(shareText)}`;
  const twitterShareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      setError("Failed to copy link. Please try again.");
    }
  };

  const handleJoinGame = async () => {
    if (!game) {
      setError("No game data found. Please enter a valid game code.");
      setLoading(false);
      return;
    }
    if (
      !playerSymbol?.value ||
      !availableSymbols.some((s) => s.value === playerSymbol.value)
    ) {
      setError("Please select a valid symbol.");
      return;
    }
    if (game?.players.length >= game?.number_of_players) {
      setError("Game is full!");
      return;
    }

    try {
      await joinGame();
      const response = await apiClient.post("/game-players/join", {
        address,
        symbol: playerSymbol.value,
        code: game.code,
      });
      setIsJoined(true);
      setError(null);
    } catch (err: any) {
      console.error("Error joining game:", err);
      setError(err.message || "Failed to join game. Please try again.");
    }
  };

  const handleLeaveGame = async () => {
    if (!game) {
      setError("No game data found. Please enter a valid game code.");
      setLoading(false);
      return;
    }
    // try {
    //   const response = await apiClient.post(`/games/${game?.gameId}/leave`, {
    //     symbol: playerSymbol,
    //   });
    //   if (!response.ok) {
    //     throw new Error(
    //       `Failed to leave game: ${response.status} ${response.statusText}`
    //     );
    //   }
    //   const updatedGame = await response.json();
    //   const symbolObj = {
    //     value: playerSymbol,
    //     label:
    //       tokens.find((t) => t.value === playerSymbol)?.emoji +
    //         " " +
    //         tokens.find((t) => t.value === playerSymbol)?.name || "",
    //   };
    //   setGame({
    //     ...game!,
    //     playersJoined:
    //       updatedGame.players_joined || Math.max(game!.playersJoined - 1, 1),
    //     players:
    //       updatedGame.players ||
    //       game!.players.filter((p) => p.symbol !== playerSymbol),
    //     availableSymbols: [...game!.availableSymbols, symbolObj],
    //   });
    //   setIsJoined(false);
    //   setPlayerSymbol("");
    //   setError(null);
    // } catch (err: any) {
    //   console.error("Error leaving game:", err);
    //   setError(err.message || "Failed to leave game. Please try again.");
    // }
  };

  const handleGoHome = () => {
    router.push("/");
  };

  if (loading || contractGameLoading) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <p className="text-[#00F0FF] text-xl font-semibold font-orbitron animate-pulse">
          Loading game...
        </p>
      </section>
    );
  }

  if (error || !game) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="text-centermake i see how e goo be reach evennigs  space-y-4">
          <p className="text-red-500 text-xl font-semibold font-orbitron mb-4">
            {error || "Game not found"}
          </p>
          <button
            type="button"
            onClick={() => router.push("/join-room")}
            className="bg-[#00F0FF] text-black px-4 py-2 rounded font-orbitron"
          >
            Back to Join Room
          </button>
          <button
            type="button"
            onClick={handleGoHome}
            className="bg-[#00F0FF] text-black px-4 py-2 rounded font-orbitron"
          >
            Go to Home
          </button>
        </div>
      </section>
    );
  }

  const showJoin = !isJoined && game.players.length < game.number_of_players;
  const showLeave = isJoined && game.players.length < game.number_of_players;
  const showShare = game.players.length < game.number_of_players;

  return (
    <section className="w-full h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        <div className="w-full max-w-md bg-[#0A1A1B]/80 p-6 sm:p-8 rounded-xl shadow-lg border border-[#00F0FF]/30 backdrop-blur-sm">
          <h2 className="text-2xl sm:text-3xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center tracking-wide">
            Blockopoly Waiting Room
            <span className="block text-sm text-[#00F0FF] mt-1 font-bold">
              Code: {gameCode}
            </span>
          </h2>

          <div className="text-center space-y-3 mb-6">
            <p className="text-[#869298] text-sm">
              {playersJoined === maxPlayers
                ? "All players joined! Ready to start..."
                : "Waiting for players to join..."}
            </p>
            <p className="text-[#00F0FF] text-lg font-semibold">
              Players: {playersJoined}/{maxPlayers}
            </p>
            <div className="w-full items-center flex space-x-4 justify-center">
              {game.players.map((player) => (
                <span
                  key={player.user_id}
                  className="text-sm text-[#F0F7F7] flex items-center justify-center"
                >
                  {symbols.find((t) => t.value === player.symbol)?.emoji}{" "}
                  {player.username}
                </span>
              ))}
            </div>
          </div>

          {showShare && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gameUrl}
                  readOnly
                  className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none font-orbitron text-sm"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-3 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                >
                  <IoCopyOutline className="w-5 h-5" />
                </button>
              </div>
              {copySuccess && (
                <p className="text-green-400 text-xs text-center">
                  {copySuccess}
                </p>
              )}
              <div className="flex justify-center gap-4">
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-4 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                >
                  <PiTelegramLogoLight className="mr-2 w-5 h-5" />
                  Telegram
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-4 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                >
                  <FaXTwitter className="mr-2 w-5 h-5" />X
                </a>
              </div>
            </div>
          )}

          {!canStartGame && showJoin && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col">
                <label
                  htmlFor="symbol"
                  className="text-sm text-gray-300 mb-1 font-orbitron"
                >
                  Choose Your Symbol
                </label>
                <select
                  value={playerSymbol?.value ?? ""}
                  onChange={(e) => {
                    const getSymbol = getPlayerSymbolData(e.target.value);
                    setPlayerSymbol(getSymbol ?? null);
                  }}
                  className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron"
                >
                  <option value="" disabled>
                    Select a symbol
                  </option>
                  {availableSymbols?.length &&
                    availableSymbols.map((symbol) => (
                      <option key={symbol.value} value={symbol.value}>
                        {symbol.name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleJoinGame}
                className="w-full bg-[#00F0FF] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#00D4E6] transition-all duration-300 shadow-md"
                disabled={!playerSymbol || isJoining}
              >
                {isJoining ? "Joining..." : "Join Game"}
              </button>
            </div>
          )}

          {!canStartGame && showLeave && (
            <button
              type="button"
              onClick={handleLeaveGame}
              className="w-full mt-6 bg-[#FF4D4D] text-white text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#E63939] transition-all duration-300 shadow-md"
            >
              Leave Game
            </button>
          )}

          <div className="flex justify-between mt-3">
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
            >
              Back to Join Room
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="flex items-center text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
            >
              <IoHomeOutline className="mr-1 w-4 h-4" />
              Go to Home
            </button>
          </div>

          {(error || joinError || contractGameError) && (
            <p className="text-red-500 text-xs mt-4 text-center animate-pulse">
              {error ||
                joinError?.message ||
                contractGameError?.message ||
                "An error occurred"}
            </p>
          )}
        </div>
      </main>
    </section>
  );
};

export default GameWaiting;
