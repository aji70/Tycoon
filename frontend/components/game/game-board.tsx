'use client';

import React, { useState, useEffect, Component, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { useGameActions } from '@/hooks/useGameActions';
import { usePlayerActions } from '@/hooks/usePlayerActions';
import { useMovementActions } from '@/hooks/useMovementActions';
import { usePropertyActions } from '@/hooks/usePropertyActions';
import { BoardSquare } from '@/types/game';
import PropertyCard from './property-card';
import SpecialCard from './special-card';
import CornerCard from './corner-card';
import { boardData } from '@/data/board-data';
import { PLAYER_TOKENS, CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '@/constants/constants';
import { shortString } from 'starknet';

interface Player {
  id: number;
  address: string;
  username: string;
  position: number;
  balance: number;
  jailed: boolean;
  properties_owned: number[];
  isNext: boolean;
  token: string;
}

interface Game {
  id: number;
  currentPlayer: string;
  nextPlayer: string;
  createdBy: string;
}

interface Property {
  id: number;
  name: string;
  type: string;
  owner: string | null;
  ownerUsername: string | null;
  rent_site_only: number;
}

interface OwnedProperty {
  owner: string;
  ownerUsername: string;
  token: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-red-400 text-center">Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

/**
 * Dojo GameBoard component aligned with Solidity version
 * - Focuses on board UI and core contract logic (roll dice, pay rent, end turn, draw/process cards, pay jail fine, end/leave game)
 * - Removes player info, current game, current property, trade, and chat functionality (handled by Player component)
 * - Retains Starknet integration with useGameActions, usePlayerActions, useMovementActions, usePropertyActions
 * - Uses gameId query parameter and automatic game status polling
 * - Includes commented Solidity backend logic for reference
 * - Maintains accessibility with ARIA labels and mobile-responsive design
 */

const GameBoard = () => {
  const { account, address } = useAccount();
  const gameActions = useGameActions();
  const playerActions = usePlayerActions();
  const movementActions = useMovementActions();
  const propertyActions = usePropertyActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerTokens, setPlayerTokens] = useState<{ [address: string]: string }>({});
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [lastRoll, setLastRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [ownedProperties, setOwnedProperties] = useState<{ [key: number]: OwnedProperty }>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<'Chance' | 'CommunityChest' | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [showRentInput, setShowRentInput] = useState(false);

  useEffect(() => {
    const id = searchParams.get('gameId') || localStorage.getItem('gameId');
    if (id) {
      const numId = Number(id);
      if (!isNaN(numId)) {
        setGameId(numId);
        localStorage.setItem('gameId', id);
      } else {
        setError('Invalid Game ID provided.');
        router.push('/join-room');
      }
    } else {
      setError('No Game ID provided. Please join a game.');
      router.push('/join-room');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (address && gameId !== null) {
      loadGameData(address, gameId);
    }
  }, [address, gameId]);

  // Commented Solidity backend logic
  /*
  useEffect(() => {
    const id = searchParams.get('gameCode') || localStorage.getItem('gameCode') || 'TZIYLR';
    setGameId(id);
    setGame({
      id: id,
      currentPlayer: players[0].username,
      nextPlayer: players[1].username,
      createdBy: 'player1',
    });
    localStorage.setItem('gameCode', id);
  }, [searchParams, players]);

  const updateCurrentPropertySolidity = () => {
    const currentPlayer = players[currentPlayerIndex];
    const square = boardData.find((s) => s.id === currentPlayer.position);
    if (square) {
      setCurrentProperty({
        id: square.id,
        name: square.name || 'Unknown',
        type: square.type,
        owner: ownedProperties[square.id]?.owner || null,
        ownerUsername: ownedProperties[square.id]?.ownerUsername || null,
        rent_site_only: square.rent_site_only || 0,
      });
    } else {
      setCurrentProperty(null);
    }
  };
  */

  

  const waitForGameStatus = async (gid: number, maxAttempts: number = 5, delay: number = 2000) => {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const gameData = await gameActions.getGame(gid);
        if (!gameData) {
          throw new Error('Game data not found.');
        }
        const isOngoing =
          (gameData.status && 'variant' in gameData.status && gameData.status.variant.Ongoing !== undefined) ||
          gameData.is_initialised === true ||
          (typeof gameData.status === 'number' && gameData.status === 1);
        if (isOngoing) {
          return gameData;
        }
        console.log(`Game ${gid} not yet ongoing, attempt ${attempts + 1}/${maxAttempts}`);
      } catch (err: any) {
        console.warn(`Error checking game status, attempt ${attempts + 1}:`, err.message);
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error('Game is not ongoing after multiple attempts. Please verify the game ID or try again later.');
  };

  const loadGameData = async (playerAddress: string, gid: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const gameData = await waitForGameStatus(gid);
      const currentPlayerAddress = await movementActions.getCurrentPlayer(gid);
      console.log('loadGameData:', { playerAddress, currentPlayerAddress, gameData });

      const tokenFields = {
        hat: gameData.player_hat,
        car: gameData.player_car,
        dog: gameData.player_dog,
        thimble: gameData.player_thimble,
        iron: gameData.player_iron,
        battleship: gameData.player_battleship,
        boot: gameData.player_boot,
        wheelbarrow: gameData.player_wheelbarrow,
      };

      const assignedTokens: string[] = [];
      const playerTokensMap: { [address: string]: string } = {};
      const processedAddresses = new Set<string>();

      const gamePlayers = await Promise.all(
        (gameData.game_players || []).filter((addr: string) => {
          const addrString = String(addr).toLowerCase();
          if (processedAddresses.has(addrString)) return false;
          processedAddresses.add(addrString);
          return true;
        }).map(async (addr: string, index: number) => {
          const playerData = await gameActions.getPlayer(addr, gid);
          const addrString = String(addr).toLowerCase();
          const username = await playerActions.getUsernameFromAddress(addrString);
          const decodedUsername = shortString.decodeShortString(username) || `Player ${index + 1}`;

          const tokenKey = Object.keys(tokenFields).find(
            (key) => String(tokenFields[key as keyof typeof tokenFields]).toLowerCase() === addrString
          );
          let token = tokenKey
            ? PLAYER_TOKENS[Object.keys(tokenFields).indexOf(tokenKey)]
            : PLAYER_TOKENS.find((t) => !assignedTokens.includes(t)) || '';

          if (assignedTokens.includes(token)) {
            token = PLAYER_TOKENS.find((t) => !assignedTokens.includes(t)) || '';
          }
          assignedTokens.push(token);
          playerTokensMap[addrString] = token;

          return {
            id: index,
            address: addrString,
            username: decodedUsername,
            position: Number(playerData.position || 0),
            balance: Number(playerData.balance || 0),
            jailed: Boolean(playerData.jailed),
            properties_owned: playerData.properties_owned || [],
            isNext: String(addr).toLowerCase() === String(currentPlayerAddress).toLowerCase(),
            token,
          };
        })
      );

      const propertyPromises = boardData
        .filter((square) => square.type === 'property')
        .map((square) => propertyActions.getProperty(square.id, gid));
      const propertyDataArray = await Promise.all(propertyPromises);

      const propertyOwners = new Set<string>();
      propertyDataArray.forEach((propertyData) => {
        if (propertyData.owner && propertyData.owner !== '0') {
          propertyOwners.add(String(propertyData.owner).toLowerCase());
        }
      });

      const additionalPlayers = await Promise.all(
        [...propertyOwners]
          .filter((addr) => !processedAddresses.has(addr))
          .map(async (addr, index) => {
            processedAddresses.add(addr);
            const playerData = await gameActions.getPlayer(addr, gid);
            const username = await playerActions.getUsernameFromAddress(addr);
            const decodedUsername = shortString.decodeShortString(username) || `Player ${gamePlayers.length + index + 1}`;
            let token = PLAYER_TOKENS.find((t) => !assignedTokens.includes(t)) || '';
            assignedTokens.push(token);
            playerTokensMap[addr] = token;

            return {
              id: gamePlayers.length + index,
              address: addr,
              username: decodedUsername,
              position: Number(playerData.position || 0),
              balance: Number(playerData.balance || 0),
              jailed: Boolean(playerData.jailed),
              properties_owned: playerData.properties_owned || [],
              isNext: addr === String(currentPlayerAddress).toLowerCase(),
              token,
            };
          })
      );

      const allPlayers = [...gamePlayers, ...additionalPlayers];
      setPlayers(allPlayers);
      setPlayerTokens(playerTokensMap);

      const currentPlayerIdx = allPlayers.findIndex((p) => p.address === String(currentPlayerAddress).toLowerCase());
      if (currentPlayerIdx !== -1) {
        setCurrentPlayerIndex(currentPlayerIdx);
      }

      setGame({
        id: Number(gameData.id || gid),
        currentPlayer: allPlayers.find((p) => p.isNext)?.username || 'Unknown',
        nextPlayer: gameData.next_player && gameData.next_player !== '0'
          ? shortString.decodeShortString(await playerActions.getUsernameFromAddress(String(gameData.next_player).toLowerCase())) || 'Unknown'
          : 'Unknown',
        createdBy: String(gameData.created_by).toLowerCase(),
      });

      const ownershipMap: { [key: number]: OwnedProperty } = {};
      propertyDataArray.forEach((propertyData, index) => {
        const square = boardData.filter((s) => s.type === 'property')[index];
        if (propertyData.owner && propertyData.owner !== '0') {
          const ownerAddress = String(propertyData.owner).toLowerCase();
          const ownerPlayer = allPlayers.find((p) => p.address === ownerAddress);
          ownershipMap[square.id] = {
            owner: ownerAddress,
            ownerUsername: ownerPlayer?.username || 'Unknown',
            token: ownerPlayer?.token || '',
          };
        }
      });
      setOwnedProperties(ownershipMap);
    } catch (err: any) {
      console.error('Failed to load game data:', err);
      setError(err.message || 'Failed to load game data. Please try again or check the game ID.');
    } finally {
      setIsLoading(false);
    }
  };

  const rollDice = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const roll = die1 + die2;
      setLastRoll({ die1, die2, total: roll });
      await movementActions.movePlayer(account, gameId, roll);
      if (address && gameId !== null) {
        await loadGameData(address, gameId);
      }
    } catch (err: any) {
      console.error('rollDice Error:', err);
      setError(err.message || 'Error rolling dice. It may not be your turn.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrawCard = async (type: 'Chance' | 'CommunityChest') => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const cardList = type === 'Chance' ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS;
      const randomCard = cardList[Math.floor(Math.random() * cardList.length)];
      setSelectedCard(randomCard);
      setSelectedCardType(type);
    } catch (err: any) {
      console.error(`Draw ${type} Card Error:`, err);
      setError(err.message || `Error drawing ${type} card.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessCard = async () => {
    if (!account || !gameId || !selectedCard) {
      setError('Please connect your account, provide a valid Game ID, or draw a card to process.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const action = selectedCardType === 'CommunityChest'
        ? () => movementActions.processCommunityChestCard(account, gameId, selectedCard)
        : () => movementActions.processChanceCard(account, gameId, selectedCard);
      await action();
      setSelectedCard(null);
      setSelectedCardType(null);
      if (address && gameId !== null) {
        await loadGameData(address, gameId);
      }
    } catch (err: any) {
      console.error(`Process ${selectedCardType} Card Error:`, err);
      setError(err.message || `Error processing ${selectedCardType} card.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayRent = async () => {
    if (!account || !gameId || !propertyId) {
      setError('Please connect your account, provide a valid Game ID, or enter a property ID.');
      return;
    }
    const square = boardData.find((s) => s.id === Number(propertyId));
    if (!square || square.type !== 'property' || !ownedProperties[Number(propertyId)]?.owner) {
      setError('Cannot pay rent: Invalid property or no owner.');
      setShowRentInput(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await propertyActions.payRent(account, Number(propertyId), gameId);
      setPropertyId('');
      setShowRentInput(false);
      if (address && gameId !== null) {
        await loadGameData(address, gameId);
      }
    } catch (err: any) {
      console.error('Pay Rent Error:', err);
      setError(err.message || 'Error paying rent.');
      setShowRentInput(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRent = () => {
    setPropertyId('');
    setShowRentInput(false);
  };

  const handlePayJailFine = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await movementActions.payJailFine(account, gameId);
      if (address && gameId !== null) {
        await loadGameData(address, gameId);
      }
    } catch (err: any) {
      console.error('Pay Jail Fine Error:', err);
      setError(err.message || 'Error paying jail fine.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndTurn = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    if (selectedCard) {
      setError('You must process the drawn card before ending your turn.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await propertyActions.finishTurn(account, gameId);
      if (address && gameId !== null) {
        await loadGameData(address, gameId);
      }
    } catch (err: any) {
      console.error('End Turn Error:', err);
      setError(err.message || 'Error ending turn.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndGame = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await gameActions.endGame(account, gameId);
      setGameId(null);
      setPlayers([]);
      setGame(null);
      setOwnedProperties({});
      setSelectedCard(null);
      setSelectedCardType(null);
      setLastRoll(null);
      localStorage.removeItem('gameId');
      router.push('/');
    } catch (err: any) {
      console.error('End Game Error:', err);
      setError(err.message || 'Error ending game.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await gameActions.leaveGame(account, gameId);
      setGameId(null);
      setPlayers([]);
      setGame(null);
      setOwnedProperties({});
      setSelectedCard(null);
      setSelectedCardType(null);
      setLastRoll(null);
      localStorage.removeItem('gameId');
      router.push('/');
    } catch (err: any) {
      console.error('Leave Game Error:', err);
      setError(err.message || 'Error leaving game.');
    } finally {
      setIsLoading(false);
    }
  };

  const getGridPosition = (square: BoardSquare) => ({
    gridRowStart: square.gridPosition.row,
    gridColumnStart: square.gridPosition.col,
  });

  const isTopHalf = (square: BoardSquare) => {
    return square.gridPosition.row === 1;
  };

  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        {/* Rotate Prompt for Mobile Portrait */}
        <div className="rotate-prompt hidden fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 text-center text-white p-4">
          <p className="text-lg font-semibold">Please rotate your device to landscape mode for the best experience.</p>
        </div>

        {/* Board Section */}
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4">
                  Blockopoly
                </h1>
                <div
                  className="p-4 rounded-lg w-full max-w-sm bg-cover bg-center"
                  style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                  }}
                >
                  <h2 className="text-base font-semibold text-cyan-300 mb-3">Game Actions</h2>
                  {isLoading && (
                    <p className="text-cyan-300 text-sm text-center mb-2">Loading...</p>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={rollDice}
                      aria-label="Roll the dice to move your player"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200"
                    >
                      Roll Dice
                    </button>
                    {lastRoll && (
                      <p className="text-gray-300 text-sm text-center">
                        Rolled: <span className="font-bold text-white">{lastRoll.die1} + {lastRoll.die2} = {lastRoll.total}</span>
                      </p>
                    )}
                    {showRentInput && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="number"
                          placeholder="Property ID for Rent"
                          value={propertyId}
                          onChange={(e) => setPropertyId(e.target.value)}
                          className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          aria-label="Enter property ID for rent"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handlePayRent}
                            aria-label="Confirm rent payment"
                            className="px-2 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs rounded-full hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
                          >
                            Confirm Rent
                          </button>
                          <button
                            onClick={handleCancelRent}
                            aria-label="Cancel rent payment"
                            className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => setShowRentInput(true)}
                        aria-label="Pay rent for the property"
                        className="px-2 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs rounded-full hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Rent
                      </button>
                      <button
                        onClick={handleEndTurn}
                        aria-label="End your turn"
                        className="px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200"
                      >
                        End Turn
                      </button>
                      <button
                        onClick={handlePayJailFine}
                        aria-label="Pay jail fine"
                        className="px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs rounded-full hover:from-pink-600 hover:to-rose-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Jail Fine
                      </button>
                      <button
                        onClick={() => handleDrawCard('Chance')}
                        aria-label="Draw a Chance card"
                        className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-lime-500 text-white text-xs rounded-full hover:from-yellow-600 hover:to-lime-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Draw Chance
                      </button>
                      <button
                        onClick={() => handleDrawCard('CommunityChest')}
                        aria-label="Draw a Community Chest card"
                        className="px-2 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs rounded-full hover:from-teal-600 hover:to-cyan-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Draw CChest
                      </button>
                      <button
                        onClick={handleEndGame}
                        aria-label="End the game"
                        className="px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full hover:from-red-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200"
                      >
                        End Game
                      </button>
                      <button
                        onClick={handleLeaveGame}
                        aria-label="Leave the game"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                      >
                        Leave Game
                      </button>
                    </div>
                    {error && (
                      <p className="text-red-400 text-sm mt-2 text-center">{error}</p>
                    )}
                  </div>
                </div>
                {selectedCard && (
                  <div
                    className="mt-4 p-3 rounded-lg w-full max-w-sm bg-cover bg-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h3 className="text-base font-semibold text-cyan-300 mb-2">
                      {selectedCardType === 'CommunityChest' ? 'Community Chest' : 'Chance'} Card
                    </h3>
                    <p className="text-sm text-gray-300">{selectedCard}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleProcessCard}
                        aria-label="Process the drawn card"
                        className="px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs rounded-full hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200"
                        disabled={!selectedCardType}
                      >
                        Process
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCard(null);
                          setSelectedCardType(null);
                        }}
                        aria-label="Close card"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {boardData.map((square, index) => (
                <div
                  key={square.id}
                  style={getGridPosition(square)}
                  className="w-full h-full p-[2px] relative box-border group hover:z-10 transition-transform duration-200"
                >
                  <div
                    className={`w-full h-full transform group-hover:scale-200 ${
                      isTopHalf(square) ? 'origin-top group-hover:origin-bottom group-hover:translate-y-[100px]' : ''
                    } group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200`}
                  >
                    {square.type === 'property' && (
                      <PropertyCard
                        square={square}
                        owner={ownedProperties[square.id]?.owner || null}
                        ownerUsername={ownedProperties[square.id]?.ownerUsername || null}
                        isConnectedPlayer={ownedProperties[square.id]?.owner === String(address).toLowerCase()}
                      />
                    )}
                    {square.type === 'special' && <SpecialCard square={square} />}
                    {square.type === 'corner' && <CornerCard square={square} />}
                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1 z-10">
                      {players
                        .filter((p) => p.position === index)
                        .map((p) => (
                          <span
                            key={p.id}
                            className={`text-lg md:text-2xl ${p.isNext ? 'border-2 border-cyan-300 rounded' : ''}`}
                          >
                            {p.token || playerTokens[p.address] || ''}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default GameBoard;