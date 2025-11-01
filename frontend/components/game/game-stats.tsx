'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { useGameActions } from '@/hooks/useGameActions';
import { usePlayerActions } from '@/hooks/usePlayerActions';
import { BarChart2, Trophy, Wallet, Clock } from 'lucide-react';
import { shortString } from 'starknet';
import Image from 'next/image';

interface PlayerStats {
  totalGamesPlayed: number;
  totalGamesWon: number;
  balance: number;
  ranking: number;
}

interface LeaderboardEntry {
  username: string;
  address: string;
  totalGamesPlayed: number;
  totalGamesWon: number;
  ranking: number;
}

interface GameDetails {
  id: number;
  winner: string | null;
  winnerUsername: string;
  createdBy: string;
  createdByUsername: string;
  status: string;
  players: { address: string; username: string; balance: number }[];
  duration: number; // in seconds
}

const GameStats: React.FC = () => {
  const router = useRouter();
  const { account, address } = useAccount();
  const gameActions = useGameActions();
  const playerActions = usePlayerActions();
  const [playerStats, setPlayerStats] = useState<PlayerStats>({ totalGamesPlayed: 0, totalGamesWon: 0, balance: 0, ranking: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameIdQuery, setGameIdQuery] = useState('');
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerUsername, setPlayerUsername] = useState<string>('Player');

  useEffect(() => {
    if (!address) {
      setError('Please connect your Starknet account to view stats.');
      setPlayerUsername('Guest');
      return;
    }
    fetchPlayerUsername();
    fetchStats();
  }, [address]);

  const fetchPlayerUsername = async () => {
    if (!address) return;
    try {
      const playerData = await playerActions.retrievePlayer(String(address).toLowerCase());
      const decodedUsername = shortString.decodeShortString(playerData.username) || `Player_${address.slice(0, 6)}`;
      setPlayerUsername(decodedUsername);
    } catch (err: any) {
      console.error('Error fetching player username:', err);
      setPlayerUsername(`Player_${address.slice(0, 6)}`);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const playerAddr = String(address).toLowerCase();
      // Fetch connected player's stats
      const playerData = await playerActions.retrievePlayer(playerAddr);
      if (!playerData.is_registered) {
        throw new Error('Player not registered.');
      }

      const playerStatsData: PlayerStats = {
        totalGamesPlayed: Number(playerData.total_games_played),
        totalGamesWon: Number(playerData.total_games_won),
        balance: Number(playerData.balance),
        ranking: 0, // Will be calculated after leaderboard is built
      };

      // Fetch leaderboard data
      const leaderboardData: LeaderboardEntry[] = [];
      // Ideally, fetch a list of registered players from the contract
      // For now, we'll assume we have a way to get player addresses or use game data
      const lastGameId = await gameActions.lastGame();
      const totalGamesCount = Number(lastGameId) || 0;
      const playerAddresses = new Set<string>();

      // Collect unique player addresses from games
      for (let i = 1; i <= totalGamesCount; i++) {
        try {
          const gameData = await gameActions.getGame(i);
          if (!gameData) continue;
          const gamePlayers = (gameData.game_players || []).map((addr: string) => String(addr).toLowerCase());
          gamePlayers.forEach((addr: string) => playerAddresses.add(addr));
        } catch (err) {
          console.error(`Error fetching game ${i}:`, err);
        }
      }

      // Fetch player data for each address
      await Promise.all(
        Array.from(playerAddresses).map(async (addr) => {
          try {
            const player = await playerActions.retrievePlayer(addr);
            if (player.is_registered) {
              const decodedUsername = shortString.decodeShortString(player.username) || `Player_${addr.slice(0, 6)}`;
              leaderboardData.push({
                username: decodedUsername,
                address: addr,
                totalGamesPlayed: Number(player.total_games_played),
                totalGamesWon: Number(player.total_games_won),
                ranking: 0,
              });
            }
          } catch (err) {
            console.error(`Error fetching player ${addr}:`, err);
          }
        })
      );

      // Sort leaderboard by totalGamesWon, then totalGamesPlayed
      leaderboardData.sort((a, b) => b.totalGamesWon - a.totalGamesWon || b.totalGamesPlayed - a.totalGamesPlayed);
      leaderboardData.forEach((entry, index) => {
        entry.ranking = index + 1;
        if (entry.address === playerAddr) {
          playerStatsData.ranking = index + 1;
        }
      });

      setPlayerStats(playerStatsData);
      setLeaderboard(leaderboardData.slice(0, 5));
    } catch (err: any) {
      setError(err.message || 'Failed to load game stats.');
      console.error('Error in fetchStats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGameIdQuery = async () => {
    if (!gameIdQuery || isNaN(Number(gameIdQuery))) {
      setError('Please enter a valid Game ID.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const gameId = Number(gameIdQuery);
      const gameData = await gameActions.getGame(gameId);
      if (!gameData) {
        setError('Game not found.');
        setGameDetails(null);
        setLoading(false);
        return;
      }

      const statusVariant = gameData.status?.variant;
      const status = statusVariant
        ? 'Ended' in statusVariant
          ? 'Ended'
          : 'Ongoing' in statusVariant
          ? 'Ongoing'
          : 'Unknown'
        : 'Unknown';

      const gamePlayers = (gameData.game_players || []).map((addr: string) => String(addr).toLowerCase());
      const players = await Promise.all(
        gamePlayers.map(async (addr: string) => {
          const playerData = await playerActions.retrievePlayer(addr);
          const decodedUsername = shortString.decodeShortString(playerData.username) || `Player_${addr.slice(0, 6)}`;
          const gamePlayerData = await gameActions.getPlayer(addr, gameId);
          return {
            address: addr,
            username: decodedUsername,
            balance: Number(gamePlayerData.balance || 0),
          };
        })
      );

      const winnerAddress = gameData.winner && gameData.winner !== '0' ? String(gameData.winner).toLowerCase() : null;
      const winnerUsername =
        winnerAddress && players.find((p) => p.address === winnerAddress)?.username || 'No winner';

      const createdByAddress = String(gameData.created_by).toLowerCase();
      let createdByUsername = 'Unknown Creator';
      if (createdByAddress && createdByAddress !== '0') {
        try {
          const playerData = await playerActions.retrievePlayer(createdByAddress);
          createdByUsername = shortString.decodeShortString(playerData.username) || `Player_${createdByAddress.slice(0, 6)}`;
        } catch (err) {
          console.error('Error fetching createdBy username:', err);
        }
      }

      const duration = 3600; // Placeholder

      setGameDetails({
        id: gameId,
        winner: winnerAddress,
        winnerUsername,
        createdBy: createdByAddress,
        createdByUsername,
        status,
        players,
        duration,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch game details.');
      setGameDetails(null);
      console.error('Error in handleGameIdQuery:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white relative overflow-x-hidden p-4">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/heroBg.png"
          alt="Cyberpunk Background"
          className="w-full h-full object-cover opacity-20"
          width={1920}
          height={1080}
          priority
          quality={100}
          onError={() => console.error('Failed to load background image')}
        />
      </div>

      {/* Content */}
      <main className="relative z-10 w-full max-w-[1000px] mx-auto flex flex-col items-center gap-8 py-8">
        <h1 className="font-orbitron text-4xl md:text-6xl lg:text-7xl font-bold text-cyan-300 uppercase tracking-tight text-center animate-pulse-slow">
          Game Stats
        </h1>
        <p className="font-orbitron text-lg md:text-xl text-cyan-200 font-semibold text-center">
          Welcome back, {playerUsername}{playerStats.ranking ? ` (Rank #${playerStats.ranking})` : ''}!
        </p>

        {loading ? (
          <div className="flex items-center justify-center">
            <p className="font-orbitron text-cyan-300 text-lg animate-pulse">Loading stats...</p>
          </div>
        ) : error ? (
          <div className="text-red-400 text-center font-dmSans">{error}</div>
        ) : (
          <div className="w-full flex flex-col gap-6">
            {/* Player Stats Card */}
            <div className="bg-[#0E1415]/80 rounded-xl border border-cyan-900/50 p-6 shadow-lg shadow-cyan-500/20 animate-pop-in">
              <h2 className="font-orbitron text-2xl md:text-3xl text-cyan-300 font-bold mb-4">
                Your Stats
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-cyan-300" />
                  <p className="font-dmSans text-base text-gray-200">
                    Wins: <span className="font-bold text-cyan-200">{playerStats.totalGamesWon}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <BarChart2 className="w-6 h-6 text-cyan-300" />
                  <p className="font-dmSans text-base text-gray-200">
                    Total Games: <span className="font-bold text-cyan-200">{playerStats.totalGamesPlayed}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Wallet className="w-6 h-6 text-cyan-300" />
                  <p className="font-dmSans text-base text-gray-200">
                    Balance: <span className="font-bold text-cyan-200">{playerStats.balance}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-cyan-300" />
                  <p className="font-dmSans text-base text-gray-200">
                    Ranking: <span className="font-bold text-cyan-200">#{playerStats.ranking || 'Unranked'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-[#0E1415]/80 rounded-xl border border-cyan-900/50 p-6 shadow-lg shadow-cyan-500/20 animate-pop-in">
              <h2 className="font-orbitron text-2xl md:text-3xl text-cyan-300 font-bold mb-4">
                Leaderboard
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-gray-200 font-dmSans text-sm">
                  <thead>
                    <tr className="border-b border-cyan-900/50">
                      <th className="py-3 px-4 text-left text-cyan-300">Rank</th>
                      <th className="py-3 px-4 text-left text-cyan-300">Player</th>
                      <th className="py-3 px-4 text-left text-cyan-300">Total Games</th>
                      <th className="py-3 px-4 text-left text-cyan-300">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr
                        key={index}
                        className={`border-b border-cyan-900/50 ${
                          entry.address === String(address).toLowerCase() ? 'bg-cyan-500/10' : ''
                        } hover:bg-cyan-500/20 transition-colors duration-200`}
                      >
                        <td className="py-3 px-4">#{entry.ranking}</td>
                        <td className="py-3 px-4">{entry.username}</td>
                        <td className="py-3 px-4">{entry.totalGamesPlayed}</td>
                        <td className="py-3 px-4">{entry.totalGamesWon}</td>
                      </tr>
                    ))}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-3 px-4 text-center text-gray-500">
                          No leaderboard data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Specific Game Stats Query */}
            <div className="bg-[#0E1415]/80 rounded-xl border border-cyan-900/50 p-6 shadow-lg shadow-cyan-500/20 animate-pop-in">
              <h2 className="font-orbitron text-2xl md:text-3xl text-cyan-300 font-bold mb-4">
                Specific Game Stats
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={gameIdQuery}
                  onChange={(e) => setGameIdQuery(e.target.value)}
                  placeholder="Enter Game ID"
                  className="flex-1 h-10 bg-[#0E1415] rounded-lg border border-cyan-900/50 outline-none px-4 text-cyan-300 font-dmSans text-sm placeholder:text-gray-500"
                  aria-label="Enter Game ID to query stats"
                />
                <button
                  onClick={handleGameIdQuery}
                  className="relative group w-32 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg text-sm font-dmSans font-medium hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200"
                  aria-label="Query game stats by ID"
                >
                  Query Game
                </button>
              </div>
              {gameDetails && (
                <div className="bg-cyan-900/20 rounded-lg p-4">
                  <h3 className="font-orbitron text-lg text-cyan-200 font-semibold mb-2">
                    Game #{gameDetails.id}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <p className="font-dmSans text-sm text-gray-200">
                      Status: <span className="font-bold text-cyan-300">{gameDetails.status}</span>
                    </p>
                    <p className="font-dmSans text-sm text-gray-200">
                      Winner: <span className="font-bold text-cyan-300">{gameDetails.winnerUsername}</span>
                    </p>
                    <p className="font-dmSans text-sm text-gray-200">
                      Created By: <span className="font-bold text-cyan-300">{gameDetails.createdByUsername}</span>
                    </p>
                    <p className="font-dmSans text-sm text-gray-200">
                      Duration: <span className="font-bold text-cyan-300">{Math.floor(gameDetails.duration / 60)} mins</span>
                    </p>
                  </div>
                  <h4 className="font-orbitron text-base text-cyan-200 font-semibold mt-4 mb-2">Players</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-gray-200 font-dmSans text-sm">
                      <thead>
                        <tr className="border-b border-cyan-900/50">
                          <th className="py-2 px-3 text-left text-cyan-300">Player</th>
                          <th className="py-2 px-3 text-left text-cyan-300">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameDetails.players.map((player, index) => (
                          <tr key={index} className="border-b border-cyan-900/50">
                            <td className="py-2 px-3">{player.username}</td>
                            <td className="py-2 px-3">{player.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back to Home Button */}
        <button
          onClick={() => router.push('/')}
          className="relative group w-48 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg text-base font-dmSans font-semibold hover:from-yellow-600 hover:to-orange-600 transform hover:scale-110 transition-all duration-300 animate-pulse-slow"
          aria-label="Return to home page"
        >
          Back to Home
        </button>
      </main>

      <style jsx>{`
        @keyframes pop-in {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          80% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pulse-slow {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 240, 255, 0.7);
          }
          70% {
            transform: scale(1.05);
            box-shadow: 0 0 10px 5px rgba(0, 240, 255, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 240, 255, 0);
          }
        }
        .animate-pop-in {
          animation: pop-in 0.5s ease-out;
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s infinite;
        }
      `}</style>
    </section>
  );
};

export default GameStats;