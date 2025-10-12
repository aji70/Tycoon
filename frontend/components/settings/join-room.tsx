'use client';

import { House } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { FaUser } from 'react-icons/fa6';
import { IoIosAddCircle } from 'react-icons/io';
import { IoKey } from 'react-icons/io5';
import { RxDotFilled } from 'react-icons/rx';
import { IoIosArrowDown, IoIosArrowUp } from 'react-icons/io';

// Define settings interface
interface GameSettings {
  auction: number;
  even_build: number;
  mortgage: number;
  randomize_play_order: number;
  rent_in_prison: number;
  starting_cash: number;
}

// Define game interface
interface Game {
  id: number;
  code: string;
  mode: 'PUBLIC' | 'PRIVATE';
  status: string;
  number_of_players: number;
  players_joined?: number;
  creator_id?: number;
  settings?: GameSettings;
  created_at?: string;
}

const JoinRoom = () => {
  const router = useRouter();
  // Dummy data for games
  const [games] = useState<Game[]>([
    {
      id: 1,
      code: 'ABC123',
      mode: 'PUBLIC',
      status: 'PENDING',
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
      code: 'XYZ789',
      mode: 'PRIVATE',
      status: 'PENDING',
      number_of_players: 3,
      players_joined: 1,
      creator_id: 2,
      settings: {
        auction: 0,
        even_build: 1,
        mortgage: 0,
        randomize_play_order: 0,
        rent_in_prison: 1,
        starting_cash: 2000,
      },
      created_at: '2025-09-24T12:00:00Z',
    },
  ]);
  const [ongoingGames, setOngoingGames] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState<string>('');
  const [continueGameId, setContinueGameId] = useState<number | null>(null);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  useEffect(() => {
    // Load ongoing games from localStorage
    const storedGames = JSON.parse(localStorage.getItem('ongoingGames') || '[]') as number[];
    setOngoingGames(storedGames);
  }, []);

  // Commented out backend logic
  /*
  const { account, address, connector } = useAccount();
  const game = useGameActions();
  const player = usePlayerActions();
  useEffect(() => {
    if (isWasmSupported()) {
      getWasmCapabilities();
    }
    if (address) {
      let isMounted = true;
      const checkRegistration = async () => {
        try {
          const registered = await player.isRegistered(address);
          if (!isMounted) return;
          setIsRegistered(registered);
          if (registered) {
            const user = await player.getUsernameFromAddress(address);
            if (!isMounted) return;
            setUsername(shortString.decodeShortString(user) || 'Unknown');
          }
        } catch (err: any) {
          if (!isMounted) return;
          setError(err?.message || 'Failed to check registration status');
        }
      };
      checkRegistration();
      return () => {
        isMounted = false;
      };
    }
  }, [address, player]);
  */

  const handleJoinByCode = (code: string) => {
    setLoading(true);
    setError(null);
    // Simulate joining a game
    const game = games.find((g) => g.code === code.toUpperCase());
    if (!game) {
      setError(`Game ${code} not found.`);
      setLoading(false);
      return;
    }
    if (game.status !== 'PENDING') {
      setError(`Game ${code} has already started or ended.`);
      setLoading(false);
      return;
    }
    const updatedGames = [...new Set([...ongoingGames, game.id])];
    setOngoingGames(updatedGames);
    localStorage.setItem('ongoingGames', JSON.stringify(updatedGames));
    router.push(`/game-waiting?gameCode=${code}`);
    setLoading(false);
  };

  const handleCreateRoom = () => {
    router.push('/game-settings');
  };

  const handleInputJoin = () => {
    if (inputCode.trim()) {
      handleJoinByCode(inputCode.trim().toUpperCase());
    }
  };

  const handleContinueGame = () => {
    if (!continueGameId || isNaN(continueGameId) || continueGameId <= 0) {
      setError('Please enter a valid game ID');
      return;
    }
    setLoading(true);
    setError(null);

    // Simulate checking game status
    const game = games.find((g) => g.id === continueGameId);
    if (!game) {
      setError('Game not found');
      setLoading(false);
      return;
    }
    const isPending = game.status === 'PENDING';
    const isOngoing = game.status === 'ONGOING';

    if (isPending) {
      router.push(`/game-waiting?gameId=${continueGameId}`);
    } else if (isOngoing) {
      router.push(`/game-play?gameId=${continueGameId}`);
    } else {
      setError('Invalid game status');
    }
    setLoading(false);
  };

  const handleLeaveGame = () => {
    if (!continueGameId || isNaN(continueGameId) || continueGameId <= 0) {
      setError('Please enter a valid game ID');
      return;
    }
    setLoading(true);
    setError(null);

    // Simulate leaving game
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
    const playersJoined = game.players_joined || 1;
    const maxPlayers = game.number_of_players;
    return (
      <span className="flex gap-1.5 text-[#263238]">
        {Array(playersJoined)
          .fill(0)
          .map((_, i) => (
            <FaUser key={`user-${i}`} className="text-[#F0F7F7]" />
          ))}
        {Array(maxPlayers - playersJoined)
          .fill(0)
          .map((_, i) => (
            <RxDotFilled key={`dot-${i}`} className="w-5 h-5" />
          ))}
      </span>
    );
  };

  // Helper for private indicator
  const renderPrivateIndicator = (game: Game) => (
    <span className="flex gap-1.5 text-[#263238] mt-2">
      {game.mode === 'PRIVATE' && <IoKey className="text-[#F0F7F7] w-5 h-5" />}
      {Array(game.number_of_players - 1)
        .fill(0)
        .map((_, i) => (
          <RxDotFilled key={`key-dot-${i}`} className="w-5 h-5" />
        ))}
    </span>
  );

  // Helper to render game settings
  const renderGameSettings = (settings?: GameSettings) => {
    if (!settings) return null;
    return (
      <div className="text-[#869298] text-[14px] font-dmSans mt-2">
        <p>
          <strong>Auction:</strong> {settings.auction ? 'Enabled' : 'Disabled'}
        </p>
        <p>
          <strong>Even Build:</strong> {settings.even_build ? 'Enabled' : 'Disabled'}
        </p>
        <p>
          <strong>Mortgage:</strong> {settings.mortgage ? 'Enabled' : 'Disabled'}
        </p>
        <p>
          <strong>Randomize Play Order:</strong> {settings.randomize_play_order ? 'Enabled' : 'Disabled'}
        </p>
        <p>
          <strong>Rent in Prison:</strong> {settings.rent_in_prison ? 'Enabled' : 'Disabled'}
        </p>
        <p>
          <strong>Starting Cash:</strong> ${settings.starting_cash}
        </p>
      </div>
    );
  };

  return (
    <section className="w-full min-h-screen bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full min-h-screen py-20 flex flex-col items-center justify-start bg-[#010F101F] backdrop-blur-[12px] px-4">
        <div className="w-full flex flex-col items-center">
          <h2 className="text-[#F0F7F7] font-orbitron md:text-[24px] text-[20px] font-[700] text-center">
            Join Room
          </h2>
          <p className="text-[#869298] text-[16px] font-dmSans text-center">
            Select the room you would like to join
          </p>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-[792px] mt-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="relative group w-full md:w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
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
            className="relative group w-full md:w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
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
            className="relative group w-full md:w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
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

        {/* Rooms */}
        <div className="w-full max-w-[792px] mt-10 bg-[#010F10] rounded-[12px] border-[1px] border-[#003B3E] md:px-20 px-6 py-12 flex flex-col gap-4">
          {error && <p className="text-[#FF6B6B] text-center">{error}</p>}
          {games.length === 0 ? (
            <p className="text-[#869298] text-center">
              No pending games available. Create one to start playing!
            </p>
          ) : (
            games.map((game) => (
              <div
                key={game.code}
                className="w-full p-4 border-[1px] flex flex-col items-start border-[#0E282A] rounded-[12px] cursor-pointer hover:border-[#00F0FF]"
              >
                <div
                  className="w-full flex justify-between items-center"
                  onClick={() => toggleSettings(game.code)}
                >
                  <h4 className="text-[#F0F7F7] text-[20px] uppercase font-dmSans font-[800]">
                    {game.code}
                  </h4>
                  <div className="flex items-center gap-4">
                    {renderIndicators(game)}
                    {expandedGame === game.code ? (
                      <IoIosArrowUp className="text-[#F0F7F7] w-5 h-5" />
                    ) : (
                      <IoIosArrowDown className="text-[#F0F7F7] w-5 h-5" />
                    )}
                  </div>
                </div>
                {renderPrivateIndicator(game)}
                <p className="text-[#869298] text-[14px] font-dmSans mt-2">
                  <strong>Players Joined:</strong> {game.players_joined || 1}/{game.number_of_players}
                </p>
                {expandedGame === game.code && (
                  <div className="mt-2 w-full">
                    <div className="text-[#869298] text-[14px] font-dmSans">
                      <p>
                        <strong>Mode:</strong> {game.mode}
                      </p>
                      <p>
                        <strong>Created:</strong>{' '}
                        {game.created_at ? new Date(game.created_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    {renderGameSettings(game.settings)}
                    <button
                      type="button"
                      onClick={() => handleJoinByCode(game.code)}
                      className="relative group w-[150px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer mt-4"
                      disabled={loading}
                    >
                      <svg
                        width="150"
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
                )}
              </div>
            ))
          )}

          {/* Join by Code */}
          <div className="w-full h-[52px] flex mt-8">
            <input
              type="text"
              placeholder="Input room code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="w-full h-full px-4 text-[#73838B] border-[1px] border-[#0E282A] rounded-[12px] flex-1 outline-none focus:border-[#00F0FF]"
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
              className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              disabled={loading}
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
          <div className="w-full flex flex-col gap-4 mt-8">
            <h3 className="text-[#F0F7F7] font-orbitron text-[18px] font-[600] text-center">
              Continue Existing Game
            </h3>
            <input
              type="number"
              placeholder="Enter game ID (e.g., 1)"
              value={continueGameId ?? ''}
              onChange={(e) => setContinueGameId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-[52px] px-4 text-[#73838B] border border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF]"
              disabled={loading}
            />
            <div className="flex flex-col md:flex-row gap-4">
              <button
                type="button"
                onClick={handleContinueGame}
                className="relative group w-full h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                disabled={loading || !continueGameId}
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
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] font-orbitron font-[700] z-10">
                  Continue Game
                </span>
              </button>
              <button
                type="button"
                onClick={handleLeaveGame}
                className="relative group w-full h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                disabled={loading || !continueGameId}
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
        </div>
      </main>
    </section>
  );
};

export default JoinRoom;