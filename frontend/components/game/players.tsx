'use client'

import { ChevronLeft, ChevronUp, ChevronDown, Handshake, CheckCircle, Repeat, User, MapPin, DollarSign, Home, Key } from 'lucide-react'
import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAccount } from '@starknet-react/core'
import { useGameActions } from '@/hooks/useGameActions'
import { usePlayerActions } from '@/hooks/usePlayerActions'
import { useMovementActions } from '@/hooks/useMovementActions'
import { usePropertyActions } from '@/hooks/usePropertyActions'
import { useTradeActions } from '@/hooks/useTradeActions'
import { boardData } from '@/data/board-data'
import { PLAYER_TOKENS } from '@/constants/constants'
import { shortString } from 'starknet'

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
}

interface Property {
  id: number;
  name: string;
  type: string;
  owner: string | null;
  ownerUsername: string | null;
  rent_site_only: number;
  cost?: number;
  mortgage?: number;
  color?: string;
  house_cost?: number;
  hotel_cost?: number;
  development: number;
}

interface OwnedProperty {
  owner: string;
  ownerUsername: string;
  token: string;
  development: number;
  rent_site_only: number;
  name: string;
}

interface TradeInputs {
  to: string;
  offeredPropertyIds: string;
  requestedPropertyIds: string;
  cashAmount: string;
  cashDirection: 'offer' | 'request';
  tradeType: 'property_for_property' | 'property_for_cash' | 'cash_for_property';
  tradeId: string;
  originalOfferId: string;
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

const Players = () => {
  const { account, address } = useAccount()
  console.log('Sidebar connected address (useAccount):', address ? String(address).toLowerCase() : 'No wallet');
  const gameActions = useGameActions()
  const playerActions = usePlayerActions()
  const movementActions = useMovementActions()
  const propertyActions = usePropertyActions()
  const tradeActions = useTradeActions()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [playerTokens, setPlayerTokens] = useState<{ [address: string]: string }>({})
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [gameId, setGameId] = useState<number | null>(null)
  const [inputGameId, setInputGameId] = useState('')
  const [game, setGame] = useState<Game | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [currentProperty, setCurrentProperty] = useState<Property | null>(null)
  const [ownedProperties, setOwnedProperties] = useState<{ [key: number]: OwnedProperty }>({})
  const [tradeInputs, setTradeInputs] = useState<TradeInputs>({
    to: '',
    offeredPropertyIds: '',
    requestedPropertyIds: '',
    cashAmount: '0',
    cashDirection: 'offer',
    tradeType: 'property_for_property',
    tradeId: '',
    originalOfferId: '',
  })
  const [modalState, setModalState] = useState({
    offerTrade: false,
    manageTrades: false,
    counterTrade: false,
    property: false,
    management: false,
    playerDetails: false,
    propertyDetails: false,
  })
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequestedProperties, setSelectedRequestedProperties] = useState<number[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null)
  
  const decimalAddress = useMemo(() => address ? BigInt(address).toString() : '', [address]);

  // Load game ID from query params or localStorage
  useEffect(() => {
    const id = searchParams.get('gameId') || localStorage.getItem('gameId')
    if (id) {
      const numId = Number(id)
      if (!isNaN(numId)) {
        setGameId(numId)
        setInputGameId(id)
        localStorage.setItem('gameId', id)
      } else {
        setError('Invalid Game ID provided.')
        router.push('/join-room')
      }
    } else {
      setError('No Game ID provided. Please join a game.')
      router.push('/join-room')
    }
  }, [searchParams, router])

  // Load game data when address and gameId are available
  useEffect(() => {
    if (address && gameId !== null) {
      loadGameData(address, gameId, false)
    }
  }, [address, gameId])

