'use client';

import { House } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { FaUser } from 'react-icons/fa6';
import { IoIosAddCircle } from 'react-icons/io';
import { IoKey, IoArrowDown, IoArrowUp } from 'react-icons/io5';
import { RxDotFilled } from 'react-icons/rx';
import { motion, AnimatePresence } from 'framer-motion';

// Define settings interface
interface GameSettings {
  auction: number;
  even_build: number;
  mortgage: number;
  randomize_play_order: number;
  rent_in_prison: number;
  starting_cash: number;
}

// Define game interface - added is_initialised
interface Game {
  id: number;
  code: string;
  mode: 'PUBLIC' | 'PRIVATE';
  status: 'Pending' | 'Ongoing' | 'Ended'; // Updated to include ENDED
  is_initialised?: boolean;
  number_of_players: number;
  players_joined?: number;
  creator_id?: number;
  settings?: GameSettings;
  created_at?: string;
}

const JoinRoom = () => {
  const router = useRouter();
  // Dummy data for games - updated with real examples: ID 2 (ENDED), ID 12 (ONGOING), ID 20 (PENDING uninit), ID 9 (PENDING init), ID 10 (ONGOING from log)
  const [games] = useState<Game[]>([
    {
      id: 1,
      code: 'ABC123',
      mode: 'PUBLIC',
      status: 'Pending',
      is_initialised: true,
      number_of_players: 4,
      players_joined: 2,
      creator_id: 1,
      settings: {
        auction: 1,
        even_build: 0,
        mortgage: 1,
        randomize_play_order: 1,
        rent_in_prison: 0,
        starting_cash: 1500,
      },
      created_at: '2025-09-24T10:00:00Z',
    },
    {
      id: 2,
      code: 'ENDED001', // Mock code
      mode: 'PUBLIC',
      status: 'Ended',
      is_initialised: true,
      number_of_players: 3,
      players_joined: 0,
      creator_id: 1416585833,
      settings: {
        auction: 1,
        even_build: 0,
        mortgage: 1,
        randomize_play_order: 1,
        rent_in_prison: 0,
        starting_cash: 1500,
      },
      created_at: '2025-11-01T00:00:00Z',
    },
    {
      id: 9,
      code: 'JOINABLE001', // Mock code
      mode: 'PUBLIC',
      status: 'Pending',
      is_initialised: true,
      number_of_players: 2,
      players_joined: 1,
      creator_id: 4713695840083605365,
      settings: {
        auction: 1,
        even_build: 0,
        mortgage: 1,
        randomize_play_order: 1,
        rent_in_prison: 0,
        starting_cash: 1500,
      },
      created_at: '2025-11-01T00:00:00Z',
    },
    {
      id: 10,
      code: 'GAME10', // Mock code based on log
      mode: 'PUBLIC',
      status: 'Ongoing',
      is_initialised: true,
      number_of_players: 2,
      players_joined: 2,
      creator_id: 4713695840083605365,
      settings: {
        auction: 1,
        even_build: 0,
        mortgage: 1,
        randomize_play_order: 1,
        rent_in_prison: 0,
        starting_cash: 1500,
      },
      created_at: '2025-11-01T00:00:00Z',
    },
    {
      id: 12,
      code: 'STARTED001', // Mock code
      mode: 'PUBLIC',
      status: 'Ongoing',
      is_initialised: true,
      number_of_players: 2,
      players_joined: 2,
      creator_id: 81782240341865,
      settings: {
        auction: 1,
        even_build: 0,
        mortgage: 1,
        randomize_play_order: 1,
        rent_in_prison: 0,
        starting_cash: 1500,
      },
      created_at: '2025-11-01T00:00:00Z',
    },
    {
      id: 20,
      code: 'CREATED001', // Mock code
      mode: 'PUBLIC',
      status: 'Pending',
      is_initialised: false,
      number_of_players: 0, // As per real
      players_joined: 0,
      creator_id: 0,
      settings: {
        auction: 1,
        even_build: 0,
        mortgage: 1,
        randomize_play_order: 1,
        rent_in_prison: 0,
        starting_cash: 1500,
      },
      created_at: new Date().toISOString(),
    },
  ]);
  const [ongoingGames, setOngoingGames] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>(''); // Renamed for clarity: code OR ID
  const [continueGameId, setContinueGameId] = useState<number | null>(null);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  useEffect(() => {
    // Load ongoing games from localStorage
    const storedGames = JSON.parse(localStorage.getItem('ongoingGames') || '[]') as number[];
    setOngoingGames(storedGames);
  }, []);

  // Helper: Find game by code or ID - for IDs not in dummy, return mock Pending game (initialized)
  const findGameByValue = (value: string): Game | null => {
    const idNum = parseInt(value);
    const isId = !isNaN(idNum) && value === idNum.toString();
    if (isId) {
      // Check dummy first
      const dummyGame = games.find((g) => g.id === idNum);
      if (dummyGame) return dummyGame;
      // Mock initialized Pending game for any valid ID (simulate backend fetch)
      return {
        id: idNum,
        code: `MOCK${idNum.toString().padStart(3, '0')}`,
        mode: 'PUBLIC' as const,
        status: 'Pending' as const,
        is_initialised: true,
        number_of_players: 4, // Default
        players_joined: 1, // Assume room for join
        creator_id: 1,
        settings: {
          auction: 1,
          even_build: 0,
          mortgage: 1,
          randomize_play_order: 1,
          rent_in_prison: 0,
          starting_cash: 1500,
        },
        created_at: new Date().toISOString(),
      };
    }
    return games.find((g) => g.code === value.toUpperCase()) || null;
  };

  // Unified join handler: Check is_initialised && Pending -> waiting; polished errors
  const handleJoin = (value: string) => {
    if (!value.trim()) {
      setError('Please enter a room code or ID');
      return;
    }

    setLoading(true);
    setError(null);

    // TODO: Real backend - Replace with Starknet call to retrieveGame(value), parse JSON:
    // e.g., const response = await gameContract.retrieveGame(idOrCode);
    // const game = {
    //   ...response,
    //   status: response.status.variant.Pending ? 'Pending' : response.status.variant.Ongoing ? 'ONGOING' : 'ENDED',
    //   is_initialised: response.is_initialised,
    //   number_of_players: parseInt(response.number_of_players),
    //   players_joined: parseInt(response.players_joined),
    // };

    const game = findGameByValue(value.trim());
    if (!game) {
      setError(`Game with code/ID "${value}" not found.`);
      setLoading(false);
      return;
    }

    // Check initialized and Pending
    if (!game.is_initialised) {
      setError('This game has not been initialized yet. Please wait for the creator to set it up.');
      setLoading(false);
      return;
    }

    if (game.status !== 'Pending') {
      if (game.status === 'Ongoing') {
        setError('This game has already started. If you are a player, use "Continue Existing Game" to rejoin.');
      } else if (game.status === 'Ended') {
        setError('This game has finished. You cannot join a completed game.');
      } else {
        setError(`This game is in an invalid state (${game.status}). Please contact support.`);
      }
      setLoading(false);
      return;
    }

    // Check if full
    if ((game.players_joined || 0) >= game.number_of_players) {
      setError('This game is full. No more players can join.');
      setLoading(false);
      return;
    }

    // Redirect to waiting room
    router.push(`/game-waiting?gameId=${game.id}`);
    setLoading(false);
  };

  const handleCreateRoom = () => {
    router.push('/game-settings');
  };

  const handleInputJoin = () => {
    handleJoin(inputValue);
  };

  // Separate handler for continue: ONGOING only, player check
  const handleContinueGame = () => {
    if (!continueGameId || isNaN(continueGameId) || continueGameId <= 0) {
      setError('Please enter a valid game ID');
      return;
    }
    setLoading(true);
    setError(null);

    const game = games.find((g) => g.id === continueGameId) || findGameByValue(continueGameId.toString());
    if (!game) {
      setError(`Game with ID "${continueGameId}" not found.`);
      setLoading(false);
      return;
    }

    // TODO: Real backend - Fetch and parse as above

    // Must be initialized and ongoing
    if (!game.is_initialised) {
      setError('This game has not been initialized. Cannot continue.');
      setLoading(false);
      return;
    }
    if (game.status !== 'Ongoing') {
      setError(`Cannot continue this game. It is ${game.status.toLowerCase()}.`);
      setLoading(false);
      return;
    }

    // TODO: Real backend - Verify player membership via contract (e.g., check if user address in game_players)

    // Redirect to game play
    router.push(`/game-play?gameId=${continueGameId}`);
    setLoading(false);
  };

  const handleLeaveGame = () => {
    if (!continueGameId || isNaN(continueGameId) || continueGameId <= 0) {
      setError('Please enter a valid game ID');
      return;
    }
    setLoading(true);
    setError(null);

    // Simulate leaving game (remove from ongoing)
    const updatedGames = ongoingGames.filter((id) => id !== continueGameId);
    setOngoingGames(updatedGames);
    localStorage.setItem('ongoingGames', JSON.stringify(updatedGames));
    setContinueGameId(null);
    setLoading(false);
  };

  const clearOngoingGames = () => {
    localStorage.removeItem('ongoingGames');
    setOngoingGames([]);
  };

  // Toggle dropdown for a specific game
  const toggleSettings = (code: string) => {
    setExpandedGame(expandedGame === code ? null : code);
  };

  // Helper to render player indicators
  const renderIndicators = (game: Game) => {
    const playersJoined = game.players_joined || 0;
    const maxPlayers = game.number_of_players;
    return (
      <span className="flex gap-1.5">
        {Array(playersJoined)
          .fill(0)
          .map((_, i) => (
            <FaUser key={`user-${i}`} className="w-4 h-4 text-[#00F0FF]" />
          ))}
        {Array(maxPlayers - playersJoined)
          .fill(0)
          .map((_, i) => (
            <RxDotFilled key={`dot-${i}`} className="w-4 h-4 text-[#455A64]" />
          ))}
      </span>
    );
  };

  // Helper for private indicator
  const renderPrivateIndicator = (game: Game) => (
    <span className="flex gap-1.5 mt-1">
      {game.mode === 'PRIVATE' && <IoKey className="w-4 h-4 text-[#00F0FF]" />}
      {Array(game.number_of_players - (game.mode === 'PRIVATE' ? 1 : 0))
        .fill(0)
        .map((_, i) => (
          <RxDotFilled key={`key-dot-${i}`} className="w-4 h-4 text-[#455A64]" />
        ))}
    </span>
  );

  // Helper to render game settings
  const renderGameSettings = (settings?: GameSettings) => {
    if (!settings) return null;
    const settingsList = [
      { key: 'Auction', value: settings.auction ? 'Enabled' : 'Disabled' },
      { key: 'Even Build', value: settings.even_build ? 'Enabled' : 'Disabled' },
      { key: 'Mortgage', value: settings.mortgage ? 'Enabled' : 'Disabled' },
      { key: 'Randomize Play Order', value: settings.randomize_play_order ? 'Enabled' : 'Disabled' },
      { key: 'Rent in Prison', value: settings.rent_in_prison ? 'Enabled' : 'Disabled' },
      { key: 'Starting Cash', value: `$${settings.starting_cash}` },
    ];
    return (
      <div className="grid grid-cols-1 gap-2 mt-3 text-[#869298] text-[13px] font-dmSans">
        {settingsList.map(({ key, value }) => (
          <p key={key} className="flex justify-between">
            <span className="font-[500]">{key}:</span>
            <span>{value}</span>
          </p>
        ))}
      </div>
    );
  };

  // Filter Pending AND initialized games for the list
  const PendingGames = games.filter((game) => game.status === 'Pending' && game.is_initialised === true);

  return (
    <section className="w-full min-h-screen bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full min-h-screen py-20 flex flex-col items-center justify-start bg-[#010F101F] backdrop-blur-[12px] px-4">
        <div className="w-full flex flex-col items-center mb-8">
          <h2 className="text-[#F0F7F7] font-orbitron md:text-[24px] text-[20px] font-[700] text-center">
            Join Room
          </h2>
          <p className="text-[#869298] text-[16px] font-dmSans text-center mt-2">
            Select the room you would like to join
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-[792px] flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="relative group w-full sm:w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-50"
            disabled={loading}
          >
            <svg
              width="227"
              height="40"
              viewBox="0 0 227 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-0 left-0 w-full h-full"
            >
              <path
                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#0E1415"
                stroke="#003B3E"
                strokeWidth={1}
                className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[13px] font-dmSans font-medium z-10">
              <House className="mr-1 w-[14px] h-[14px]" />
              Go Back Home
            </span>
          </button>
          <button
            type="button"
            onClick={handleCreateRoom}
            className="relative group w-full sm:w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-50"
            disabled={loading}
          >
            <svg
              width="227"
              height="40"
              viewBox="0 0 227 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
            >
              <path
                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#003B3E"
                stroke="#003B3E"
                strokeWidth={1}
                className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-10">
              <IoIosAddCircle className="mr-1 w-[14px] h-[14px]" />
              Create New Room
            </span>
          </button>
          <button
            type="button"
            onClick={clearOngoingGames}
            className="relative group w-full sm:w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-50"
            disabled={loading}
          >
            <svg
              width="227"
              height="40"
              viewBox="0 0 227 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-0 left-0 w-full h-full"
            >
              <path
                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#0E1415"
                stroke="#FF0000"
                strokeWidth={1}
                className="group-hover:stroke-[#FF0000] transition-all duration-300 ease-in-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#FF0000] capitalize text-[13px] font-dmSans font-medium z-10">
              Clear Ongoing Games
            </span>
          </button>
        </div>

        {/* Rooms List */}
        <div className="w-full max-w-[792px] bg-[#010F10] rounded-[12px] border-[1px] border-[#003B3E] p-6 md:p-8 flex flex-col gap-6">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[#FF6B6B] text-center text-[14px] font-dmSans bg-[#FF6B6B]/10 p-3 rounded-[8px] border border-[#FF6B6B]/30"
            >
              {error}
            </motion.p>
          )}

          {/* Join by Code or ID */}
          <div className="w-full flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Input room code (e.g., ABC123) or ID (e.g., 1)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 h-[52px] px-4 text-[#73838B] border-[1px] border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF] bg-transparent placeholder:text-[#455A64]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInputJoin();
                }
              }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleInputJoin}
              className="relative group w-full sm:w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-50"
              disabled={loading || !inputValue.trim()}
            >
              <svg
                width="260"
                height="52"
                viewBox="0 0 260 52"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
              >
                <path
                  d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                  fill="#00F0FF"
                  stroke="#0E282A"
                  strokeWidth={1}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#010F10] capitalize text-[18px] -tracking-[2%] font-orbitron font-[700] z-10">
                Join Room
              </span>
            </button>
          </div>

          {/* Continue Existing Game */}
          <div className="w-full flex flex-col gap-4 pt-6 border-t border-[#0E282A]">
            <h3 className="text-[#F0F7F7] font-orbitron text-[18px] font-[600] text-center">
              Continue Existing Game
            </h3>
            <input
              type="number"
              placeholder="Enter game ID (e.g., 12)"
              value={continueGameId ?? ''}
              onChange={(e) => setContinueGameId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-[52px] px-4 text-[#73838B] border-[1px] border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF] bg-transparent placeholder:text-[#455A64]"
              disabled={loading}
            />
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={handleContinueGame}
                className="relative group flex-1 h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-50"
                disabled={loading || !continueGameId}
              >
                <svg
                  width="100%"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth={1}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] font-orbitron font-[700] z-10">
                  Continue Game
                </span>
              </button>
              <button
                type="button"
                onClick={handleLeaveGame}
                className="relative group flex-1 h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-50"
                disabled={loading || !continueGameId}
              >
                <svg
                  width="100%"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#FF4D4D"
                    stroke="#0E282A"
                    strokeWidth={1}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] font-orbitron font-[700] z-10">
                  Leave Game
                </span>
              </button>
            </div>
          </div>

          {PendingGames.length === 0 ? (
            <p className="text-[#869298] text-center text-[16px] font-dmSans mt-8">
              No pending games available. Create one to start playing!
            </p>
          ) : (
            <div className="space-y-4 mt-8 pt-6 border-t border-[#0E282A]">
              {PendingGames.map((game) => (
                <motion.div
                  key={game.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="w-full border-[1px] border-[#0E282A] rounded-[12px] overflow-hidden bg-[#010F10]/50 hover:border-[#00F0FF]/50 transition-all duration-300"
                >
                  <div
                    className="w-full p-4 flex justify-between items-center cursor-pointer hover:bg-[#0E282A]/50 transition-colors"
                    onClick={() => toggleSettings(game.code)}
                  >
                    <h4 className="text-[#F0F7F7] text-[18px] uppercase font-dmSans font-[700] tracking-wide">
                      {game.code}
                    </h4>
                    <div className="flex items-center gap-4">
                      {renderIndicators(game)}
                      {expandedGame === game.code ? (
                        <IoArrowUp className="text-[#F0F7F7] w-5 h-5 transition-transform" />
                      ) : (
                        <IoArrowDown className="text-[#F0F7F7] w-5 h-5 transition-transform" />
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedGame === game.code && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 border-t border-[#0E282A]">
                          {renderPrivateIndicator(game)}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-[#869298] text-[14px] font-dmSans">
                            <p><strong>Players:</strong> {game.players_joined || 0}/{game.number_of_players}</p>
                            <p><strong>Mode:</strong> {game.mode}</p>
                            <p><strong>ID:</strong> {game.id}</p>
                            <p><strong>Created:</strong> {game.created_at ? new Date(game.created_at).toLocaleString() : 'N/A'}</p>
                          </div>
                          {renderGameSettings(game.settings)}
                          <button
                            type="button"
                            onClick={() => handleJoin(game.code)}
                            className="relative group w-full h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer mt-4 disabled:opacity-50"
                            disabled={loading}
                          >
                            <svg
                              width="100%"
                              height="40"
                              viewBox="0 0 150 40"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                            >
                              <path
                                d="M6 1H144C148.373 1 150.996 5.85486 148.601 9.5127L130.167 37.5127C129.151 39.0646 127.42 40 125.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                                fill="#00F0FF"
                                stroke="#0E282A"
                                strokeWidth={1}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[#010F10] capitalize text-[14px] font-orbitron font-[700] z-10">
                              Join Room
                            </span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </section>
  );
};

export default JoinRoom;