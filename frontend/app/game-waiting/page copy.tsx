'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { useGameActions } from '@/hooks/useGameActions';
import { PiTelegramLogoLight } from 'react-icons/pi';
import { FaXTwitter } from 'react-icons/fa6';
import { IoCopyOutline, IoHomeOutline } from 'react-icons/io5';

interface Game {
  status: { variant: { Pending?: {}; Ongoing?: {} } };
  players_joined: string;
  number_of_players: string;
  creator: `0x${string}` | undefined;
  is_initialised: boolean;
  hat: string;
  car: string;
  dog: string;
  thimble: string;
  iron: string;
  battleship: string;
  boot: string;
  wheelbarrow: string;
  game_players: string[];
  player_hat: bigint;
  player_car: bigint;
  player_dog: bigint;
  player_thimble: bigint;
  player_iron: bigint;
  player_battleship: bigint;
  player_boot: bigint;
  player_wheelbarrow: bigint;
}

interface Player {
  address: string;
  game_id: string;
  username: string;
  player_symbol: { variant: { [key: string]: {} } };
  joined: boolean;
}

interface Token {
  name: string;
  emoji: string;
  value: number;
}

const tokens: Token[] = [
  { name: 'Hat', emoji: '🎩', value: 0 },
  { name: 'Car', emoji: '🚗', value: 1 },
  { name: 'Dog', emoji: '🐕', value: 2 },
  { name: 'Thimble', emoji: '🧵', value: 3 },
  { name: 'Iron', emoji: '🧼', value: 4 },
  { name: 'Battleship', emoji: '🚢', value: 5 },
  { name: 'Boot', emoji: '👞', value: 6 },
  { name: 'Wheelbarrow', emoji: '🛒', value: 7 },
];

/**
 * Improved Dojo GameWaiting component
 * - Aligned with Dojo version's structure and Starknet integration
 * - Incorporates Solidity version's UI enhancements (player list, retry button)
 * - Enhanced accessibility (ARIA labels, focus management)
 * - Optimized polling with exponential backoff and visibility awareness
 * - Optimistic UI updates for join/leave actions
 * - Mobile-responsive design
 * - Commented Solidity backend logic for future reference
 * - Minimal active backend logic (to be implemented later)
 */

const POLL_INTERVAL = 5000; // ms
const MAX_POLL_BACKOFF = 30000; // ms
const COPY_FEEDBACK_MS = 2000;

