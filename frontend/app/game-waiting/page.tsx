'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { useGameActions } from '@/hooks/useGameActions';
import { PiTelegramLogoLight } from 'react-icons/pi';
import { FaXTwitter } from 'react-icons/fa6';
import { IoCopyOutline } from 'react-icons/io5';

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

const GameWaiting = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');
  const creator = searchParams.get('creator');
  const { account, address } = useAccount();
  const gameActions = useGameActions();

  const [playersJoined, setPlayersJoined] = useState<number | null>(null);
  const [maxPlayers, setMaxPlayers] = useState<number | null>(null);
  const [isInitialised, setIsInitialised] = useState<boolean | null>(null);
  const [isPending, setIsPending] = useState<boolean | null>(null);
  const [isPlayerInGame, setIsPlayerInGame] = useState<boolean>(false);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<string>('0');
  const [playerSymbolFields, setPlayerSymbolFields] = useState<string[]>([]);
  const [availableSymbols, setAvailableSymbols] = useState<{ value: string; label: string }[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const numericGameId = gameId ? Number(gameId) : NaN;
  const isGameReady = playersJoined !== null && maxPlayers !== null && playersJoined === maxPlayers && isInitialised;
  const isCreator = address === creator;
  const showStartGame = playersJoined !== null && maxPlayers !== null && playersJoined === maxPlayers;
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

  // Handle copying the game URL to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy link. Please try again.');
    }
  };

  const fetchGameData = useCallback(async () => {
    if (!gameId || isNaN(numericGameId) || !address) return;

    try {
      const gameData = (await gameActions.getGame(numericGameId)) as Game;
      if (!gameData) {
        console.warn('No game data returned, keeping last state.');
        return;
      }

      const joined = Number(gameData.players_joined);
      const max = Number(gameData.number_of_players);
      const initialised = Boolean(gameData.is_initialised);
      const pending = !!gameData.status?.variant?.Pending;
      const playerInGame = gameData.game_players.includes(address);

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
      console.log('[GameWaiting] Player Fields:', {
        player_hat: gameData.player_hat,
        player_car: gameData.player_car,
        player_dog: gameData.player_dog,
        player_thimble: gameData.player_thimble,
        player_iron: gameData.player_iron,
        player_battleship: gameData.player_battleship,
        player_boot: gameData.player_boot,
        player_wheelbarrow: gameData.player_wheelbarrow,
      });
      const symbolNames = symbolFields
        .filter(({ field }) => gameData[field as keyof Game] === BigInt(0))
        .map(({ label }) => label);
      const filteredSymbols = symbolFields
        .filter(({ field }) => gameData[field as keyof Game] === BigInt(0))
        .map(({ value, label }) => ({ value, label }));

      const playerDataResult = (await gameActions.getPlayer(address, numericGameId)) as Player;
      console.log('[GameWaiting] Player Data:', playerDataResult);

      setPlayersJoined(!isNaN(joined) ? joined : playersJoined);
      setMaxPlayers(!isNaN(max) ? max : maxPlayers);
      setIsInitialised(initialised);
      setIsPending(pending);
      setIsPlayerInGame(playerInGame);
      setPlayerData(playerDataResult);
      setPlayerSymbolFields(symbolNames);
      setAvailableSymbols(filteredSymbols);
      if (filteredSymbols.length > 0 && !filteredSymbols.some((symbol) => symbol.value === playerSymbol)) {
        setPlayerSymbol(filteredSymbols[0].value);
      }
      setLastUpdated(Date.now());
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching game data:', err.message);
      setError('Failed to load game data. Retrying...');
    }
  }, [gameId, numericGameId, gameActions, address, playersJoined, maxPlayers, playerSymbol]);

  

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    fetchGameData();
    intervalId = setInterval(fetchGameData, 5000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchGameData]);

  const handleJoinGame = async () => {
    if (!account || !address || !gameId || isNaN(numericGameId)) {
      setError('Please connect your wallet and provide a valid game ID');
      return;
    }
    if (!playerSymbol || !availableSymbols.some((symbol) => symbol.value === playerSymbol)) {
      setError('Please select a valid player symbol');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await gameActions.joinGame(account, Number(playerSymbol), numericGameId);
      console.log('[GameWaiting] Join Game called:', { gameId, playerSymbol });
      await fetchGameData();
    } catch (err: any) {
      console.error('Error joining game:', err.message);
      setError('Failed to join game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!account || !address || !gameId || isNaN(numericGameId)) {
      setError('Please connect your wallet and provide a valid game ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await gameActions.leaveGame(account, numericGameId);
      console.log('[GameWaiting] Leave Game called:', { gameId });
      await fetchGameData();
    } catch (err: any) {
      console.error('Error leaving game:', err.message);
      setError('Failed to leave game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  const timeAgo = () => {
    if (!lastUpdated) return 'Never';
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  };

  if (!gameId || isNaN(numericGameId)) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <p className="text-red-500 text-xl font-semibold font-orbitron animate-pulse">
          Invalid Game ID
        </p>
      </section>
    );
  }

  return (
    <section className="w-full h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        <div className="w-full max-w-md bg-[#0A1A1B]/80 p-6 sm:p-8 rounded-xl shadow-lg border border-[#00F0FF]/30 backdrop-blur-sm">
          <h2 className="text-2xl sm:text-3xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center tracking-wide">
            Blockopoly Waiting Room
            <span className="block text-sm text-[#00F0FF] mt-1">
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
            <div className="text-center space-y-3">
              <p className="text-[#869298] text-sm">
                {playersJoined === maxPlayers ? 'All players joined!' : 'Waiting for players to join...'}
              </p>
              <p className="text-[#00F0FF] text-lg font-semibold">
                Players: {playersJoined ?? '—'}/{maxPlayers ?? '—'}
              </p>
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

          {/* Share Game Code Section */}
          {showShareButtons && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gameUrl}
                  readOnly
                  className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none font-orbitron text-sm"
                  title="Game URL"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-3 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                  disabled={loading}
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
                >
                  <PiTelegramLogoLight className="mr-2 w-5 h-5" />
                  Share on Telegram
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-4 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
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
                    <label className="text-sm text-gray-300 mb-1 font-orbitron">Player Symbol</label>
                    <select
                      value={playerSymbol}
                      onChange={(e) => setPlayerSymbol(e.target.value)}
                      className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron"
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
                    disabled={loading}
                  >
                    Join Game
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
              disabled={loading}
            >
              Leave Game
            </button>
          )}

          {showStartGame && (
            <button
              onClick={handleStartGame}
              className="w-full mt-6 bg-[#00F0FF] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#00D4E6] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              disabled={playersJoined !== maxPlayers}
            >
              Start Game
            </button>
          )}

          {showGoToBoard && (
            <button
              onClick={handleGoToBoard}
              className="w-full mt-6 bg-[#FFD700] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#FFCA28] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              disabled={loading}
            >
              Go to Board
            </button>
          )}

          <button
            onClick={() => router.push('/join-room')}
            className="w-full mt-3 text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
          >
            Back to Join Room
          </button>

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