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

interface Token {
  name: string;
  emoji: string;
  value: string;
}

interface Game {
  id: number;
  code: string;
  maxPlayers: number;
  playersJoined: number;
  players: Array<{ id: string; symbol: string; name: string }>;
  isReady: boolean;
  availableSymbols: { value: string; label: string }[];
}

const tokens: Token[] = [
  { name: "Hat", emoji: "🎩", value: "hat" },
  { name: "Car", emoji: "🚗", value: "car" },
  { name: "Dog", emoji: "🐕", value: "dog" },
  { name: "Thimble", emoji: "🧵", value: "thimble" },
  { name: "Iron", emoji: "🧼", value: "iron" },
  { name: "Battleship", emoji: "🚢", value: "battleship" },
  { name: "Boot", emoji: "👞", value: "boot" },
  { name: "Wheelbarrow", emoji: "🛒", value: "wheelbarrow" },
];

const GameWaiting = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameCode = searchParams.get("gameCode")?.toUpperCase();
  const { address } = useAccount();
  const [game, setGame] = useState<Game | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<string>("");
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const { data: isInGame, isLoading: isInGameLoading } = useIsInGame(
    game?.gameId,
    address,
    { enabled: !!address && !!game?.gameId }
  );

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
  } = useJoinGame(contractId ? Number(contractId) : 0, playerSymbol);

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

  // Fetch game state from API
  useEffect(() => {
    if (!gameCode) {
      setError("No game code provided. Please enter a valid game code.");
      setLoading(false);
      return;
    }

    const fetchGame = async () => {
      try {
        const response = await apiClient.get(`/games/code/${gameCode}`);
        if (!response) {
          throw new Error(`Game ${gameCode} not found`);
        }
        const gameData = await response;
        if (gameData.status !== "PENDING") {
          throw new Error(`Game ${gameCode} has already started or ended.`);
        }

        const fetchedState: Game = {
          gameId: gameData.id,
          code: gameData.code,
          maxPlayers: gameData.number_of_players,
          playersJoined: gameData.players_joined || 1,
          players: gameData.players || [
            { id: "creator", symbol: "hat", name: "Creator" },
          ],
          isReady:
            gameData.status === "PENDING" &&
            gameData.players_joined >= gameData.number_of_players,
          availableSymbols: tokens
            .filter(
              (t) => !gameData.players?.some((p: any) => p.symbol === t.value)
            )
            .map((t) => ({
              value: t.value,
              label: `${t.emoji} ${t.name}`,
            })),
        };
        setGame(fetchedState);
      } catch (err: any) {
        console.error("Error fetching game state:", err);
        setError(err.message || "Failed to fetch game data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [gameCode]);

  // Handle player join status
  useEffect(() => {
    if (!isInGameLoading && isInGame !== undefined) {
      setIsJoined(isInGame);
      if (isInGame) {
        const player = game?.players.find(
          (p) => p.id.toLowerCase() === address?.toLowerCase()
        );
        if (player) {
          setPlayerSymbol(player.symbol);
        }
      }
    }
  }, [isInGame, isInGameLoading, address, game]);

  const handleStartGame = () => {
    if (gameCode) {
      router.push(`/game-play?gameCode=${gameCode}`);
    } else {
      setError("Game code not available. Please try again.");
    }
  };

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://base-monopoly-production.up.railway.app");
  const gameUrl = `${baseUrl}/game-waiting?gameCode=${gameCode}`;
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
    if (
      !playerSymbol ||
      !game?.availableSymbols.some((s) => s.value === playerSymbol)
    ) {
      setError("Please select a valid symbol.");
      return;
    }
    if (playersJoined >= maxPlayers) {
      setError("Game is full!");
      return;
    }

    try {
      await joinGame();
      setIsJoined(true);
      setError(null);
    } catch (err: any) {
      console.error("Error joining game:", err);
      setError(err.message || "Failed to join game. Please try again.");
    }
  };

  const handleLeaveGame = async () => {
    try {
      const response = await apiClient.post(`/games/${game?.gameId}/leave`, {
        symbol: playerSymbol,
      });
      if (!response.ok) {
        throw new Error(
          `Failed to leave game: ${response.status} ${response.statusText}`
        );
      }
      const updatedGame = await response.json();
      const symbolObj = {
        value: playerSymbol,
        label:
          tokens.find((t) => t.value === playerSymbol)?.emoji +
            " " +
            tokens.find((t) => t.value === playerSymbol)?.name || "",
      };
      setGame({
        ...game!,
        playersJoined:
          updatedGame.players_joined || Math.max(game!.playersJoined - 1, 1),
        players:
          updatedGame.players ||
          game!.players.filter((p) => p.symbol !== playerSymbol),
        availableSymbols: [...game!.availableSymbols, symbolObj],
      });
      setIsJoined(false);
      setPlayerSymbol("");
      setError(null);
    } catch (err: any) {
      console.error("Error leaving game:", err);
      setError(err.message || "Failed to leave game. Please try again.");
    }
  };

  const handleGoHome = () => {
    router.push("/");
  };

  // Use contract data for playersJoined and maxPlayers, with fallback to game
  const playersJoined = contractGame?.joinedPlayers ?? game?.playersJoined ?? 0;
  const maxPlayers = contractGame?.numberOfPlayers ?? game?.maxPlayers ?? 0;
  const canStartGame = playersJoined === maxPlayers;

  if (loading || isInGameLoading || contractGameLoading) {
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
        <div className="text-center space-y-4">
          <p className="text-red-500 text-xl font-semibold font-orbitron mb-4">
            {error || contractGameError?.message || "Game not found"}
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

  const showJoin = !isJoined && playersJoined < maxPlayers;
  const showLeave = isJoined && playersJoined < maxPlayers;
  const showShare = playersJoined < maxPlayers;

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
            {game.players.map((player) => (
              <p
                key={player.id}
                className="text-sm text-[#F0F7F7] flex items-center justify-center"
              >
                {tokens.find((t) => t.value === player.symbol)?.emoji}{" "}
                {player.name}
              </p>
            ))}
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

          {showJoin && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col">
                <label className="text-sm text-gray-300 mb-1 font-orbitron">
                  Choose Your Token
                </label>
                <select
                  value={playerSymbol}
                  onChange={(e) => setPlayerSymbol(e.target.value)}
                  className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron"
                >
                  <option value="" disabled>
                    Select a token
                  </option>
                  {game.availableSymbols.map((symbol) => (
                    <option key={symbol.value} value={symbol.value}>
                      {symbol.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleJoinGame}
                className="w-full bg-[#00F0FF] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#00D4E6] transition-all duration-300 shadow-md"
                disabled={!playerSymbol || isJoining}
              >
                {isJoining ? "Joining..." : "Join Game"}
              </button>
            </div>
          )}

          {showLeave && (
            <button
              onClick={handleLeaveGame}
              className="w-full mt-6 bg-[#FF4D4D] text-white text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#E63939] transition-all duration-300 shadow-md"
            >
              Leave Game
            </button>
          )}

          {canStartGame && (
            <button
              onClick={handleStartGame}
              className="w-full mt-6 bg-[#00FF00] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#00CC00] transition-all duration-300 shadow-md"
            >
              Start Game
            </button>
          )}

          <div className="flex justify-between mt-3">
            <button
              onClick={() => router.push("/join-room")}
              className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
            >
              Back to Join Room
            </button>
            <button
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
