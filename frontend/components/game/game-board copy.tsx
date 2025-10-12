'use client';
import React, { useState, useEffect, Component, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BoardSquare } from '@/types/game';
import PropertyCard from './property-card';
import SpecialCard from './special-card';
import CornerCard from './corner-card';
import { boardData } from '@/data/board-data';
import { useAccount } from '@starknet-react/core';
import { useGameActions } from '@/hooks/useGameActions';
import { usePlayerActions } from '@/hooks/usePlayerActions';
import { useMovementActions } from '@/hooks/useMovementActions';
import { usePropertyActions } from '@/hooks/usePropertyActions';
import { useTradeActions } from '@/hooks/useTradeActions';
import { shortString } from 'starknet';
import { PLAYER_TOKENS, CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '@/constants/constants';


interface Player {
  id: number;
  address: string;
  name: string;
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
  ownerAddress: string | null;
  rent_site_only: number;
}

interface OwnedProperty {
  owner: string;
  ownerUsername: string;
  token: string;
}

interface TradeInputs {
  to: string;
  offeredPropertyIds: string;
  requestedPropertyIds: string;
  cashOffer: string;
  cashRequest: string;
  tradeType: string;
  tradeId: string;
  originalOfferId: string;
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

const GameBoard = () => {
  const { account, address } = useAccount();
  const gameActions = useGameActions();
  const playerActions = usePlayerActions();
  const movementActions = useMovementActions();
  const propertyActions = usePropertyActions();
  const tradeActions = useTradeActions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerTokens, setPlayerTokens] = useState<{ [address: string]: string }>({});
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [lastRoll, setLastRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [currentProperty, setCurrentProperty] = useState<Property | null>(null);
  const [ownedProperties, setOwnedProperties] = useState<{ [key: number]: OwnedProperty }>({});
  const [inputGameId, setInputGameId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<'Chance' | 'CommunityChest' | null>(null);
  const [modalState, setModalState] = useState({
    property: false,
    turn: false,
    player: false,
    management: false,
    trade: false,
  });
  const [tradeInputs, setTradeInputs] = useState<TradeInputs>({
    to: '',
    offeredPropertyIds: '',
    requestedPropertyIds: '',
    cashOffer: '0',
    cashRequest: '0',
    tradeType: '0',
    tradeId: '',
    originalOfferId: '',
  });
  const [propertyId, setPropertyId] = useState('');

  useEffect(() => {
    const id = searchParams.get('gameId') || localStorage.getItem('gameId');
    if (id) {
      const numId = Number(id);
      if (!isNaN(numId)) {
        setGameId(numId);
        setInputGameId(id);
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
            name: decodedUsername,
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
              name: decodedUsername,
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

      const nextPlayerAddress = gameData.next_player && gameData.next_player !== '0' ? String(gameData.next_player).toLowerCase() : null;
      const nextPlayerUsername = nextPlayerAddress
        ? shortString.decodeShortString(await playerActions.getUsernameFromAddress(nextPlayerAddress)) || 'Unknown'
        : 'Unknown';

      setGame({
        id: Number(gameData.id || gid),
        currentPlayer: allPlayers.find((p) => p.isNext)?.username || 'Unknown',
        nextPlayer: nextPlayerUsername,
        createdBy: String(gameData.created_by).toLowerCase(),
      });

      const playerData = await gameActions.getPlayer(playerAddress, gid);
      const decodedPlayerUsername = shortString.decodeShortString(playerData.username) || 'Unknown';
      const playerToken = playerTokensMap[String(playerAddress).toLowerCase()] || '';

      setPlayer({
        address: String(playerAddress).toLowerCase(),
        username: decodedPlayerUsername,
        name: decodedPlayerUsername,
        balance: Number(playerData.balance || 0),
        position: Number(playerData.position || 0),
        jailed: Boolean(playerData.jailed),
        properties_owned: playerData.properties_owned || [],
        id: allPlayers.find((p) => p.address === String(playerAddress).toLowerCase())?.id || 0,
        isNext: String(playerAddress).toLowerCase() === String(currentPlayerAddress).toLowerCase(),
        token: playerToken,
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
      console.log('ownedProperties:', ownershipMap);

      const position = Number(playerData.position || 0);
      const square = boardData.find((s) => s.id === position);
      if (square) {
        const propertyIndex = boardData.filter((s) => s.type === 'property').findIndex((s) => s.id === square.id);
        const propertyData = propertyIndex !== -1 ? propertyDataArray[propertyIndex] : await propertyActions.getProperty(square.id, gid);
        const decodedPropertyName = propertyData.name && propertyData.name !== '0'
          ? shortString.decodeShortString(propertyData.name)
          : square.name || 'Unknown';
        const ownerAddress = propertyData.owner && propertyData.owner !== '0' ? String(propertyData.owner).toLowerCase() : null;
        const ownerPlayer = ownerAddress ? allPlayers.find((p) => p.address === ownerAddress) : null;

        setCurrentProperty({
          id: Number(propertyData.id || square.id),
          name: decodedPropertyName,
          type: square.type,
          owner: ownerPlayer?.username || null,
          ownerAddress,
          rent_site_only: Number(propertyData.rent_site_only || square.rent_site_only || 0),
        });
      } else {
        setCurrentProperty(null);
      }
      setSelectedCard(null);
      setSelectedCardType(null);
    } catch (err: any) {
      console.error('Failed to load game data:', err);
      setError(err.message || 'Failed to load game data. Please try again or check the game ID.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGameIdSubmit = () => {
    const gid = parseInt(inputGameId);
    if (!isNaN(gid)) {
      setGameId(gid);
      localStorage.setItem('gameId', inputGameId);
      if (address) {
        loadGameData(address, gid);
      } else {
        setError('Please connect your wallet to join the game.');
      }
    } else {
      setError('Please enter a valid Game ID.');
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

  const handleProcessChanceCard = async () => {
    if (!account || !gameId || !selectedCard) {
      setError('Please connect your account, provide a valid Game ID, or draw a Chance card to process.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => movementActions.processChanceCard(account, gameId, selectedCard),
        'processChanceCard'
      );
      setSelectedCard(null);
      setSelectedCardType(null);
    } catch (err: any) {
      console.error('Process Chance Card Error:', err);
      setError(err.message || 'Error processing Chance card. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessCommunityChestCard = async () => {
    if (!account || !gameId || !selectedCard) {
      setError('Please connect your account, provide a valid Game ID, or draw a Community Chest card to process.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => movementActions.processCommunityChestCard(account, gameId, selectedCard),
        'processCommunityChestCard'
      );
      setSelectedCard(null);
      setSelectedCardType(null);
    } catch (err: any) {
      console.error('Process Community Chest Card Error:', err);
      setError(err.message || 'Error processing Community Chest card. Please try again.');
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
      setInputGameId('');
      setPlayers([]);
      setGame(null);
      setPlayer(null);
      setCurrentProperty(null);
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
      setModalState(prev => ({ ...prev, player: false }));
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
      setInputGameId('');
      setPlayers([]);
      setGame(null);
      setPlayer(null);
      setCurrentProperty(null);
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
      setModalState(prev => ({ ...prev, player: false }));
    }
  };

  const handlePayJailFine = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => movementActions.payJailFine(account, gameId),
        'payJailFine'
      );
    } catch (err: any) {
      console.error('Pay Jail Fine Error:', err);
      setError(err.message || 'Error paying jail fine.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, player: false }));
    }
  };

  const handlePayGetoutOfJailChance = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => movementActions.payGetoutOfJailChance(account, gameId),
        'payGetoutOfJailChance'
      );
    } catch (err: any) {
      console.error('Pay Get Out of Jail Chance Error:', err);
      setError(err.message || 'Error using Chance Get Out of Jail card.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, player: false }));
    }
  };

  const handlePayGetoutOfJailCommunity = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => movementActions.payGetoutOfJailCommunity(account, gameId),
        'payGetoutOfJailCommunity'
      );
    } catch (err: any) {
      console.error('Pay Get Out of Jail Community Error:', err);
      setError(err.message || 'Error using Community Chest Get Out of Jail card.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, player: false }));
    }
  };

  const handleBuyHouseOrHotel = async () => {
    if (!account || !gameId || !propertyId) {
      setError('Please connect your account, provide a valid Game ID, or enter a property ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => propertyActions.buyHouseOrHotel(account, Number(propertyId), gameId),
        'buyHouseOrHotel'
      );
      setPropertyId('');
    } catch (err: any) {
      console.error('Buy House or Hotel Error:', err);
      setError(err.message || 'Error buying house or hotel.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, management: false }));
    }
  };

  const handleSellHouseOrHotel = async () => {
    if (!account || !gameId || !propertyId) {
      setError('Please connect your account, provide a valid Game ID, or enter a property ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => propertyActions.sellHouseOrHotel(account, Number(propertyId), gameId),
        'sellHouseOrHotel'
      );
      setPropertyId('');
    } catch (err: any) {
      console.error('Sell House or Hotel Error:', err);
      setError(err.message || 'Error selling house or hotel.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, management: false }));
    }
  };

  const handleMortgageProperty = async () => {
    if (!account || !gameId || !propertyId) {
      setError('Please connect your account, provide a valid Game ID, or enter a property ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => propertyActions.mortgageProperty(account, Number(propertyId), gameId),
        'mortgageProperty'
      );
      setPropertyId('');
    } catch (err: any) {
      console.error('Mortgage Property Error:', err);
      setError(err.message || 'Error mortgaging property.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, management: false }));
    }
  };

  const handleUnmortgageProperty = async () => {
    if (!account || !gameId || !propertyId) {
      setError('Please connect your account, provide a valid Game ID, or enter a property ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => propertyActions.unmortgageProperty(account, Number(propertyId), gameId),
        'unmortgageProperty'
      );
      setPropertyId('');
    } catch (err: any) {
      console.error('Unmortgage Property Error:', err);
      setError(err.message || 'Error unmortgaging property.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, management: false }));
    }
  };

  const handleOfferTrade = async () => {
    if (!account || !gameId || !tradeInputs.to || !tradeInputs.offeredPropertyIds || !tradeInputs.requestedPropertyIds) {
      setError('Please connect your account, provide a valid Game ID, and fill all trade fields.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const offeredIds = tradeInputs.offeredPropertyIds.split(',').map(Number).filter(n => !isNaN(n));
      const requestedIds = tradeInputs.requestedPropertyIds.split(',').map(Number).filter(n => !isNaN(n));
      await handleAction(
        () => tradeActions.offerTrade(
          account,
          gameId,
          tradeInputs.to,
          offeredIds,
          requestedIds,
          Number(tradeInputs.cashOffer),
          Number(tradeInputs.cashRequest),
          Number(tradeInputs.tradeType)
        ),
        'offerTrade'
      );
      setTradeInputs(prev => ({ ...prev, to: '', offeredPropertyIds: '', requestedPropertyIds: '', cashOffer: '0', cashRequest: '0', tradeType: '0' }));
    } catch (err: any) {
      console.error('Offer Trade Error:', err);
      setError(err.message || 'Error offering trade.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, trade: false }));
    }
  };

  const handleAcceptTrade = async () => {
    if (!account || !gameId || !tradeInputs.tradeId) {
      setError('Please connect your account, provide a valid Game ID, and enter a trade ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => tradeActions.acceptTrade(account, Number(tradeInputs.tradeId), gameId),
        'acceptTrade'
      );
      setTradeInputs(prev => ({ ...prev, tradeId: '' }));
    } catch (err: any) {
      console.error('Accept Trade Error:', err);
      setError(err.message || 'Error accepting trade.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, trade: false }));
    }
  };

  const handleRejectTrade = async () => {
    if (!account || !gameId || !tradeInputs.tradeId) {
      setError('Please connect your account, provide a valid Game ID, and enter a trade ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => tradeActions.rejectTrade(account, Number(tradeInputs.tradeId), gameId),
        'rejectTrade'
      );
      setTradeInputs(prev => ({ ...prev, tradeId: '' }));
    } catch (err: any) {
      console.error('Reject Trade Error:', err);
      setError(err.message || 'Error rejecting trade.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, trade: false }));
    }
  };

  const handleCounterTrade = async () => {
    if (!account || !gameId || !tradeInputs.originalOfferId || !tradeInputs.offeredPropertyIds || !tradeInputs.requestedPropertyIds) {
      setError('Please connect your account, provide a valid Game ID, and fill all counter trade fields.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const offeredIds = tradeInputs.offeredPropertyIds.split(',').map(Number).filter(n => !isNaN(n));
      const requestedIds = tradeInputs.requestedPropertyIds.split(',').map(Number).filter(n => !isNaN(n));
      await handleAction(
        () => tradeActions.counterTrade(
          account,
          gameId,
          Number(tradeInputs.originalOfferId),
          offeredIds,
          requestedIds,
          Number(tradeInputs.cashOffer),
          Number(tradeInputs.cashRequest),
          Number(tradeInputs.tradeType)
        ),
        'counterTrade'
      );
      setTradeInputs(prev => ({ ...prev, to: '', offeredPropertyIds: '', requestedPropertyIds: '', cashOffer: '0', cashRequest: '0', tradeType: '0', originalOfferId: '' }));
    } catch (err: any) {
      console.error('Counter Trade Error:', err);
      setError(err.message || 'Error countering trade.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, trade: false }));
    }
  };

  const handleApproveCounterTrade = async () => {
    if (!account || !tradeInputs.tradeId) {
      setError('Please connect your account and enter a trade ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => tradeActions.approveCounterTrade(account, Number(tradeInputs.tradeId)),
        'approveCounterTrade'
      );
      setTradeInputs(prev => ({ ...prev, tradeId: '' }));
    } catch (err: any) {
      console.error('Approve Counter Trade Error:', err);
      setError(err.message || 'Error approving counter trade.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, trade: false }));
    }
  };

  const handleAction = async (fn: () => Promise<any>, label: string) => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return null;
    }
    if (label === 'buyProperty' && (!currentProperty || currentProperty.type !== 'property' || currentProperty.owner !== null)) {
      setError('Cannot buy this property: it is already owned or invalid.');
      return null;
    }
    if (label === 'payRent' && (!currentProperty || currentProperty.type !== 'property' || !currentProperty.owner)) {
      setError('Cannot pay rent: no owner or invalid property.');
      return null;
    }
    if (label === 'finishTurn' && selectedCard) {
      setError('You must process the drawn card before ending your turn.');
      return null;
    }
    if (label === 'buyHouseOrHotel' && (!propertyId || Number(propertyId) === 0 || ownedProperties[Number(propertyId)]?.owner !== String(address).toLowerCase())) {
      setError('Cannot buy house or hotel: invalid property ID or you do not own this property.');
      return null;
    }
    if (label === 'sellHouseOrHotel' && (!propertyId || Number(propertyId) === 0 || ownedProperties[Number(propertyId)]?.owner !== String(address).toLowerCase())) {
      setError('Cannot sell house or hotel: invalid property ID or you do not own this property.');
      return null;
    }
    if (label === 'mortgageProperty' && (!propertyId || Number(propertyId) === 0 || ownedProperties[Number(propertyId)]?.owner !== String(address).toLowerCase())) {
      setError('Cannot mortgage: invalid property ID or you do not own this property.');
      return null;
    }
    if (label === 'unmortgageProperty' && (!propertyId || Number(propertyId) === 0)) {
      setError('Cannot unmortgage: invalid property ID.');
      return null;
    }
    try {
      setIsLoading(true);
      setError(null);
      const res = await fn();
      if (address && gameId !== null) {
        await loadGameData(address, gameId);
      }
      return res;
    } catch (err: any) {
      console.error(`${label} Error:`, err);
      setError(err.message || `Error in ${label}. It may not be your turn or the action is invalid.`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyProperty = async () => {
    if (!account || !gameId || !propertyId) {
      setError('Please connect your account, provide a valid Game ID, or enter a property ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => propertyActions.buyProperty(account, Number(propertyId), gameId),
        'buyProperty'
      );
      setPropertyId('');
    } catch (err: any) {
      console.error('Buy Property Error:', err);
      setError(err.message || 'Error buying property.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, property: false }));
    }
  };

  const handlePayRent = async () => {
    if (!account || !gameId || !propertyId) {
      setError('Please connect your account, provide a valid Game ID, or enter a property ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => propertyActions.payRent(account, Number(propertyId), gameId),
        'payRent'
      );
      setPropertyId('');
    } catch (err: any) {
      console.error('Pay Rent Error:', err);
      setError(err.message || 'Error paying rent.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, property: false }));
    }
  };

  const handlePayTax = async () => {
    if (!account || !gameId || !propertyId || (currentProperty && currentProperty.type !== 'special' && currentProperty.name !== 'Tax')) {
      setError('Please connect your account, provide a valid Game ID, or enter a valid Tax square ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => movementActions.payTax(account, Number(propertyId), gameId),
        'payTax'
      );
      setPropertyId('');
    } catch (err: any) {
      console.error('Pay Tax Error:', err);
      setError(err.message || 'Error paying tax.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, property: false }));
    }
  };

  const handleEndTurn = async () => {
    if (!account || !gameId) {
      setError('Please connect your account and provide a valid Game ID.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await handleAction(
        () => propertyActions.finishTurn(account, gameId),
        'finishTurn'
      );
    } catch (err: any) {
      console.error('End Turn Error:', err);
      setError(err.message || 'Error ending turn.');
    } finally {
      setIsLoading(false);
      setModalState(prev => ({ ...prev, turn: false }));
    }
  };

  const currentPlayer = players[currentPlayerIndex] || null;
  const currentSquare = currentPlayer ? boardData[currentPlayer.position] : null;

  const getGridPosition = (square: BoardSquare) => ({
    gridRowStart: square.gridPosition.row,
    gridColumnStart: square.gridPosition.col,
  });

  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 relative">
        {/* Rotate Prompt for Mobile Portrait */}
        <div className="rotate-prompt hidden fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 text-center text-white p-4">
          <p className="text-lg font-semibold">Please rotate your device to landscape mode for the best experience.</p>
        </div>
        {/* Board Section */}
        <div className="lg:w-2/3 flex justify-center items-center board-container">
          <div className="w-full max-w-[900px] bg-[#010F10] aspect-square rounded-lg relative game-board">
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
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, property: true }))}
                        aria-label="Open property actions"
                        className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Property Actions
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, turn: true }))}
                        aria-label="Open turn actions"
                        className="px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Turn Actions
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, player: true }))}
                        aria-label="Open player actions"
                        className="px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs rounded-full hover:from-pink-600 hover:to-rose-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Player Actions
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, management: true }))}
                        aria-label="Open property management actions"
                        className="px-2 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded-full hover:from-indigo-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Property Mgmt
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, trade: true }))}
                        aria-label="Open trade actions"
                        className="px-2 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs rounded-full hover:from-teal-600 hover:to-cyan-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Trade Actions
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
                        onClick={() => {
                          if (selectedCardType === 'CommunityChest') {
                            handleProcessCommunityChestCard();
                          } else if (selectedCardType === 'Chance') {
                            handleProcessChanceCard();
                          }
                        }}
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
                {modalState.player && (
                  <div
                    className="mt-4 p-4 rounded-lg w-full max-w-sm bg-cover bg-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h2 className="text-lg font-semibold text-cyan-300 mb-3">Player Actions</h2>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handlePayJailFine}
                        aria-label="Pay jail fine"
                        className="px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs rounded-full hover:from-pink-600 hover:to-rose-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Jail Fine
                      </button>
                      <button
                        onClick={handlePayGetoutOfJailChance}
                        aria-label="Use Chance Get Out of Jail card"
                        className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-lime-500 text-white text-xs rounded-full hover:from-yellow-600 hover:to-lime-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Chance Jail Card
                      </button>
                      <button
                        onClick={handlePayGetoutOfJailCommunity}
                        aria-label="Use Community Chest Get Out of Jail card"
                        className="px-2 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs rounded-full hover:from-teal-600 hover:to-cyan-600 transform hover:scale-105 transition-all duration-200"
                      >
                        CChest Jail Card
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, player: false }))}
                        aria-label="Close player actions"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
                {modalState.property && (
                  <div
                    className="mt-4 p-4 rounded-lg w-full max-w-sm bg-cover bg-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h2 className="text-lg font-semibold text-cyan-300 mb-3">Property Actions</h2>
                    <input
                      type="number"
                      placeholder="Property ID"
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                      className="w-full px-2 py-1 mb-3 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      aria-label="Enter property ID"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleBuyProperty}
                        aria-label="Buy the property"
                        className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Buy
                      </button>
                      <button
                        onClick={handlePayRent}
                        aria-label="Pay rent for the property"
                        className="px-2 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs rounded-full hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Rent
                      </button>
                      <button
                        onClick={handlePayTax}
                        aria-label="Pay tax for the square"
                        className="px-2 py-1 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs rounded-full hover:from-purple-600 hover:to-violet-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Tax
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, property: false }))}
                        aria-label="Close property actions"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
                {modalState.turn && (
                  <div
                    className="mt-4 p-4 rounded-lg w-full max-w-sm bg-cover bg-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h2 className="text-lg font-semibold text-cyan-300 mb-3">Turn Actions</h2>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleEndTurn}
                        aria-label="End your turn"
                        className="px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200"
                      >
                        End Turn
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, turn: false }))}
                        aria-label="Close turn actions"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
                {modalState.trade && (
                  <div
                    className="mt-4 p-4 rounded-lg w-full max-w-sm bg-cover bg-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 overflow-y-auto max-h-[80vh]"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h2 className="text-lg font-semibold text-cyan-300 mb-3">Trade Actions</h2>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-cyan-300 mb-2">Offer Trade</h3>
                      <input
                        type="text"
                        placeholder="To Address"
                        value={tradeInputs.to}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter recipient address"
                      />
                      <input
                        type="text"
                        placeholder="Offered Property IDs (comma-separated)"
                        value={tradeInputs.offeredPropertyIds}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, offeredPropertyIds: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter offered property IDs"
                      />
                      <input
                        type="text"
                        placeholder="Requested Property IDs (comma-separated)"
                        value={tradeInputs.requestedPropertyIds}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, requestedPropertyIds: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter requested property IDs"
                      />
                      <input
                        type="number"
                        placeholder="Cash Offer"
                        value={tradeInputs.cashOffer}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, cashOffer: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter cash offer amount"
                      />
                      <input
                        type="number"
                        placeholder="Cash Request"
                        value={tradeInputs.cashRequest}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, cashRequest: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter cash request amount"
                      />
                      <input
                        type="number"
                        placeholder="Trade Type"
                        value={tradeInputs.tradeType}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, tradeType: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter trade type"
                      />
                      <button
                        onClick={handleOfferTrade}
                        aria-label="Offer a trade"
                        className="px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Offer Trade
                      </button>
                    </div>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-cyan-300 mb-2">Manage Trades</h3>
                      <input
                        type="number"
                        placeholder="Trade ID"
                        value={tradeInputs.tradeId}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, tradeId: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter trade ID"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleAcceptTrade}
                          aria-label="Accept a trade"
                          className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200"
                        >
                          Accept Trade
                        </button>
                        <button
                          onClick={handleRejectTrade}
                          aria-label="Reject a trade"
                          className="px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full hover:from-red-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200"
                        >
                          Reject Trade
                        </button>
                        <button
                          onClick={handleApproveCounterTrade}
                          aria-label="Approve a counter trade"
                          className="px-2 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs rounded-full hover:from-teal-600 hover:to-cyan-600 transform hover:scale-105 transition-all duration-200"
                        >
                          Approve Counter
                        </button>
                      </div>
                    </div>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-cyan-300 mb-2">Counter Trade</h3>
                      <input
                        type="number"
                        placeholder="Original Offer ID"
                        value={tradeInputs.originalOfferId}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, originalOfferId: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter original offer ID"
                      />
                      <input
                        type="text"
                        placeholder="Offered Property IDs (comma-separated)"
                        value={tradeInputs.offeredPropertyIds}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, offeredPropertyIds: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter offered property IDs"
                      />
                      <input
                        type="text"
                        placeholder="Requested Property IDs (comma-separated)"
                        value={tradeInputs.requestedPropertyIds}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, requestedPropertyIds: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter requested property IDs"
                      />
                      <input
                        type="number"
                        placeholder="Cash Offer"
                        value={tradeInputs.cashOffer}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, cashOffer: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter cash offer amount"
                      />
                      <input
                        type="number"
                        placeholder="Cash Request"
                        value={tradeInputs.cashRequest}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, cashRequest: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter cash request amount"
                      />
                      <input
                        type="number"
                        placeholder="Trade Type"
                        value={tradeInputs.tradeType}
                        onChange={(e) => setTradeInputs(prev => ({ ...prev, tradeType: e.target.value }))}
                        className="w-full px-2 py-1 mb-2 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Enter trade type"
                      />
                      <button
                        onClick={handleCounterTrade}
                        aria-label="Counter a trade"
                        className="px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs rounded-full hover:from-purple-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Counter Trade
                      </button>
                    </div>
                    <button
                      onClick={() => setModalState(prev => ({ ...prev, trade: false }))}
                      aria-label="Close trade actions"
                      className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                    >
                      Close
                    </button>
                  </div>
                )}
                {modalState.management && (
                  <div
                    className="mt-4 p-4 rounded-lg w-full max-w-sm bg-cover bg-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 overflow-y-auto max-h-[80vh]"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h2 className="text-lg font-semibold text-cyan-300 mb-3">Property Management</h2>
                    <input
                      type="number"
                      placeholder="Property ID"
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                      className="w-full px-2 py-1 mb-3 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      aria-label="Enter property ID"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleBuyHouseOrHotel}
                        aria-label="Buy a house or hotel"
                        className="px-2 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded-full hover:from-indigo-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Buy House/Hotel
                      </button>
                      <button
                        onClick={handleSellHouseOrHotel}
                        aria-label="Sell a house or hotel"
                        className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs rounded-full hover:from-amber-600 hover:to-orange-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Sell House/Hotel
                      </button>
                      <button
                        onClick={handleMortgageProperty}
                        aria-label="Mortgage the property"
                        className="px-2 py-1 bg-gradient-to-r from-gray-600 to-gray-800 text-white text-xs rounded-full hover:from-gray-700 hover:to-gray-900 transform hover:scale-105 transition-all duration-200"
                      >
                        Mortgage
                      </button>
                      <button
                        onClick={handleUnmortgageProperty}
                        aria-label="Unmortgage the property"
                        className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Unmortgage
                      </button>
                      <button
                        onClick={() => setModalState(prev => ({ ...prev, management: false }))}
                        aria-label="Close property management actions"
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
                  className="w-full h-full p-[2px] relative box-border"
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
                        <span key={p.id} className={`text-lg md:text-2xl ${p.isNext ? 'border-2 border-cyan-300 rounded' : ''}`}>
                          {p.token || playerTokens[p.address] || ''}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Section */}
        <div className="lg:w-1/3 flex flex-col gap-2 sidebar">
          <div
            className="p-3 rounded-lg bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
            }}
          >
            <h2 className="text-base font-semibold text-cyan-300 mb-2">Game ID</h2>
            <div className="flex flex-row gap-2">
              <input
                type="number"
                placeholder="Enter game ID"
                value={inputGameId}
                onChange={(e) => setInputGameId(e.target.value)}
                className="px-2 py-1 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 flex-grow"
                aria-label="Enter game ID to join"
              />
              <button
                onClick={handleGameIdSubmit}
                aria-label="Submit game ID"
                className="px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs rounded-full hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200"
              >
                Submit
              </button>
            </div>
          </div>

          <div
            className="p-3 rounded-lg bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
            }}
          >
            <h2 className="text-base font-semibold text-cyan-300 mb-2">Connected Wallet</h2>
            <p className="text-sm text-gray-300">
              Address: <span className="text-blue-300 font-mono break-all">{address || 'Not connected'}</span>
            </p>
            {game?.createdBy === String(address).toLowerCase() && (
              <p className="text-sm text-gray-300">
                Role: <span className="text-blue-300 font-mono">Creator</span>
              </p>
            )}
          </div>

          <div
            className="p-3 rounded-lg bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
            }}
          >
            <h2 className="text-base font-semibold text-cyan-300 mb-2">Current Game</h2>
            {isLoading ? (
              <p className="text-gray-300 text-sm">Loading game data...</p>
            ) : game ? (
              <div className="space-y-1">
                <p className="text-sm"><strong>ID:</strong> {game.id}</p>
                <p className="text-sm"><strong>Current Player:</strong> {game.currentPlayer}</p>
                <p className="text-sm"><strong>Next Player:</strong> {game.nextPlayer}</p>
                <p className="text-sm"><strong>Creator:</strong> {game.createdBy}</p>
              </div>
            ) : (
              <p className="text-gray-300 text-sm">No game data available.</p>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-2">
            <div
              className="p-3 rounded-lg lg:w-1/2 bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
              }}
            >
              <h2 className="text-base font-semibold text-cyan-300 mb-2">Current Property</h2>
              {isLoading ? (
                <p className="text-gray-300 text-sm">Loading property data...</p>
              ) : currentProperty ? (
                <div className="space-y-1">
                  <p className="text-sm"><strong>ID:</strong> {currentProperty.id}</p>
                  <p className="text-sm"><strong>Name:</strong> {currentProperty.name || 'Unknown'}</p>
                  <p className="text-sm"><strong>Current Owner:</strong> {ownedProperties[currentProperty.id]?.ownerUsername || 'None'}</p>
                  <p className="text-sm"><strong>Current Rent:</strong> {currentProperty.rent_site_only || 0}</p>
                  {selectedCard && ['Chance', 'CommunityChest'].includes(currentProperty.name) && (
                    <p className="text-sm"><strong>Card Drawn:</strong> {selectedCard}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-300 text-sm">No property data available.</p>
              )}
            </div>

            <div
              className="p-3 rounded-lg lg:w-1/2 bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
              }}
            >
              <h2 className="text-base font-semibold text-cyan-300 mb-2">Player Info</h2>
              {isLoading ? (
                <p className="text-gray-300 text-sm">Loading player data...</p>
              ) : player ? (
                <div className="space-y-1">
                  <p className="text-sm"><strong>Username:</strong> {player.username}</p>
                  <p className="text-sm"><strong>Balance:</strong> {player.balance}</p>
                  <p className="text-sm"><strong>Position:</strong> {player.position}</p>
                  <p className="text-sm"><strong>Jailed:</strong> {player.jailed ? 'Yes' : 'No'}</p>
                </div>
              ) : (
                <p className="text-gray-300 text-sm">No player data available.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default GameBoard;