  // Polling for game updates during ongoing game
  useEffect(() => {
    if (!address || gameId === null) return;

    const pollInterval = setInterval(async () => {
      try {
        await loadGameData(address, gameId, true);
      } catch (err) {
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [address, gameId]);

  const waitForGameStatus = async (gid: number, maxAttempts: number = 5, delay: number = 2000) => {
    let attempts = 0
    while (attempts < maxAttempts) {
      try {
        const gameData = await gameActions.getGame(gid)
        if (!gameData) {
          throw new Error('Game data not found.')
        }
        const isOngoing =
          (gameData.status && 'variant' in gameData.status && gameData.status.variant.Ongoing !== undefined) ||
          gameData.is_initialised === true ||
          (typeof gameData.status === 'number' && gameData.status === 1)
        if (isOngoing) {
          return gameData
        }
      } catch (err: any) {
      }
      attempts++
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    throw new Error('Game is not ongoing after multiple attempts. Please verify the game ID or try again later.')
  }

  const getPlayerToken = (playerData: any): string => {
    if (!playerData.player_symbol || !playerData.player_symbol.variant) return '';
    const symbolVariant = Object.keys(playerData.player_symbol.variant).find(
      (key) => playerData.player_symbol.variant[key] !== undefined
    );
    return symbolVariant ? symbolVariant.toLowerCase() : '';
  };

  const loadGameData = async (playerAddress: string | bigint, gid: number, isSilent: boolean = false) => {
    console.log('Expected player address (from manual query):', '135468865440775691766709935916620667041655899686403319246123751585737847380');
    console.log('Input to getPlayer:', String(playerAddress).toLowerCase());
    if (!isSilent) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const gameData = await waitForGameStatus(gid)
      const currentPlayerAddress = await movementActions.getCurrentPlayer(gid)

      const assignedTokens: string[] = []
      const playerTokensMap: { [address: string]: string } = {}
      const processedAddresses = new Set<string>()

      const gamePlayers = await Promise.all(
        (gameData.game_players || []).filter((addr: any) => {
          const addrString = String(addr)
          if (processedAddresses.has(addrString)) return false
          processedAddresses.add(addrString)
          return true
        }).map(async (addr: any, index: number) => {
          const playerData = await gameActions.getPlayer(addr, gid)
          const addrString = String(addr)
          const username = await playerActions.getUsernameFromAddress(addrString)
          const decodedUsername = shortString.decodeShortString(username) || `Player ${index + 1}`

          let token = getPlayerToken(playerData)
          if (!token || assignedTokens.includes(token)) {
            token = PLAYER_TOKENS.find((t) => !assignedTokens.includes(t)) || ''
          }
          if (token) assignedTokens.push(token)
          playerTokensMap[addrString] = token

          return {
            id: index,
            address: addrString,
            username: decodedUsername,
            position: Number(playerData.position || 0),
            balance: Number(playerData.balance || 0),
            jailed: Boolean(playerData.jailed),
            properties_owned: (playerData.properties_owned || []).map((p: any) => Number(p)),
            isNext: addrString === String(currentPlayerAddress),
            token,
          }
        })
      )

      const propertyPromises = boardData
        .filter((square) => square.type === 'property')
        .map((square) => propertyActions.getProperty(square.id, gid))
      const propertyDataArray = await Promise.all(propertyPromises)

      const propertyOwners = new Set<string>()
      propertyDataArray.forEach((propertyData) => {
        if (propertyData.owner && propertyData.owner !== '0') {
          propertyOwners.add(String(propertyData.owner))
        }
      })

      const additionalPlayers = await Promise.all(
        [...propertyOwners]
          .filter((addr) => !processedAddresses.has(addr))
          .map(async (addr, index) => {
            processedAddresses.add(addr)
            const playerData = await gameActions.getPlayer(addr, gid)
            const username = await playerActions.getUsernameFromAddress(addr)
            const decodedUsername = shortString.decodeShortString(username) || `Player ${gamePlayers.length + index + 1}`
            let token = getPlayerToken(playerData)
            if (!token || assignedTokens.includes(token)) {
              token = PLAYER_TOKENS.find((t) => !assignedTokens.includes(t)) || ''
            }
            if (token) assignedTokens.push(token)
            playerTokensMap[addr] = token

            return {
              id: gamePlayers.length + index,
              address: addr,
              username: decodedUsername,
              position: Number(playerData.position || 0),
              balance: Number(playerData.balance || 0),
              jailed: Boolean(playerData.jailed),
              properties_owned: (playerData.properties_owned || []).map((p: any) => Number(p)),
              isNext: addr === String(currentPlayerAddress),
              token,
            }
          })
      )

      const allPlayers = [...gamePlayers, ...additionalPlayers]
      setPlayers(allPlayers)
      setPlayerTokens(playerTokensMap)

      const currentPlayerIdx = allPlayers.findIndex((p) => p.address === String(currentPlayerAddress))
      if (currentPlayerIdx !== -1) {
        setCurrentPlayerIndex(currentPlayerIdx)
      }

      setGame({
        id: Number(gameData.id || gid),
        currentPlayer: allPlayers.find((p) => p.isNext)?.username || 'Unknown',
      })

      const normalizedAddress = typeof playerAddress === 'bigint' ? playerAddress.toString() : String(playerAddress);
      console.log('Normalized playerAddress for getPlayer:', normalizedAddress);
      const playerData = await gameActions.getPlayer(normalizedAddress, gid);
      console.log('Fetched playerData full object:', playerData);
      console.log('Fetched playerData.address:', playerData.address ? String(playerData.address) : 'No address');
      console.log('Fetched playerData.properties_owned (parsed):', (playerData.properties_owned || []).map((p: any) => Number(p)));
      console.log('Does fetched address match expected?', playerData.address ? String(playerData.address) === '135468865440775691766709935916620667041655899686403319246123751585737847380' : false);
      const decodedPlayerUsername = shortString.decodeShortString(playerData.username) || 'Unknown'
      const playerToken = getPlayerToken(playerData) || playerTokensMap[BigInt(normalizedAddress).toString()] || ''

      setPlayer({
        address: BigInt(normalizedAddress).toString(),
        username: decodedPlayerUsername,
        balance: Number(playerData.balance || 0),
        position: Number(playerData.position || 0),
        jailed: Boolean(playerData.jailed),
        properties_owned: (playerData.properties_owned || []).map((p: any) => Number(p)),
        id: allPlayers.find((p) => p.address === BigInt(normalizedAddress).toString())?.id || 0,
        isNext: BigInt(normalizedAddress).toString() === String(currentPlayerAddress),
        token: playerToken,
      })

      const ownershipMap: { [key: number]: OwnedProperty } = {}
      propertyDataArray.forEach((propertyData, index) => {
        const square = boardData.filter((s) => s.type === 'property')[index]
        if (propertyData.owner && propertyData.owner !== '0') {
          const ownerAddress = String(propertyData.owner)
          const ownerPlayer = allPlayers.find((p) => p.address === ownerAddress)
          const decodedName = shortString.decodeShortString(propertyData.name) || square.name
          ownershipMap[square.id] = {
            owner: ownerAddress,
            ownerUsername: ownerPlayer?.username || 'Unknown',
            token: ownerPlayer?.token || '',
            development: Number(propertyData.development || 0),
            rent_site_only: Number(propertyData.rent_site_only || 0),
            name: decodedName,
          }
        }
      })
      console.log('Full ownedProperties map:', ownershipMap);
      console.log('ownedProperties map entries for ID 3:', ownershipMap[3]);
      console.log('ownedProperties map entries for ID 19:', ownershipMap[19]);
      console.log('Full ownedProperties keys:', Object.keys(ownershipMap).map(Number));
      setOwnedProperties(ownershipMap)

      const position = Number(playerData.position || 0)
      const square = boardData.find((s) => s.id === position)
      if (square) {
        const propertyIndex = boardData.filter((s) => s.type === 'property').findIndex((s) => s.id === square.id)
        const propertyData = propertyIndex !== -1 ? propertyDataArray[propertyIndex] : await propertyActions.getProperty(square.id, gid)
        const decodedPropertyName = propertyData.name && propertyData.name !== '0'
          ? shortString.decodeShortString(propertyData.name)
          : square.name || 'Unknown'
        const ownerAddress = propertyData.owner && propertyData.owner !== '0' ? String(propertyData.owner) : null
        const ownerPlayer = ownerAddress ? allPlayers.find((p) => p.address === ownerAddress) : null

        let currentRent = Number(propertyData.rent_site_only || square.rent_site_only || 0)
        const dev = Number(propertyData.development || 0)
        if (dev >= 1 && dev <= 4) {
          currentRent = Number(propertyData[`rent_${dev}_houses`] || currentRent)
        } else if (dev === 5) {
          currentRent = Number(propertyData.rent_hotel || currentRent)
        }

        setCurrentProperty({
          id: Number(propertyData.id || square.id),
          name: decodedPropertyName,
          type: square.type,
          owner: ownerPlayer?.username || null,
          ownerUsername: ownerPlayer?.username || null,
          rent_site_only: currentRent,
          cost: Number(square.price || 0),
          mortgage: Number(square.price/2 || 0),
          color: square.color || '#FFFFFF',
          house_cost: Number(square.cost_of_house || 0),
          hotel_cost: Number(square.cost_of_house || 0),
          development: dev,
        })
      } else {
        setCurrentProperty(null)
      }
    } catch (err: any) {
      if (!isSilent) {
        setError(err.message || 'Failed to load game data. Please try again or check the game ID.')
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false)
      }
    }
  }

  const handleGameIdSubmit = async () => {
    const gid = parseInt(inputGameId)
    if (!isNaN(gid)) {
      setGameId(gid)
      localStorage.setItem('gameId', inputGameId)
      if (address) {
        await loadGameData(address, gid, false)
      } else {
        setError('Please connect your wallet to join the game.')
      }
    } else {
      setError('Please enter a valid Game ID.')
    }
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const toggleProperties = () => {
    setIsPropertiesOpen(!isPropertiesOpen)
  }

  const openModal = (modal: keyof typeof modalState, data?: Player | number | null) => {
    setModalState({
      offerTrade: false,
      manageTrades: false,
      counterTrade: false,
      property: false,
      management: false,
      playerDetails: false,
      propertyDetails: false,
      [modal]: true,
    })
    if (modal === 'offerTrade') {
      setSelectedRequestedProperties([])
    }
    if (modal === 'management' && typeof data === 'number') {
      setSelectedPropertyId(data)
    }
    if (modal === 'playerDetails' && data instanceof Object && 'id' in data) {
      setSelectedPlayer(data as Player)
    }
  }

  const closeModal = () => {
    setModalState({
      offerTrade: false,
      manageTrades: false,
      counterTrade: false,
      property: false,
      management: false,
      playerDetails: false,
      propertyDetails: false,
    })
    setError(null)
    setTradeInputs({
      to: '',
      offeredPropertyIds: '',
      requestedPropertyIds: '',
      cashAmount: '0',
      cashDirection: 'offer',
      tradeType: 'property_for_property',
      tradeId: '',
      originalOfferId: '',
    })
    setSelectedPlayer(null)
    setSelectedPropertyId(null)
  }

  const handleOfferTrade = async () => {
    if (!account || !gameId || !tradeInputs.to || !tradeInputs.offeredPropertyIds || (!selectedRequestedProperties.length && tradeInputs.tradeType !== 'property_for_cash')) {
      setError('Please fill all required trade fields.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const offeredIds = tradeInputs.offeredPropertyIds.split(',').map(Number).filter(n => !isNaN(n))
      const requestedIds = selectedRequestedProperties
      const cash = Number(tradeInputs.cashAmount)
      const cashOffer = tradeInputs.cashDirection === 'offer' ? cash : 0
      const cashRequest = tradeInputs.cashDirection === 'request' ? cash : 0
      const tradeTypeMap = {
        'property_for_property': 0,
        'property_for_cash': 1,
        'cash_for_property': 2,
      }
      await tradeActions.offerTrade(
        account,
        gameId,
        tradeInputs.to,
        offeredIds,
        requestedIds,
        cashOffer,
        cashRequest,
        tradeTypeMap[tradeInputs.tradeType]
      )
      setTradeInputs({
        to: '',
        offeredPropertyIds: '',
        requestedPropertyIds: '',
        cashAmount: '0',
        cashDirection: 'offer',
        tradeType: 'property_for_property',
        tradeId: '',
        originalOfferId: '',
      })
      setSelectedRequestedProperties([])
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error offering trade.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptTrade = async () => {
    if (!account || !gameId || !tradeInputs.tradeId) {
      setError('Please enter a trade ID.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await tradeActions.acceptTrade(account, Number(tradeInputs.tradeId), gameId)
      setTradeInputs((prev) => ({ ...prev, tradeId: '' }))
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error accepting trade.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRejectTrade = async () => {
    if (!account || !gameId || !tradeInputs.tradeId) {
      setError('Please enter a trade ID.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await tradeActions.rejectTrade(account, Number(tradeInputs.tradeId), gameId)
      setTradeInputs((prev) => ({ ...prev, tradeId: '' }))
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error rejecting trade.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCounterTrade = async () => {
    if (!account || !gameId || !tradeInputs.originalOfferId || !tradeInputs.offeredPropertyIds || !tradeInputs.requestedPropertyIds) {
      setError('Please fill all counter trade fields.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const offeredIds = tradeInputs.offeredPropertyIds.split(',').map(Number).filter(n => !isNaN(n))
      const requestedIds = tradeInputs.requestedPropertyIds.split(',').map(Number).filter(n => !isNaN(n))
      const cash = Number(tradeInputs.cashAmount)
      const cashOffer = tradeInputs.cashDirection === 'offer' ? cash : 0
      const cashRequest = tradeInputs.cashDirection === 'request' ? cash : 0
      const tradeTypeMap = {
        'property_for_property': 0,
        'property_for_cash': 1,
        'cash_for_property': 2,
      }
      await tradeActions.counterTrade(
        account,
        gameId,
        Number(tradeInputs.originalOfferId),
        offeredIds,
        requestedIds,
        cashOffer,
        cashRequest,
        tradeTypeMap[tradeInputs.tradeType]
      )
      setTradeInputs({
        to: '',
        offeredPropertyIds: '',
        requestedPropertyIds: '',
        cashAmount: '0',
        cashDirection: 'offer',
        tradeType: 'property_for_property',
        tradeId: '',
        originalOfferId: '',
      })
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error countering trade.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveCounterTrade = async () => {
    if (!account || !tradeInputs.tradeId) {
      setError('Please enter a trade ID.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await tradeActions.approveCounterTrade(account, Number(tradeInputs.tradeId))
      setTradeInputs((prev) => ({ ...prev, tradeId: '' }))
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error approving counter trade.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBuyProperty = async () => {
    if (!account || !gameId || !player || !currentProperty || currentProperty.owner) {
      setError('Cannot buy: Invalid position or property already owned.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.buyProperty(account, player.position, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error buying property.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePayTax = async () => {
    if (!account || !gameId || !player || !currentProperty || currentProperty.name !== 'Tax') {
      setError('Invalid tax square or position.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await movementActions.payTax(account, player.position, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error paying tax.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBuyHouse = async () => {
    if (!account || !gameId || !player || !selectedPropertyId || ownedProperties[selectedPropertyId]?.owner !== decimalAddress) {
      setError('Cannot buy house: Invalid property or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === selectedPropertyId)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[selectedPropertyId]?.development >= 4) {
      setError('Cannot buy house: Invalid property, max houses reached, or hotel already built.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.buyHouseOrHotel(account, selectedPropertyId, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error buying house.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBuyHotel = async () => {
    if (!account || !gameId || !player || !selectedPropertyId || ownedProperties[selectedPropertyId]?.owner !== decimalAddress) {
      setError('Cannot buy hotel: Invalid property or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === selectedPropertyId)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[selectedPropertyId]?.development < 4) {
      setError('Cannot buy hotel: Invalid property, requires 4 houses, or hotel already built.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.buyHouseOrHotel(account, selectedPropertyId, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error buying hotel.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSellHouse = async () => {
    if (!account || !gameId || !player || !selectedPropertyId || ownedProperties[selectedPropertyId]?.owner !== decimalAddress) {
      setError('Cannot sell house: Invalid property or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === selectedPropertyId)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[selectedPropertyId]?.development === 0) {
      setError('Cannot sell house: Invalid property or no houses to sell.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.sellHouseOrHotel(account, selectedPropertyId, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error selling house.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSellHotel = async () => {
    if (!account || !gameId || !player || !selectedPropertyId || ownedProperties[selectedPropertyId]?.owner !== decimalAddress) {
      setError('Cannot sell hotel: Invalid property or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === selectedPropertyId)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[selectedPropertyId]?.development !== 5) {
      setError('Cannot sell hotel: Invalid property or no hotel to sell.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.sellHouseOrHotel(account, selectedPropertyId, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error selling hotel.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMortgageProperty = async () => {
    if (!account || !gameId || !player || !selectedPropertyId || ownedProperties[selectedPropertyId]?.owner !== decimalAddress) {
      setError('Cannot mortgage: Invalid property or not owned.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.mortgageProperty(account, selectedPropertyId, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error mortgaging property.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnmortgageProperty = async () => {
    if (!account || !gameId || !player || !selectedPropertyId) {
      setError('Cannot unmortgage: Invalid property.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.unmortgageProperty(account, selectedPropertyId, gameId)
      if (address && gameId !== null) {
        await loadGameData(address, gameId, true)
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Error unmortgaging property.')
    } finally {
      setIsLoading(false)
    }
  }

  const myPlayer = useMemo(() => players.find(p => p.address === decimalAddress), [players, decimalAddress])

  useEffect(() => {
    console.log('Final myPlayer:', myPlayer);
    if (myPlayer) {
      console.log('My properties_owned:', myPlayer.properties_owned);
    }
  }, [myPlayer]);

  const ownedPropertiesList = useMemo(() => {
    console.log('useMemo trigger - myPlayer:', myPlayer);
    console.log('useMemo trigger - ownedProperties:', ownedProperties);
    if (!myPlayer || !myPlayer.properties_owned || myPlayer.properties_owned.length === 0) {
      console.log('ownedPropertiesList empty: No properties owned');
      return []
    }
    const result = myPlayer.properties_owned.map(id => {
      const prop = ownedProperties[id]
      if (!prop) {
        console.log(`No prop data for ID ${id}`);
        return null
      }
      const boardProp = boardData.find(b => b.id === id)
      return {
        id,
        name: prop.name,
        rent_site_only: prop.rent_site_only,
        development: prop.development,
        color: boardProp?.color || '#FFFFFF',
      }
    }).filter(Boolean)
    console.log('Final ownedPropertiesList:', result);
    return result
  }, [myPlayer, ownedProperties])

  const otherPlayersProperties = useMemo(() => {
    if (!myPlayer) return []
    return Object.entries(ownedProperties)
      .filter(([_, prop]) => prop.owner !== myPlayer.address && prop.owner !== '')
      .map(([idStr, prop]) => {
        const id = Number(idStr)
        const boardProp = boardData.find(b => b.id === id)
        return {
          id,
          name: prop.name,
          ownerUsername: prop.ownerUsername,
          color: boardProp?.color || '#FFFFFF',
        }
      })
  }, [myPlayer, ownedProperties])

  const winningPlayerId = useMemo(() => {
    if (players.length === 0) return null
    return players.reduce((max, player) => player.balance > max.balance ? player : max, players[0]).id
  }, [players])

  return (
    <>
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute top-0 left-0 bg-gradient-to-r from-[#010F10] to-[#0A1A20] z-10 lg:hidden text-[#F0F7F7] w-[44px] h-[44px] rounded-e-[12px] flex items-center justify-center border-[1px] border-white/10 transition-all duration-300 hover:from-cyan-900 hover:to-indigo-900 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className="size-[28px]" />
        </button>
      )}
      <aside
        className={`
          h-full overflow-y-auto no-scrollbar bg-gradient-to-b from-[#010F10]/95 via-[#0A1A20]/95 to-[#010F10]/95 backdrop-blur-sm px-5 pb-12 rounded-e-[16px] border-r-[1px] border-white/10 relative
          before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.1),transparent_50%)] before:pointer-events-none
          transition-all duration-300 ease-in-out
          fixed z-20 top-0 left-0 
          transform ${isSidebarOpen ? 'translate-x-0 lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:static lg:transform-none
          ${isSidebarOpen ? 'lg:w-[300px] md:w-3/5 w-full' : 'lg:w-[60px] w-full'}
        `}
      >
        <div className="w-full h-full flex flex-col gap-4 relative z-10">
          <div className="w-full sticky top-0 bg-gradient-to-r from-[#010F10]/95 to-[#0A1A20]/95 py-2 flex items-center justify-between backdrop-blur-sm rounded-t-[16px]">
            <button
              onClick={handleGameIdSubmit}
              className="inline-block px-3 py-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-sm rounded-md hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
              aria-label={`Submit Game ID ${gameId || 'N/A'}`}
            >
              Game ID: {gameId || 'N/A'}
            </button>
            <button
              onClick={toggleSidebar}
              className="text-[#F0F7F7] lg:hidden transition-all duration-300 hover:text-cyan-300 hover:rotate-180"
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronLeft className="size-[28px]" />}
            </button>
          </div>

          {/* Players Section */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full p-4 bg-gradient-to-br from-[#0B191A]/90 to-[#1A262B]/90 backdrop-blur-sm rounded-[16px] shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,211,238,0.05),transparent_70%)] animate-pulse-slow"></div>
              <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar relative z-10">
                {players.map((player) => (
                  <li
                    key={player.id}
                    onClick={() => openModal('playerDetails', player)}
                    className={`p-3 bg-gradient-to-r from-[#131F25]/80 to-[#2A3A40]/80 rounded-[12px] text-[#F0F7F7] text-[13px] flex items-center gap-3 cursor-pointer hover:from-cyan-500/10 hover:to-indigo-500/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all duration-300 border-l-4 ${player.isNext ? 'border-cyan-300 bg-cyan-500/5' : 'border-transparent'}`}
                    aria-label={`Player ${player.username} with ${player.token} token${player.id === winningPlayerId ? ' (Leader)' : ''}`}
                  >
                    <TokenIcon token={player.token} />
                    <div className="flex-1">
                      <span className={`font-medium ${player.address === decimalAddress ? 'text-cyan-300' : ''}`}>
                        {player.username}
                        {player.id === winningPlayerId && <span className="ml-2 text-yellow-400">👑</span>}
                        {player.address === decimalAddress && <span className="text-[11px] text-cyan-300"> (Me)</span>}
                      </span>
                      <span className="block text-[11px] text-[#A0B1B8]">
                        Position: {player.position} | Balance: ${player.balance}
                        {player.jailed && <span className="ml-2 text-red-400">(Jailed)</span>}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {isLoading && (
                <p className="text-white text-sm mt-3 relative z-10">Loading game data...</p>
              )}
              {/* Current Property Section (Compact, inside Players div) */}
              <div 
                onClick={() => currentProperty && openModal('propertyDetails', currentProperty.id)}
                className={`mt-4 cursor-pointer ${currentProperty ? 'hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]' : ''}`}
              >
                <h6 className="text-[13px] font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Current Property
                </h6>
                {isLoading ? (
                  <p className="text-[#A0B1B8] text-[12px] text-center">Loading...</p>
                ) : currentProperty ? (
                  <div
                    className="p-2 bg-gradient-to-r from-[#131F25]/80 to-[#2A3A40]/80 rounded-[12px] text-[#F0F7F7] text-[12px] flex items-center gap-2 hover:from-cyan-500/10 hover:to-indigo-500/10 transition-all duration-300 border border-white/5"
                    aria-label={`Current property: ${currentProperty.name}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]"
                      style={{ backgroundColor: currentProperty.color || '#FFFFFF' }}
                    />
                    <div className="flex-1">
                      <span className="font-medium">
                        {currentProperty.name || 'Unknown'} (ID: {currentProperty.id})
                      </span>
                      <span className="block text-[10px] text-[#A0B1B8]">
                        Owner: {currentProperty.owner || 'None'} | Rent: ${currentProperty.rent_site_only || 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#A0B1B8] text-[12px] text-center">No property data available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Properties Section */}
          <div className={`w-full flex flex-col gap-6 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full flex flex-col gap-4">
              <h4 className='font-[700] font-dmSans text-[16px] text-[#F0F7F7] flex items-center gap-2'>
                <Home className="w-5 h-5 text-cyan-300" />
                My Empire
              </h4>
              <div className="flex flex-col gap-3">
                <button
                  onClick={toggleProperties}
                  className="flex items-center justify-between w-full px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-[12px] text-[#F0F7F7] text-[13px] font-semibold font-dmSans hover:from-cyan-700 hover:to-teal-700 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all duration-300 border border-white/10"
                  aria-label={isPropertiesOpen ? "Collapse My Empire" : "Expand My Empire"}
                >
                  <span>My Empire</span>
                  {isPropertiesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {isPropertiesOpen && (
                  <div className="w-full p-4 bg-gradient-to-br from-[#0B191A]/90 to-[#1A262B]/90 backdrop-blur-sm rounded-[16px] shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,211,238,0.05),transparent_70%)] animate-pulse-slow"></div>
                    {ownedPropertiesList.length > 0 ? (
                      <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar relative z-10">
                        {ownedPropertiesList.map((property) => (
                          property ? (
                            <li
                              key={property.id}
                              onClick={() => openModal('management', property.id)}
                              className="p-3 bg-gradient-to-r from-[#131F25]/80 to-[#2A3A40]/80 rounded-[12px] text-[#F0F7F7] text-[13px] flex items-center gap-3 hover:from-cyan-500/10 hover:to-indigo-500/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all duration-300 cursor-pointer border border-white/5"
                              aria-label={`Manage property ${property.name}`}
                            >
                              <div
                                className="w-4 h-4 rounded-full shadow-[0_0_10px_currentColor]"
                                style={{ backgroundColor: property.color || '#FFFFFF' }}
                              />
                              <div className="flex-1">
                                <span className="font-medium">{property.name}</span>
                                <span className="block text-[11px] text-[#A0B1B8]">
                                  ID: {property.id} | Rent: ${property.rent_site_only} | Development: {property.development}
                                </span>
                              </div>
                            </li>
                          ) : null
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#A0B1B8] text-[13px] text-center relative z-10">No properties owned yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trade Section */}
          <div className={`w-full flex flex-col gap-6 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full flex flex-col gap-4">
              <h4 className='font-[700] font-dmSans text-[16px] text-[#F0F7F7] flex items-center gap-2'>
                <Handshake className="w-5 h-5 text-cyan-300" />
                Trade Hub
              </h4>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => openModal('offerTrade')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-blue-700 to-indigo-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-blue-800 hover:to-indigo-800 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10"
                  aria-label="Open offer trade modal"
                >
                  <Handshake className='w-4 h-4' />
                  Offer Trade
                </button>
                <button
                  onClick={() => openModal('manageTrades')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-teal-700 to-cyan-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-teal-800 hover:to-cyan-800 hover:shadow-[0_0_15px_rgba(45,212,191,0.5)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 border border-white/10"
                  aria-label="Open manage trades modal"
                >
                  <CheckCircle className='w-4 h-4' />
                  Manage Trades
                </button>
                <button
                  onClick={() => openModal('counterTrade')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-orange-700 to-red-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-orange-800 hover:to-red-800 hover:shadow-[0_0_15px_rgba(249,115,22,0.5)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 border border-white/10"
                  aria-label="Open counter trade modal"
                >
                  <Repeat className='w-4 h-4' />
                  Counter Trade
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Player Details Modal */}
      {modalState.playerDetails && selectedPlayer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
            aria-labelledby="player-details-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d')] bg-cover bg-center opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">👤</div>
              <h3 id="player-details-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                {selectedPlayer.username}
              </h3>
              <p className="text-lg text-cyan-200 mb-6">Player Profile</p>
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-cyan-300" />
                  <span className="text-white">Username: {selectedPlayer.username}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-emerald-300" />
                  <span className="text-white">Balance: ${selectedPlayer.balance}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-blue-300" />
                  <span className="text-white">Position: {selectedPlayer.position}</span>
                </div>
                {selectedPlayer.jailed && (
                  <div className="flex items-center gap-2 text-sm text-red-300">
                    <Key className="w-4 h-4" />
                    <span className="text-white">Status: Jailed</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-cyan-200 font-medium">Properties Owned:</span>
                  <ul className="mt-2 space-y-1 text-xs text-white/80">
                    {selectedPlayer.properties_owned.length > 0 ? (
                      selectedPlayer.properties_owned.map((id) => {
                        const prop = ownedProperties[id];
                        return (
                          <li key={id} className="flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {prop?.name || `Property ${id}`}
                          </li>
                        );
                      })
                    ) : (
                      <li>No properties</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="flex justify-center mt-6">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  aria-label="Close player details"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property Details Modal */}
      {modalState.propertyDetails && currentProperty && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
            aria-labelledby="property-details-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa')] bg-cover bg-center opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">🏠</div>
              <h3 id="property-details-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                {currentProperty.name}
              </h3>
              <p className="text-lg text-cyan-200 mb-6">Property Details</p>
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <Home className="w-4 h-4 text-cyan-300" />
                  <span className="text-white">Name: {currentProperty.name} (ID: {currentProperty.id})</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-emerald-300" />
                  <span className="text-white">Rent: ${currentProperty.rent_site_only}</span>
                </div>
                {currentProperty.cost && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-blue-300" />
                    <span className="text-white">Cost: ${currentProperty.cost}</span>
                  </div>
                )}
                {currentProperty.development > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="w-4 h-4 text-yellow-300" />
                    <span className="text-white">Development: {currentProperty.development}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-purple-300" />
                  <span className="text-white">Owner: {currentProperty.owner || 'None'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className="w-4 h-4 rounded-full shadow-[0_0_10px_currentColor]"
                    style={{ backgroundColor: currentProperty.color || '#FFFFFF' }}
                  />
                  <span className="text-white">Color Group</span>
                </div>
              </div>
              <div className="flex justify-center mt-6">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  aria-label="Close property details"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Trade Modal */}
      {modalState.offerTrade && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
            aria-labelledby="offer-trade-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c')] bg-cover bg-center opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">🤝</div>
              <h3 id="offer-trade-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                Offer Trade
              </h3>
              <p className="text-lg text-cyan-200 mb-6">Propose a deal to another player</p>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="to-player">To Player</label>
                  <select
                    id="to-player"
                    value={tradeInputs.to}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, to: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Select player to trade with"
                  >
                    <option value="">Select Player</option>
                    {players
                      .filter((p) => p.address !== decimalAddress)
                      .map((p) => (
                        <option key={p.address} value={p.address}>
                          {p.username}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="offered-properties">Offered Property IDs (comma-separated)</label>
                  <input
                    id="offered-properties"
                    type="text"
                    value={tradeInputs.offeredPropertyIds}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, offeredPropertyIds: e.target.value })}
                    placeholder="e.g., 1,3,5"
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Enter offered property IDs"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1">Requested Properties</label>
                  <div className="max-h-40 overflow-y-auto bg-gray-800/80 rounded-md border border-cyan-500/30 p-2">
                    {otherPlayersProperties.map((property) => (
                      <div key={property.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          value={property.id}
                          checked={selectedRequestedProperties.includes(property.id)}
                          onChange={(e) => {
                            const id = Number(e.target.value)
                            setSelectedRequestedProperties((prev) =>
                              prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
                            )
                          }}
                          className="h-4 w-4 text-cyan-500 focus:ring-cyan-500 rounded"
                          aria-label={`Select property ${property.name} for trade`}
                        />
                        <span className="text-sm text-cyan-200">
                          {property.name} (ID: {property.id}, Owner: {property.ownerUsername})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="cash-amount">Cash Amount</label>
                  <input
                    id="cash-amount"
                    type="number"
                    value={tradeInputs.cashAmount}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, cashAmount: e.target.value })}
                    placeholder="Enter cash amount"
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Enter cash amount for trade"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="cash-direction">Cash Direction</label>
                  <select
                    id="cash-direction"
                    value={tradeInputs.cashDirection}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, cashDirection: e.target.value as 'offer' | 'request' })}
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Select cash direction for trade"
                  >
                    <option value="offer">Offer Cash</option>
                    <option value="request">Request Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="trade-type">Trade Type</label>
                  <select
                    id="trade-type"
                    value={tradeInputs.tradeType}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, tradeType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Select trade type"
                  >
                    <option value="property_for_property">Property for Property</option>
                    <option value="property_for_cash">Property for Cash</option>
                    <option value="cash_for_property">Cash for Property</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  aria-label="Cancel trade offer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOfferTrade}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(59,130,246,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Submit trade offer"
                >
                  {isLoading ? 'Submitting...' : 'Offer Trade'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Trades Modal */}
      {modalState.manageTrades && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
            aria-labelledby="manage-trades-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c')] bg-cover bg-center opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">🤝</div>
              <h3 id="manage-trades-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                Manage Trades
              </h3>
              <p className="text-lg text-cyan-200 mb-6">Review and respond to trade offers</p>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="trade-id">Trade ID</label>
                  <input
                    id="trade-id"
                    type="number"
                    value={tradeInputs.tradeId}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, tradeId: e.target.value })}
                    placeholder="Enter trade ID"
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Enter trade ID to manage"
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  aria-label="Cancel manage trades"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcceptTrade}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-green-700 to-emerald-700 text-white rounded-md hover:from-green-800 hover:to-emerald-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(34,197,94,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Accept trade"
                >
                  {isLoading ? 'Processing...' : 'Accept'}
                </button>
                <button
                  onClick={handleRejectTrade}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Reject trade"
                >
                  {isLoading ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={handleApproveCounterTrade}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-md hover:from-purple-800 hover:to-indigo-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(147,51,234,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Approve counter trade"
                >
                  {isLoading ? 'Processing...' : 'Approve Counter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Counter Trade Modal */}
      {modalState.counterTrade && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
            aria-labelledby="counter-trade-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c')] bg-cover bg-center opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">🤝</div>
              <h3 id="counter-trade-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                Counter Trade
              </h3>
              <p className="text-lg text-cyan-200 mb-6">Propose a counter-offer for a trade</p>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="original-trade-id">Original Trade ID</label>
                  <input
                    id="original-trade-id"
                    type="number"
                    value={tradeInputs.originalOfferId}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, originalOfferId: e.target.value })}
                    placeholder="Enter original trade ID"
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Enter original trade ID for counter trade"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="counter-offered-properties">Offered Property IDs (comma-separated)</label>
                  <input
                    id="counter-offered-properties"
                    type="text"
                    value={tradeInputs.offeredPropertyIds}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, offeredPropertyIds: e.target.value })}
                    placeholder="e.g., 1,3,5"
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Enter offered property IDs for counter trade"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="counter-requested-properties">Requested Property IDs (comma-separated)</label>
                  <input
                    id="counter-requested-properties"
                    type="text"
                    value={tradeInputs.requestedPropertyIds}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, requestedPropertyIds: e.target.value })}
                    placeholder="e.g., 2,4,6"
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Enter requested property IDs for counter trade"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="counter-cash-amount">Cash Amount</label>
                  <input
                    id="counter-cash-amount"
                    type="number"
                    value={tradeInputs.cashAmount}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, cashAmount: e.target.value })}
                    placeholder="Enter cash amount"
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Enter cash amount for counter trade"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="counter-cash-direction">Cash Direction</label>
                  <select
                    id="counter-cash-direction"
                    value={tradeInputs.cashDirection}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, cashDirection: e.target.value as 'offer' | 'request' })}
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Select cash direction for counter trade"
                  >
                    <option value="offer">Offer Cash</option>
                    <option value="request">Request Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-cyan-200 mb-1" htmlFor="counter-trade-type">Trade Type</label>
                  <select
                    id="counter-trade-type"
                    value={tradeInputs.tradeType}
                    onChange={(e) => setTradeInputs({ ...tradeInputs, tradeType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800/80 text-white rounded-md border border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    aria-label="Select trade type for counter trade"
                  >
                    <option value="property_for_property">Property for Property</option>
                    <option value="property_for_cash">Property for Cash</option>
                    <option value="cash_for_property">Cash for Property</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  aria-label="Cancel counter trade"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCounterTrade}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-orange-700 to-red-700 text-white rounded-md hover:from-orange-800 hover:to-red-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(249,115,22,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Submit counter trade"
                >
                  {isLoading ? 'Submitting...' : 'Counter Trade'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property Actions Modal */}
      {modalState.property && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
            aria-labelledby="property-actions-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c')] bg-cover bg-center opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">🏠</div>
              <h3 id="property-actions-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                Property Actions
              </h3>
              <p className="text-lg text-cyan-200 mb-6">Take action on the current property</p>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  aria-label="Cancel property action"
                >
                  Cancel
                </button>
                {currentProperty?.type === 'property' && !currentProperty.owner && (
                  <button
                    onClick={handleBuyProperty}
                    disabled={isLoading}
                    className={`px-4 py-2 bg-gradient-to-r from-green-700 to-emerald-700 text-white rounded-md hover:from-green-800 hover:to-emerald-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(34,197,94,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label="Buy property"
                  >
                    {isLoading ? 'Processing...' : 'Buy Property'}
                  </button>
                )}
                {currentProperty?.name === 'Tax' && (
                  <button
                    onClick={handlePayTax}
                    disabled={isLoading}
                    className={`px-4 py-2 bg-gradient-to-r from-yellow-700 to-amber-700 text-white rounded-md hover:from-yellow-800 hover:to-amber-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(251,191,36,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label="Pay tax"
                  >
                    {isLoading ? 'Processing...' : 'Pay Tax'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property Management Modal */}
      {modalState.management && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
            aria-labelledby="property-management-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c')] bg-cover bg-center opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">🏠</div>
              <h3 id="property-management-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                Manage {ownedProperties[selectedPropertyId!]?.name || 'Property'} (ID: {selectedPropertyId})
              </h3>
              <p className="text-lg text-cyan-200 mb-6">
                Development: {ownedProperties[selectedPropertyId!]?.development || 0} | Rent: ${ownedProperties[selectedPropertyId!]?.rent_site_only || 0}
              </p>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleBuyHouse}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(59,130,246,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Buy house for selected property"
                >
                  {isLoading ? 'Processing...' : 'Buy House'}
                </button>
                <button
                  onClick={handleBuyHotel}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(59,130,246,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Buy hotel for selected property"
                >
                  {isLoading ? 'Processing...' : 'Buy Hotel'}
                </button>
                <button
                  onClick={handleSellHouse}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Sell house for selected property"
                >
                  {isLoading ? 'Processing...' : 'Sell House'}
                </button>
                <button
                  onClick={handleSellHotel}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Sell hotel for selected property"
                >
                  {isLoading ? 'Processing...' : 'Sell Hotel'}
                </button>
                <button
                  onClick={handleMortgageProperty}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-yellow-700 to-amber-700 text-white rounded-md hover:from-yellow-800 hover:to-amber-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(251,191,36,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Mortgage selected property"
                >
                  {isLoading ? 'Processing...' : 'Mortgage'}
                </button>
                <button
                  onClick={handleUnmortgageProperty}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-green-700 to-emerald-700 text-white rounded-md hover:from-green-800 hover:to-emerald-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(34,197,94,0.4)] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Unmortgage selected property"
                >
                  {isLoading ? 'Processing...' : 'Unmortgage'}
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  aria-label="Cancel property management"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pop-in {
          0% {
            transform: scale(0.7) rotate(-5deg);
            opacity: 0;
          }
          80% {
            transform: scale(1.05) rotate(2deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes pulse-slow {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.7);
          }
          70% {
            transform: scale(1.03);
            box-shadow: 0 0 15px 5px rgba(34, 211, 238, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0);
          }
        }
        .animate-pop-in {
          animation: pop-in 0.6s ease-out;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite;
        }
      `}</style>
    </>
  )
}

export default Players