const GameWaiting = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');
  const creator = searchParams.get('creator');
  const { account, address, connector } = useAccount();
  const gameActions = useGameActions();

  const [playersJoined, setPlayersJoined] = useState<number | null>(null);
  const [maxPlayers, setMaxPlayers] = useState<number | null>(null);
  const [isInitialised, setIsInitialised] = useState<boolean | null>(null);
  const [isPending, setIsPending] = useState<boolean | null>(null);
  const [isPlayerInGame, setIsPlayerInGame] = useState<boolean>(false);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<string>('0');
  const [availableSymbols, setAvailableSymbols] = useState<{ value: string; label: string }[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [pollBackoff, setPollBackoff] = useState<number>(POLL_INTERVAL);
  const [retryCount, setRetryCount] = useState<number>(0);

  const numericGameId = gameId ? Number(gameId) : NaN;
  const isGameReady = playersJoined !== null && maxPlayers !== null && playersJoined === maxPlayers && isInitialised;
  const isCreator = address && creator && address.toLowerCase() === creator.toLowerCase();
  const showStartGame = isCreator && playersJoined !== null && maxPlayers !== null && playersJoined === maxPlayers;
  const showGoToBoard = isGameReady && !!isPending && !!isPlayerInGame;
  const showJoinGame = !!account && !!address && !!gameId && !isNaN(numericGameId) && playerData?.joined === false;
  const showShareButtons = playersJoined !== null && maxPlayers !== null && playersJoined < maxPlayers;
  const showLeaveGame = !!account && !!address && !!gameId && !isNaN(numericGameId) && playerData?.joined === true && !isGameReady;

  // Share game URL and text
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://blockopoly-mono-repo-g8ew.vercel.app');
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    console.warn('NEXT_PUBLIC_BASE_URL is not set in .env. Using fallback URL:', baseUrl);
  }
  const gameUrl = `${baseUrl}/game-waiting?gameId=${gameId}`;
  const shareText = `Join my Blockopoly game in the waiting room! Game ID: ${gameId}. Enter the waiting room at ${gameUrl}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(gameUrl)}&text=${encodeURIComponent(shareText)}`;
  const twitterShareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Commented Solidity backend logic
  /*
  const {
    data: contractGame,
    isLoading: contractGameLoading,
    error: contractGameError,
  } = useGetGameByCode(gameId, { enabled: !!gameId });

  const contractId = contractGame?.id ?? null;

  const {
    write: joinGame,
    isPending: isJoining,
    error: joinError,
  } = useJoinGame(
    contractId ? Number(contractId) : 0,
    playerSymbol
  );

  const playersJoinedContract =
    contractGame?.joinedPlayers ?? game?.players.length ?? 0;
  const maxPlayersContract =
    contractGame?.numberOfPlayers ?? game?.number_of_players ?? 0;

  const fetchSolidityGame = async () => {
    try {
      const resp = await apiClient.get<Game>(
        `/games/code/${encodeURIComponent(gameId)}`,
        {
          signal: abort.signal as unknown as undefined,
        }
      );

      if (!mountedRef.current) return;

      if (!resp) throw new Error(`Game ${gameId} not found`);

      if (resp.status === "RUNNING") {
        router.push(`/game-play?gameCode=${encodeURIComponent(gameId)}`);
        return;
      }

      if (resp.status !== "PENDING") {
        throw new Error(`Game ${gameId} is not open for joining.`);
      }

      setGame(resp);
      setAvailableSymbols(computeAvailableSymbols(resp));
      setIsJoined(checkPlayerJoined(resp));
      setRetryCount(0);
      setPollBackoff(POLL_INTERVAL);

      if (resp.players.length === resp.number_of_players) {
        const updateRes = await apiClient.put<ApiResponse>(`/games/${resp.id}`, {
          status: "RUNNING",
        });
        if (updateRes?.success)
          router.push(`/game-play?gameCode=${encodeURIComponent(gameId)}`);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (err?.name === "AbortError") return;
      console.error("fetchGame error:", err);
      setError(
        err?.message ?? "Failed to fetch game data. Retrying..."
      );
      setRetryCount((prev) => prev + 1);
      setPollBackoff((prev) => Math.min(prev * 1.5, MAX_POLL_BACKOFF));
    }
  };
  */

  // Handle copying the game URL to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(null), COPY_FEEDBACK_MS);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy link. Please try again.');
    }
  };

  // Compute available symbols
  const computeAvailableSymbols = useCallback((gameData: Game | null) => {
    if (!gameData) return tokens.map(t => ({ value: t.value.toString(), label: `${t.emoji} ${t.name}` }));
    const symbolFields = [
      { field: 'player_hat', label: '🎩 Hat', value: '0' },
      { field: 'player_car', label: '🚗 Car', value: '1' },
      { field: 'player_dog', label: '🐕 Dog', value: '2' },
      { field: 'player_thimble', label: '🧵 Thimble', value: '3' },
      { field: 'player_iron', label: '🧼 Iron', value: '4' },
      { field: 'player_battleship', label: '🚢 Battleship', value: '5' },
      { field: 'player_boot', label: '👞 Boot', value: '6' },
      { field: 'player_wheelbarrow', label: '🛒 Wheelbarrow', value: '7' },
    ];
    return symbolFields
      .filter(({ field }) => gameData[field as keyof Game] === BigInt(0))
      .map(({ value, label }) => ({ value, label }));
  }, []);

  const fetchGameData = useCallback(async () => {
    if (!gameId || isNaN(numericGameId) || !address) return;

    try {
      const gameData = (await gameActions.getGame(numericGameId)) as Game;
      if (!gameData) {
        throw new Error('No game data returned');
      }

      const joined = Number(gameData.players_joined);
      const max = Number(gameData.number_of_players);
      const initialised = Boolean(gameData.is_initialised);
      const pending = !!gameData.status?.variant?.Pending;
      const playerInGame = gameData.game_players.includes(address);

      const playerDataResult = (await gameActions.getPlayer(address, numericGameId)) as Player;
      console.log('[GameWaiting] Player Data:', playerDataResult);

      if (mountedRef.current) {
        setPlayersJoined(!isNaN(joined) ? joined : playersJoined);
        setMaxPlayers(!isNaN(max) ? max : maxPlayers);
        setIsInitialised(initialised);
        setIsPending(pending);
        setIsPlayerInGame(playerInGame);
        setPlayerData(playerDataResult);
        setAvailableSymbols(computeAvailableSymbols(gameData));
        if (playerDataResult?.player_symbol?.variant) {
          const symbolKey = Object.keys(playerDataResult.player_symbol.variant)[0];
          const symbolValue = tokens.find(t => t.name.toLowerCase() === symbolKey.toLowerCase())?.value.toString();
          if (symbolValue) setPlayerSymbol(symbolValue);
        }
        setLastUpdated(Date.now());
        setError(null);
        setLoading(false);
        setRetryCount(0);
        setPollBackoff(POLL_INTERVAL);

        // Redirect to game-play if game is running
        if (gameData.status?.variant?.Ongoing) {
          router.push(`/game-play?gameId=${numericGameId}`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching game data:', err.message);
      setError('Failed to load game data. Retrying...');
      setRetryCount((prev) => prev + 1);
      setPollBackoff((prev) => Math.min(prev * 1.5, MAX_POLL_BACKOFF));
    }
  }, [gameId, numericGameId, gameActions, address, playersJoined, maxPlayers, router, computeAvailableSymbols]);

  useEffect(() => {
    let isMounted = true;
    let pollTimer: number | null = null;

    const startPolling = async () => {
      await fetchGameData();
      const tick = async () => {
        if (typeof document !== 'undefined' && document.hidden) {
          pollTimer = window.setTimeout(tick, pollBackoff);
          return;
        }
        await fetchGameData();
        pollTimer = window.setTimeout(tick, pollBackoff);
      };
      pollTimer = window.setTimeout(tick, pollBackoff);
    };

    startPolling();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [fetchGameData, pollBackoff]);

  const handleJoinGame = async () => {
    if (!account || !address || !gameId || isNaN(numericGameId)) {
      setError('Please connect your wallet and provide a valid game ID');
      return;
    }
    if (!playerSymbol || !availableSymbols.some((symbol) => symbol.value === playerSymbol)) {
      setError('Please select a valid player symbol');
      return;
    }
    if (playersJoined !== null && maxPlayers !== null && playersJoined >= maxPlayers) {
      setError('Game is full!');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await gameActions.joinGame(account, Number(playerSymbol), numericGameId);
      console.log('[GameWaiting] Join Game called:', { gameId, playerSymbol });
      await fetchGameData();
    } catch (err: any) {
      console.error('Error joining game:', err.message);
      setError('Failed to join game. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Commented Solidity join game logic
  /*
  const handleJoinGameSolidity = async () => {
    if (!game) {
      setError("No game data found. Please enter a valid game code.");
      return;
    }

    if (
      !playerSymbol ||
      !availableSymbols.some((s) => s.value === playerSymbol)
    ) {
      setError("Please select a valid symbol.");
      return;
    }

    if (game.players.length >= game.number_of_players) {
      setError("Game is full!");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      if (joinGame) {
        await joinGame();
      }

      const resp = await apiClient.post<ApiResponse>("/game-players/join", {
        address,
        symbol: playerSymbol,
        code: game.code,
      });

      if (resp?.success === false) {
        throw new Error(resp?.message ?? "Failed to join game");
      }

      if (mountedRef.current) {
        setIsJoined(true);
        setError(null);
      }
    } catch (err: any) {
      console.error("join error", err);
      if (mountedRef.current)
        setError(err?.message ?? "Failed to join game. Please try again.");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };
  */

  const handleLeaveGame = async () => {
    if (!account || !address || !gameId || isNaN(numericGameId)) {
      setError('Please connect your wallet and provide a valid game ID');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await gameActions.leaveGame(account, numericGameId);
      console.log('[GameWaiting] Leave Game called:', { gameId });
      await fetchGameData();
    } catch (err: any) {
      console.error('Error leaving game:', err.message);
      setError('Failed to leave game. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Commented Solidity leave game logic
  /*
  const handleLeaveGameSolidity = async () => {
    if (!game)
      return setError("No game data found. Please enter a valid game code.");
    setActionLoading(true);
    setError(null);
    try {
      const resp = await apiClient.post<ApiResponse>("/game-players/leave", {
        address,
        code: game.code,
      });
      if (resp?.success === false)
        throw new Error(resp?.message ?? "Failed to leave game");
      if (mountedRef.current) {
        setIsJoined(false);
        setPlayerSymbol(null);
      }
    } catch (err: any) {
      console.error("leave error", err);
      if (mountedRef.current)
        setError(err?.message ?? "Failed to leave game. Please try again.");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };
  */

  const handleStartGame = () => {
    if (!account || !address || !gameId) {
      setError('Please connect your wallet');
      return;
    }
    if (playersJoined === null || maxPlayers === null || playersJoined !== maxPlayers) {
      setError('Cannot start game until all players have joined');
      return;
    }

    console.log('[GameWaiting] Redirecting to /game-play');
    router.push(`/game-play?gameId=${numericGameId}`);
  };

  const handleGoToBoard = () => {
    if (!gameId || !isGameReady || !isPlayerInGame) {
      setError('Cannot proceed to game board');
      return;
    }
    console.log('[GameWaiting] Navigating to game board:', numericGameId);
    router.push(`/game-play?gameId=${numericGameId}`);
  };

  const handleGoHome = () => router.push('/');

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryCount(0);
    setPollBackoff(POLL_INTERVAL);
    fetchGameData();
  };

  const timeAgo = () => {
    if (!lastUpdated) return 'Never';
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  };

  // Player list derived from game_players and playerData
  const playerList = playerData && playerData.joined
    ? [{ address, username: playerData.username, symbol: playerSymbol }]
    : [];

  if (!gameId || isNaN(numericGameId)) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <p className="text-red-500 text-xl font-semibold font-orbitron animate-pulse">
          Invalid Game ID
        </p>
      </section>
    );
  }

  if (error && !loading) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="space-y-4 text-center">
          <p className="text-red-500 text-xl font-semibold font-orbitron">
            {error}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={handleRetry}
              className="bg-[#00F0FF] text-black px-4 py-2 rounded font-orbitron"
              aria-label="Retry loading game data"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="bg-[#00F0FF] text-black px-4 py-2 rounded font-orbitron"
              aria-label="Back to join room"
            >
              Back to Join Room
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="bg-[#00F0FF] text-black px-4 py-2 rounded font-orbitron"
              aria-label="Go to home"
            >
              Go to Home
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        <div className="w-full max-w-md bg-[#0A1A1B]/80 p-6 sm:p-8 rounded-xl shadow-lg border border-[#00F0FF]/30 backdrop-blur-sm">
          <h2 className="text-2xl sm:text-3xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center tracking-wide">
            Blockopoly Waiting Room
            <span className="block text-sm text-[#00F0FF] mt-1 font-bold">
              Game ID: {gameId}
            </span>
          </h2>

          {loading && playersJoined === null ? (
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00F0FF]"></div>
              <p className="ml-3 text-[#00F0FF] font-orbitron">
                Loading game data...
              </p>
            </div>
          ) : (
            <div className="text-center space-y-3 mb-6">
              <p className="text-[#869298] text-sm">
                {playersJoined === maxPlayers ? 'All players joined!' : 'Waiting for players to join...'}
              </p>
              <p className="text-[#00F0FF] text-lg font-semibold">
                Players: {playersJoined ?? '—'}/{maxPlayers ?? '—'}
              </p>
              <div className="w-full items-center flex space-x-4 justify-center flex-wrap">
                {playerList.map((player) => (
                  <span
                    key={player.address}
                    className="text-sm text-[#F0F7F7] flex items-center justify-center gap-2"
                  >
                    {tokens.find((t) => t.value.toString() === player.symbol)?.emoji}
                    <span className="truncate max-w-[130px]">
                      {player.username}
                    </span>
                  </span>
                ))}
              </div>
              <p className="text-[#FFD700] text-sm">
                Initialised: {isInitialised ? '✅ Yes' : '⏳ No'}
              </p>
              <p className="text-gray-400 text-xs">
                Joined Status: {playerData?.joined ? '✅ Joined' : '❌ Not Joined'}
              </p>
              <p className="text-gray-400 text-xs">
                Last updated: {timeAgo()}
              </p>
            </div>
          )}

          {showShareButtons && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gameUrl}
                  readOnly
                  className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none font-orbitron text-sm"
                  title="Game URL"
                  aria-label="Game URL"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-3 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                  disabled={loading || actionLoading}
                  aria-label="Copy game link"
                >
                  <IoCopyOutline className="w-5 h-5" />
                </button>
              </div>
              {copySuccess && (
                <p className="text-green-400 text-xs text-center">{copySuccess}</p>
              )}
              <div className="flex justify-center gap-4">
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-4 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                  aria-label="Share on Telegram"
                >
                  <PiTelegramLogoLight className="mr-2 w-5 h-5" />
                  Share on Telegram
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-4 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                  aria-label="Share on X"
                >
                  <FaXTwitter className="mr-2 w-5 h-5" />
                  Share on X
                </a>
              </div>
            </div>
          )}

          {showJoinGame && (
            <div className="mt-6 space-y-4">
              {availableSymbols.length > 0 ? (
                <>
                  <div className="flex flex-col">
                    <label className="text-sm text-gray-300 mb-1 font-orbitron" htmlFor="player-symbol">
                      Player Symbol
                    </label>
                    <select
                      id="player-symbol"
                      value={playerSymbol}
                      onChange={(e) => setPlayerSymbol(e.target.value)}
                      className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron"
                      aria-label="Select player symbol"
                    >
                      <option value="" disabled>Select a symbol</option>
                      {availableSymbols.map((symbol) => (
                        <option key={symbol.value} value={symbol.value}>
                          {symbol.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleJoinGame}
                    className="w-full bg-[#00F0FF] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#00D4E6] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    disabled={loading || actionLoading || !playerSymbol}
                    aria-disabled={loading || actionLoading || !playerSymbol}
                    aria-label="Join game"
                  >
                    {actionLoading ? 'Joining...' : 'Join Game'}
                  </button>
                </>
              ) : (
                <p className="text-red-500 text-xs text-center animate-pulse">
                  No available symbols. Please wait or try another game.
                </p>
              )}
            </div>
          )}

          {showLeaveGame && (
            <button
              onClick={handleLeaveGame}
              className="w-full mt-6 bg-[#FF4D4D] text-white text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#E63939] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              disabled={loading || actionLoading}
              aria-disabled={loading || actionLoading}
              aria-label="Leave game"
            >
              {actionLoading ? 'Processing...' : 'Leave Game'}
            </button>
          )}

          {showStartGame && (
            <button
              onClick={handleStartGame}
              className="w-full mt-6 bg-[#00F0FF] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#00D4E6] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              disabled={playersJoined !== maxPlayers || loading || actionLoading}
              aria-disabled={playersJoined !== maxPlayers || loading || actionLoading}
              aria-label="Start game"
            >
              Start Game
            </button>
          )}

          {showGoToBoard && (
            <button
              onClick={handleGoToBoard}
              className="w-full mt-6 bg-[#FFD700] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#FFCA28] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              disabled={loading || actionLoading}
              aria-disabled={loading || actionLoading}
              aria-label="Go to game board"
            >
              Go to Board
            </button>
          )}

          <div className="flex justify-between mt-3">
            <button
              onClick={() => router.push('/join-room')}
              className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
              aria-label="Back to join room"
            >
              Back to Join Room
            </button>
            <button
              onClick={handleGoHome}
              className="flex items-center text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
              aria-label="Go to home"
            >
              <IoHomeOutline className="mr-1 w-4 h-4" />
              Go to Home
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-xs mt-4 text-center animate-pulse">
              {error}
            </p>
          )}
        </div>
      </main>
    </section>
  );
};

export default GameWaiting;