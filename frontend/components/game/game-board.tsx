'use client';

import React, { useState, useEffect, Component, ReactNode, useRef } from 'react';
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

const TOKEN_EMOJIS: { [key: string]: string } = {
  hat: '🧢',
  car: '🚗',
  dog: '🐕',
  thimble: '📌',
  iron: '🔧',
  battleship: '🚢',
  boot: '👢',
  wheelbarrow: '🛒',
};

const TokenIcon: React.FC<{ token: string }> = ({ token }) => (
  <span className="text-lg">{TOKEN_EMOJIS[token.toLowerCase()] || token}</span>
);

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
  const [currentProperty, setCurrentProperty] = useState<Property | null>(null);
  const [hasRolled, setHasRolled] = useState(false);
  const [previousCurrentPlayer, setPreviousCurrentPlayer] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const isFetchingRef = useRef(false);

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
      loadGameData(gameId);
    }
  }, [address, gameId]);

  // Polling for game updates during ongoing game
  useEffect(() => {
    if (!address || gameId === null) return;

    const pollInterval = setInterval(async () => {
      try {
        await loadGameData(gameId);
      } catch (err) {
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [address, gameId]);

  // Reset hasRolled when current player changes (new turn)
  useEffect(() => {
    const current = currentPlayer()?.address;
    if (previousCurrentPlayer && previousCurrentPlayer !== current) {
      setHasRolled(false);
    }
    setPreviousCurrentPlayer(current ?? null);
  }, [players]);

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
      } catch (err: any) {
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error('Game is not ongoing after multiple attempts. Please verify the game ID or try again later.');
  };

  const getPlayerToken = (playerData: any): string => {
    if (!playerData.player_symbol || !playerData.player_symbol.variant) return '';
    const symbolVariant = Object.keys(playerData.player_symbol.variant).find(
      (key) => playerData.player_symbol.variant[key] !== undefined
    );
    return symbolVariant ? symbolVariant.toLowerCase() : '';
  };

  const loadGameData = async (gid: number, skipDetection = false) => {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    setIsLoading(true);
    setError(null);
    try {
      const gameData = await waitForGameStatus(gid);
      const currentPlayerAddress = await movementActions.getCurrentPlayer(gid);

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

          let token = getPlayerToken(playerData)
          if (!token || assignedTokens.includes(token)) {
            token = PLAYER_TOKENS.find((t) => !assignedTokens.includes(t)) || '';
          }
          if (token) assignedTokens.push(token);
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
            let token = getPlayerToken(playerData)
            if (!token || assignedTokens.includes(token)) {
              token = PLAYER_TOKENS.find((t) => !assignedTokens.includes(t)) || '';
            }
            if (token) assignedTokens.push(token);
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

      // Detect changes if already loaded and not skipping detection
      if (hasLoaded && !skipDetection) {
        // Previous players map by address
        const prevPlayersMap = new Map(players.map(p => [p.address, p]));
        // Previous owned map
        const prevOwnedMap = new Map(Object.entries(ownedProperties).map(([id, prop]) => [id, prop]));

        // Detect turn changes
        allPlayers.forEach(newP => {
          const prevP = prevPlayersMap.get(newP.address);
          if (prevP && prevP.isNext !== newP.isNext) {
            if (!prevP.isNext && newP.isNext) {
              if (newP.address !== String(address).toLowerCase()) {
                addActionLog(`It's ${newP.username}'s turn`);
              }
            }
          }
        });

        // Detect moves and payments per player
        allPlayers.forEach(newP => {
          const prevP = prevPlayersMap.get(newP.address);
          if (prevP) {
            let logMessage = '';
            const moved = prevP.position !== newP.position;
            const paid = prevP.balance > newP.balance;
            let paidAmount = 0;
            let rentDue = 0;
            let isTax = false;
            let taxAmount = 0;
            let isOwnProperty = false;
            let ownerU = '';
            let posName = '';

            if (moved) {
              const square = boardData.find(s => s.id === newP.position);
              posName = square?.name || newP.position.toString();
              logMessage = `${newP.username} moved to ${posName}`;
              if (square?.type === 'property') {
                const ownerAddr = ownershipMap[newP.position]?.owner;
                if (ownerAddr) {
                  if (ownerAddr === newP.address) {
                    isOwnProperty = true;
                    logMessage += ' (own property)';
                  } else {
                    const ownerPlayer = allPlayers.find(p => p.address === ownerAddr);
                    ownerU = ownerPlayer?.username || 'Unknown';
                    rentDue = Number(square.rent_site_only || 0);
                    logMessage += `, owned by ${ownerU}`;
                  }
                }
              } else if (['Income Tax', 'Luxury Tax'].includes(square?.name || '')) {
                isTax = true;
                taxAmount = square ? Number(square.rent_site_only || 0) : 0;
                logMessage += `. Tax: $${taxAmount}`;
              }
            }

            if (paid) {
              paidAmount = prevP.balance - newP.balance;
              if (moved) {
                if (rentDue > 0 && paidAmount === rentDue) {
                  logMessage += ` and paid $${paidAmount} rent to ${ownerU}`;
                } else if (isTax && paidAmount === taxAmount) {
                  logMessage += ` (paid)`;
                }
              } else if (!newP.jailed && prevP.jailed && paidAmount === 50) {
                logMessage = `${newP.username} paid $50 jail fine`;
              } else {
                logMessage = `${newP.username} paid $${paidAmount}`;
              }
            }

            if (logMessage && newP.address !== String(address).toLowerCase()) {
              addActionLog(logMessage);
            }
          }
        });

        // Detect buys
        Object.entries(ownershipMap).forEach(([propIdStr, newProp]) => {
          const propId = Number(propIdStr);
          const prevProp = prevOwnedMap.get(propIdStr);
          if (!prevProp && newProp && newProp.owner !== String(address).toLowerCase()) {
            const square = boardData.find(s => s.id === propId);
            const price = square?.price || 0;
            addActionLog(`${newProp.ownerUsername} bought ${square?.name || propId} for $${price}`);
          }
        });
      }

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

      setOwnedProperties(ownershipMap);

      // Set current property based on current player's position
      const currentPlayer = allPlayers.find(p => p.isNext);
      if (currentPlayer) {
        const square = boardData.find(s => s.id === currentPlayer.position);
        if (square) {
          let decodedName = square.name || 'Unknown';
          if (square.type === 'property') {
            const propIndex = boardData.filter(s => s.type === 'property').findIndex(s => s.id === square.id);
            if (propIndex !== -1) {
              const propData = propertyDataArray[propIndex];
              if (propData.name && propData.name !== '0') {
                decodedName = shortString.decodeShortString(propData.name);
              }
            }
          }
          setCurrentProperty({
            id: square.id,
            name: decodedName,
            type: square.type,
            owner: ownershipMap[square.id]?.owner || null,
            ownerUsername: ownershipMap[square.id]?.ownerUsername || null,
            rent_site_only: square.rent_site_only || 0,
          });
        } else {
          setCurrentProperty(null);
        }
      } else {
        setCurrentProperty(null);
      }

      setHasLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load game data. Please try again or check the game ID.');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  const currentPlayer = () => players.find(p => p.isNext);
  const isUsersTurn = () => address && currentPlayer()?.address === String(address).toLowerCase();

  const addActionLog = (message: string) => {
    setActionLog(prev => {
      // Check last 3 entries to prevent recent duplicates
      if (prev.slice(-3).includes(message)) {
        return prev;
      }
      if (prev.length > 0 && prev[prev.length - 1] === message) {
        return prev;
      }
      return [...prev, message].slice(-20);
    });
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
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} rolled ${die1} + ${die2} = ${roll}`);
      await loadGameData(gameId, true);
      // Log landing details for current user
      if (currentProperty && currentPlayer()) {
        const currPlayer = currentPlayer();
        if (currentProperty.type === 'property') {
          const ownerAddr = currentProperty.owner;
          if (ownerAddr) {
            if (currPlayer && ownerAddr === currPlayer.address) {
              addActionLog(`Landed on own ${currentProperty.name}`);
            } else if (currPlayer) {
              addActionLog(`Landed on ${currentProperty.name} owned by ${currentProperty.ownerUsername}. Rent due: $${currentProperty.rent_site_only}`);
            }
          } else {
            // Unowned, buy option available
            const square = boardData.find(s => s.id === currentProperty.id);
            const cost = square?.price || 0;
            addActionLog(`Landed on unowned ${currentProperty.name}. Buy for $${cost}`);
          }
        } else if (['Income Tax', 'Luxury Tax'].includes(currentProperty.name)) {
          addActionLog(`Landed on ${currentProperty.name}. Tax due: $${currentProperty.rent_site_only}`);
        }
      }
      setHasRolled(true);
    } catch (err: any) {
      setError(err.message || 'Error rolling dice.');
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
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} drew a ${type === 'Chance' ? 'Chance' : 'Community Chest'} card`);
    } catch (err: any) {
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
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} processed ${selectedCardType} card: "${selectedCard}"`);
      await loadGameData(gameId, true);
      setSelectedCard(null);
      setSelectedCardType(null);
    } catch (err: any) {
      setError(err.message || `Error processing ${selectedCardType} card.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyProperty = async () => {
    if (!account || !gameId || !currentProperty || currentProperty.owner || currentProperty.type !== 'property') {
      setError('Cannot buy: Invalid position or property already owned.');
      return;
    }
    const currentPlayerObj = currentPlayer();
    if (!currentPlayerObj) return;
    try {
      setIsLoading(true);
      setError(null);
      await propertyActions.buyProperty(account, currentPlayerObj.position, gameId);
      const square = boardData.find(s => s.id === currentProperty.id);
      const price = square?.price || 0;
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} bought ${currentProperty.name} for $${price}`);
      await loadGameData(gameId, true);
    } catch (err: any) {
      setError(err.message || 'Error buying property.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayRent = async () => {
    if (!account || !gameId || !currentProperty || !currentProperty.owner || currentProperty.owner === String(address).toLowerCase() || currentProperty.type !== 'property') {
      setError('Cannot pay rent: Invalid property or no owner.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await propertyActions.payRent(account, Number(currentProperty.id), gameId);
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} paid $${currentProperty.rent_site_only} rent to ${currentProperty.ownerUsername}`);
      await loadGameData(gameId, true);
    } catch (err: any) {
      setError(err.message || 'Error paying rent.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayTax = async () => {
    if (!account || !gameId || !currentProperty || !['Income Tax', 'Luxury Tax'].includes(currentProperty.name)) {
      setError('Invalid tax square or position.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await movementActions.payTax(account, currentProperty.id, gameId);
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} paid $${currentProperty.rent_site_only} tax`);
      await loadGameData(gameId, true);
    } catch (err: any) {
      setError(err.message || 'Error paying tax.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayJailFine = async () => {
    if (!account || !gameId || !currentPlayer()?.jailed) {
      setError('Please connect your account and provide a valid Game ID. You are not in jail.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await movementActions.payJailFine(account, gameId);
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} paid $50 jail fine`);
      await loadGameData(gameId, true);
      setHasRolled(true);
    } catch (err: any) {
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
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} ended their turn`);
      await loadGameData(gameId, true);
    } catch (err: any) {
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
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} ended the game`);
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
      const username = currentPlayer()?.username || 'You';
      addActionLog(`${username} left the game`);
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
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={rollDice}
                      aria-label="Roll the dice to move your player"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200"
                    >
                      Roll Dice
                    </button>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={handlePayRent}
                        aria-label="Pay rent for the property"
                        className="px-2 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs rounded-full hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Rent
                      </button>
                      <button
                        onClick={handleBuyProperty}
                        aria-label="Buy the current property"
                        className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Buy Property
                      </button>
                      {(currentProperty?.name === 'Income Tax' || currentProperty?.name === 'Luxury Tax') && (
                        <button
                          onClick={handlePayTax}
                          aria-label="Pay tax"
                          className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-xs rounded-full hover:from-yellow-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
                        >
                          Pay Tax
                        </button>
                      )}
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
                <div className="mt-4 p-2 bg-gray-800 rounded max-h-40 overflow-y-auto w-full max-w-sm">
                  <h3 className="text-sm font-semibold text-cyan-300 mb-2">Action Log</h3>
                  {actionLog.slice(-10).reverse().map((log, i) => (
                    <p key={i} className="text-xs text-gray-300 mb-1 last:mb-0">{log}</p>
                  ))}
                  {actionLog.length === 0 && <p className="text-xs text-gray-500 italic">No actions yet</p>}
                </div>
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
                            className={`md:text-2xl ${p.isNext ? 'border-2 border-cyan-300 rounded' : ''}`}
                          >
                            <TokenIcon token={p.token || playerTokens[p.address] || ''} />
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