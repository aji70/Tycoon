'use client'

import { ChevronLeft, ChevronUp, ChevronDown, Flag, Handshake, CheckCircle, Repeat, Plus } from 'lucide-react'
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
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequestedProperties, setSelectedRequestedProperties] = useState<number[]>([])

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
    }, 2000); // Poll every 2 seconds

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

  const loadGameData = async (playerAddress: string, gid: number, isSilent: boolean = false) => {
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
        (gameData.game_players || []).filter((addr: string) => {
          const addrString = String(addr).toLowerCase()
          if (processedAddresses.has(addrString)) return false
          processedAddresses.add(addrString)
          return true
        }).map(async (addr: string, index: number) => {
          const playerData = await gameActions.getPlayer(addr, gid)
          const addrString = String(addr).toLowerCase()
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
            properties_owned: playerData.properties_owned || [],
            isNext: String(addr).toLowerCase() === String(currentPlayerAddress).toLowerCase(),
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
          propertyOwners.add(String(propertyData.owner).toLowerCase())
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
              properties_owned: playerData.properties_owned || [],
              isNext: addr === String(currentPlayerAddress).toLowerCase(),
              token,
            }
          })
      )

      const allPlayers = [...gamePlayers, ...additionalPlayers]
      setPlayers(allPlayers)
      setPlayerTokens(playerTokensMap)

      const currentPlayerIdx = allPlayers.findIndex((p) => p.address === String(currentPlayerAddress).toLowerCase())
      if (currentPlayerIdx !== -1) {
        setCurrentPlayerIndex(currentPlayerIdx)
      }

      setGame({
        id: Number(gameData.id || gid),
        currentPlayer: allPlayers.find((p) => p.isNext)?.username || 'Unknown',
      })

      const playerData = await gameActions.getPlayer(playerAddress, gid)
      const decodedPlayerUsername = shortString.decodeShortString(playerData.username) || 'Unknown'
      const playerToken = getPlayerToken(playerData) || playerTokensMap[String(playerAddress).toLowerCase()] || ''

      setPlayer({
        address: String(playerAddress).toLowerCase(),
        username: decodedPlayerUsername,
        balance: Number(playerData.balance || 0),
        position: Number(playerData.position || 0),
        jailed: Boolean(playerData.jailed),
        properties_owned: playerData.properties_owned || [],
        id: allPlayers.find((p) => p.address === String(playerAddress).toLowerCase())?.id || 0,
        isNext: String(playerAddress).toLowerCase() === String(currentPlayerAddress).toLowerCase(),
        token: playerToken,
      })

      const ownershipMap: { [key: number]: OwnedProperty } = {}
      propertyDataArray.forEach((propertyData, index) => {
        const square = boardData.filter((s) => s.type === 'property')[index]
        if (propertyData.owner && propertyData.owner !== '0') {
          const ownerAddress = String(propertyData.owner).toLowerCase()
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
      setOwnedProperties(ownershipMap)

      const position = Number(playerData.position || 0)
      const square = boardData.find((s) => s.id === position)
      if (square) {
        const propertyIndex = boardData.filter((s) => s.type === 'property').findIndex((s) => s.id === square.id)
        const propertyData = propertyIndex !== -1 ? propertyDataArray[propertyIndex] : await propertyActions.getProperty(square.id, gid)
        const decodedPropertyName = propertyData.name && propertyData.name !== '0'
          ? shortString.decodeShortString(propertyData.name)
          : square.name || 'Unknown'
        const ownerAddress = propertyData.owner && propertyData.owner !== '0' ? String(propertyData.owner).toLowerCase() : null
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

  const openModal = (modal: keyof typeof modalState) => {
    setModalState({
      offerTrade: false,
      manageTrades: false,
      counterTrade: false,
      property: false,
      management: false,
      [modal]: true,
    })
    if (modal === 'offerTrade') {
      setSelectedRequestedProperties([])
    }
  }

  const closeModal = () => {
    setModalState({
      offerTrade: false,
      manageTrades: false,
      counterTrade: false,
      property: false,
      management: false,
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
    if (!account || !gameId || !player || ownedProperties[player.position]?.owner !== String(address).toLowerCase()) {
      setError('Cannot buy house: Invalid position or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === player.position)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[player.position]?.development >= 4 || ownedProperties[player.position]?.development > 4) {
      setError('Cannot buy house: Invalid property, max houses reached, or hotel already built.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.buyHouseOrHotel(account, player.position, gameId)
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
    if (!account || !gameId || !player || ownedProperties[player.position]?.owner !== String(address).toLowerCase()) {
      setError('Cannot buy hotel: Invalid position or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === player.position)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[player.position]?.development < 4 || ownedProperties[player.position]?.development > 4) {
      setError('Cannot buy hotel: Invalid property, requires 4 houses, or hotel already built.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.buyHouseOrHotel(account, player.position, gameId)
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
    if (!account || !gameId || !player || ownedProperties[player.position]?.owner !== String(address).toLowerCase()) {
      setError('Cannot sell house: Invalid position or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === player.position)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[player.position]?.development === 0) {
      setError('Cannot sell house: Invalid property or no houses to sell.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.sellHouseOrHotel(account, player.position, gameId)
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
    if (!account || !gameId || !player || ownedProperties[player.position]?.owner !== String(address).toLowerCase()) {
      setError('Cannot sell hotel: Invalid position or not owned.')
      return
    }
    const square = boardData.find((s) => s.id === player.position)
    if (!square || square.type !== 'property' || !square.cost_of_house || ownedProperties[player.position]?.development === 0) {
      setError('Cannot sell hotel: Invalid property or no hotel to sell.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.sellHouseOrHotel(account, player.position, gameId)
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
    if (!account || !gameId || !player || ownedProperties[player.position]?.owner !== String(address).toLowerCase()) {
      setError('Cannot mortgage: Invalid position or not owned.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.mortgageProperty(account, player.position, gameId)
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
    if (!account || !gameId || !player) {
      setError('Cannot unmortgage: Invalid position.')
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      await propertyActions.unmortgageProperty(account, player.position, gameId)
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

  const myPlayer = useMemo(() => players.find(p => p.address === String(address).toLowerCase()), [players, address])

  const ownedPropertiesList = useMemo(() => {
    if (!myPlayer) return []
    return Object.entries(ownedProperties)
      .filter(([_, prop]) => prop.owner === myPlayer.address)
      .map(([idStr, prop]) => {
        const id = Number(idStr)
        const boardProp = boardData.find(b => b.id === id)
        return {
          id,
          name: prop.name,
          rent_site_only: prop.rent_site_only,
          development: prop.development,
          color: boardProp?.color || '#FFFFFF',
        }
      })
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
          className="absolute top-0 left-0 bg-[#010F10] z-10 lg:hidden text-[#F0F7F7] w-[44px] h-[44px] rounded-e-[12px] flex items-center justify-center border-[1px] border-white/10 transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-900 hover:to-indigo-900 hover:shadow-md"
          aria-label="Toggle sidebar"
        >
        </button>
      )}
      <aside
        className={`
          h-full overflow-y-auto no-scrollbar bg-[#010F10]/95 backdrop-blur-sm px-5 pb-12 rounded-e-[16px] border-r-[1px] border-white/10
          transition-all duration-300 ease-in-out
          fixed z-20 top-0 left-0 
          transform ${isSidebarOpen ? 'translate-x-0 lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:static lg:transform-none
          ${isSidebarOpen ? 'lg:w-[300px] md:w-3/5 w-full' : 'lg:w-[60px] w-full'}
        `}
      >
        <div className="w-full h-full flex flex-col gap-8">
          <div className="w-full sticky top-0 bg-[#010F10]/95 py-5 flex justify-between items-center">
            <h4 className={`font-[700] font-dmSans text-[18px] text-[#F0F7F7] ${!isSidebarOpen && 'hidden'}`}>
              Players
            </h4>
            <button
              onClick={toggleSidebar}
              className="text-[#F0F7F7] lg:hidden transition-colors duration-300 hover:text-cyan-300"
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronLeft className="size-[28px]" />}
            </button>
          </div>

          {/* Connected Player Header */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div
              className="p-3 rounded-lg bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
              }}
            >
              <h2 className="text-base font-semibold text-cyan-300 mb-2">My Profile</h2>
              {player ? (
                <p className="text-sm text-white" aria-label={`Player ${player.username} with ${player.token} token`}>
                  <span className="font-medium">{player.username}</span> <TokenIcon token={player.token} />
                </p>
              ) : (
                <p className="text-sm text-white">Loading player data...</p>
              )}
            </div>
          </div>

          {/* Game ID Section */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
                  className="px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs rounded-md hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>

          {/* Players Section */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full p-4 bg-[#0B191A]/90 backdrop-blur-sm rounded-[16px] shadow-lg border border-white/5">
              <h5 className="text-[14px] font-semibold text-cyan-300 mb-3">Players</h5>
              <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar">
                {players.map((player, index) => (
                  <li
                    key={player.id}
                    className={`p-3 bg-[#131F25]/80 rounded-[12px] text-[#F0F7F7] text-[13px] flex items-center gap-3 hover:bg-gradient-to-r hover:from-[#1A262B]/80 hover:to-[#2A3A40]/80 hover:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all duration-300 ${
                      player.isNext ? 'border-l-4 border-cyan-300' : ''
                    }`}
                    aria-label={`Player ${player.username} with ${player.token} token${player.id === winningPlayerId ? ' (Leader)' : ''}`}
                  >
                    <TokenIcon token={player.token} />
                    <div className="flex-1">
                      <span className="font-medium">
                        {player.username}
                        {player.id === winningPlayerId && <span className="ml-2 text-yellow-400">👑</span>}
                        {player.address === String(address).toLowerCase() && <span className="text-[11px] text-cyan-300"> (Me)</span>}
                      </span>
                      <span className="block text-[11px] text-[#A0B1B8]">
                        Position: {player.position} | Balance: ${player.balance}
                        {player.jailed && <span className="ml-2 text-red-400">(Jailed)</span>}
                      </span>
                    </div>
                  </li>
                  
                ))}
              </ul>
                {isLoading ? (
                <p className="text-white text-sm">Loading game data...</p>
              ) : game ? (
                <div className="space-y-1">
                  <p className="text-sm text-white"><strong>Current Player:</strong> {game.currentPlayer}</p>
                </div>
              ) : (
                <p className="text-white text-sm">No game data available.</p>
              )}
            </div>
          </div>

          {/* Current Property Section */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div
              className="p-3 rounded-lg bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
              }}
            >
              <h2 className="text-base font-semibold text-cyan-300 mb-2">Current Property</h2>
              {isLoading ? (
                <p className="text-white text-sm">Loading property data...</p>
              ) : currentProperty ? (
                <div className="space-y-1">
                  <p className="text-sm text-white"><strong>ID:</strong> {currentProperty.id}</p>
                  <p className="text-sm text-white"><strong>Name:</strong> {currentProperty.name || 'Unknown'}</p>
                  <p className="text-sm text-white"><strong>Current Owner:</strong> {currentProperty.owner || 'None'}</p>
                  <p className="text-sm text-white"><strong>Current Rent:</strong> ${currentProperty.rent_site_only || 0}</p>
                </div>
              ) : (
                <p className="text-white text-sm">No property data available.</p>
              )}
            </div>
          </div>

          {/* Properties Section */}
          <div className={`w-full flex flex-col gap-6 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full flex flex-col gap-4">
              <h4 className='font-[700] font-dmSans text-[16px] text-[#F0F7F7]'>My Properties</h4>
              <div className="flex flex-col gap-3">
                <button
                  onClick={toggleProperties}
                  className="flex items-center justify-between w-full px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-[12px] text-[#F0F7F7] text-[13px] font-semibold font-dmSans hover:from-cyan-700 hover:to-teal-700 hover:shadow-[0_0_8px_rgba(45,212,191,0.3)] transition-all duration-300"
                  aria-label={isPropertiesOpen ? "Collapse My Empire" : "Expand My Empire"}
                >
                  <span>My Empire</span>
                  {isPropertiesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {isPropertiesOpen && (
                  <div className="w-full p-4 bg-[#0B191A]/90 backdrop-blur-sm rounded-[16px] shadow-lg border border-white/5">
                    {ownedPropertiesList.length > 0 ? (
                      <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar">
                        {ownedPropertiesList.map((property) => (
                          <li
                            key={property.id}
                            className="p-3 bg-[#131F25]/80 rounded-[12px] text-[#F0F7F7] text-[13px] flex items-center gap-3 hover:bg-gradient-to-r hover:from-[#1A262B]/80 hover:to-[#2A3A40]/80 hover:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all duration-300 cursor-pointer"
                            aria-label={`Select property ${property.name}`}
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: property.color || '#FFFFFF' }}
                            />
                            <div className="flex-1">
                              <span className="font-medium">{property.name}</span>
                              <span className="block text-[11px] text-[#A0B1B8]">
                                ID: {property.id} | Rent: ${property.rent_site_only} | Development: {property.development}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#A0B1B8] text-[13px] text-center">No properties owned yet.</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => openModal('property')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-green-700 to-emerald-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-green-800 hover:to-emerald-800 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Open property actions"
                >
                  <Plus className='w-4 h-4' />
                  Property
                </button>
                <button
                  onClick={() => openModal('management')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-purple-700 to-indigo-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-purple-800 hover:to-indigo-800 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label="Open property management actions"
                >
                  <Plus className='w-4 h-4' />
                  Management
                </button>
                <button
                  onClick={() => {}}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-red-700 to-pink-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-red-800 hover:to-pink-800 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Declare bankruptcy"
                  disabled={true}
                >
                  <Flag className='w-4 h-4' />
                  Bankruptcy
                </button>
              </div>
            </div>
          </div>

          {/* Trade Section */}
          <div className={`w-full flex flex-col gap-6 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full flex flex-col gap-4">
              <h4 className='font-[700] font-dmSans text-[16px] text-[#F0F7F7]'>Trade</h4>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => openModal('offerTrade')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-blue-700 to-indigo-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-blue-800 hover:to-indigo-800 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Open offer trade modal"
                >
                  <Handshake className='w-4 h-4' />
                  Offer Trade
                </button>
                <button
                  onClick={() => openModal('manageTrades')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-teal-700 to-cyan-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-teal-800 hover:to-cyan-800 hover:shadow-[0_0_12px_rgba(45,212,191,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Open manage trades modal"
                >
                  <CheckCircle className='w-4 h-4' />
                  Manage Trades
                </button>
                <button
                  onClick={() => openModal('counterTrade')}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-orange-700 to-red-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-orange-800 hover:to-red-800 hover:shadow-[0_0_12px_rgba(249,115,22,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
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

      {/* Offer Trade Modal */}
      {modalState.offerTrade && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0B191A] p-6 rounded-[16px] w-full max-w-md border border-white/10">
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Offer Trade</h3>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">To Player</label>
                <select
                  value={tradeInputs.to}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, to: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Select player to trade with"
                >
                  <option value="">Select Player</option>
                  {players
                    .filter((p) => p.address !== String(address).toLowerCase())
                    .map((p) => (
                      <option key={p.address} value={p.address}>
                        {p.username}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Offered Property IDs (comma-separated)</label>
                <input
                  type="text"
                  value={tradeInputs.offeredPropertyIds}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, offeredPropertyIds: e.target.value })}
                  placeholder="e.g., 1,3,5"
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Enter offered property IDs"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Requested Properties</label>
                <div className="max-h-40 overflow-y-auto bg-gray-800 rounded-md border border-gray-600 p-2">
                  {otherPlayersProperties.map((property) => (
                    <div key={property.id} className="flex items-center gap-2">
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
                        className="h-4 w-4 text-cyan-500 focus:ring-cyan-500"
                        aria-label={`Select property ${property.name}`}
                      />
                      <span className="text-sm text-gray-300">
                        {property.name} (ID: {property.id}, Owner: {property.ownerUsername})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Cash Amount</label>
                <input
                  type="number"
                  value={tradeInputs.cashAmount}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, cashAmount: e.target.value })}
                  placeholder="Enter cash amount"
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Enter cash amount for trade"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Cash Direction</label>
                <select
                  value={tradeInputs.cashDirection}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, cashDirection: e.target.value as 'offer' | 'request' })}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Select cash direction"
                >
                  <option value="offer">Offer Cash</option>
                  <option value="request">Request Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Trade Type</label>
                <select
                  value={tradeInputs.tradeType}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, tradeType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Select trade type"
                >
                  <option value="property_for_property">Property for Property</option>
                  <option value="property_for_cash">Property for Cash</option>
                  <option value="cash_for_property">Cash for Property</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-200"
                aria-label="Cancel trade offer"
              >
                Cancel
              </button>
              <button
                onClick={handleOfferTrade}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Submit trade offer"
              >
                {isLoading ? 'Submitting...' : 'Offer Trade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Trades Modal */}
      {modalState.manageTrades && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0B191A] p-6 rounded-[16px] w-full max-w-md border border-white/10">
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Manage Trades</h3>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Trade ID</label>
                <input
                  type="number"
                  value={tradeInputs.tradeId}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, tradeId: e.target.value })}
                  placeholder="Enter trade ID"
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Enter trade ID to manage"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-200"
                aria-label="Cancel manage trades"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptTrade}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-green-700 to-emerald-700 text-white rounded-md hover:from-green-800 hover:to-emerald-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Accept trade"
              >
                {isLoading ? 'Processing...' : 'Accept'}
              </button>
              <button
                onClick={handleRejectTrade}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Reject trade"
              >
                {isLoading ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={handleApproveCounterTrade}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-md hover:from-purple-800 hover:to-indigo-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Approve counter trade"
              >
                {isLoading ? 'Processing...' : 'Approve Counter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter Trade Modal */}
      {modalState.counterTrade && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0B191A] p-6 rounded-[16px] w-full max-w-md border border-white/10">
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Counter Trade</h3>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Original Trade ID</label>
                <input
                  type="number"
                  value={tradeInputs.originalOfferId}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, originalOfferId: e.target.value })}
                  placeholder="Enter original trade ID"
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Enter original trade ID"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Offered Property IDs (comma-separated)</label>
                <input
                  type="text"
                  value={tradeInputs.offeredPropertyIds}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, offeredPropertyIds: e.target.value })}
                  placeholder="e.g., 1,3,5"
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Enter offered property IDs for counter trade"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Requested Property IDs (comma-separated)</label>
                <input
                  type="text"
                  value={tradeInputs.requestedPropertyIds}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, requestedPropertyIds: e.target.value })}
                  placeholder="e.g., 2,4,6"
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Enter requested property IDs for counter trade"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Cash Amount</label>
                <input
                  type="number"
                  value={tradeInputs.cashAmount}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, cashAmount: e.target.value })}
                  placeholder="Enter cash amount"
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Enter cash amount for counter trade"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Cash Direction</label>
                <select
                  value={tradeInputs.cashDirection}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, cashDirection: e.target.value as 'offer' | 'request' })}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Select cash direction for counter trade"
                >
                  <option value="offer">Offer Cash</option>
                  <option value="request">Request Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Trade Type</label>
                <select
                  value={tradeInputs.tradeType}
                  onChange={(e) => setTradeInputs({ ...tradeInputs, tradeType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Select trade type for counter trade"
                >
                  <option value="property_for_property">Property for Property</option>
                  <option value="property_for_cash">Property for Cash</option>
                  <option value="cash_for_property">Cash for Property</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-200"
                aria-label="Cancel counter trade"
              >
                Cancel
              </button>
              <button
                onClick={handleCounterTrade}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-orange-700 to-red-700 text-white rounded-md hover:from-orange-800 hover:to-red-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Submit counter trade"
              >
                {isLoading ? 'Submitting...' : 'Counter Trade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Actions Modal */}
      {modalState.property && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0B191A] p-6 rounded-[16px] w-full max-w-md border border-white/10">
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Property Actions</h3>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-200"
                aria-label="Cancel property action"
              >
                Cancel
              </button>
              {currentProperty?.type === 'property' && !currentProperty.owner && (
                <button
                  onClick={handleBuyProperty}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-green-700 to-emerald-700 text-white rounded-md hover:from-green-800 hover:to-emerald-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Buy property"
                >
                  {isLoading ? 'Processing...' : 'Buy Property'}
                </button>
              )}
              {currentProperty?.name === 'Tax' && (
                <button
                  onClick={handlePayTax}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-gradient-to-r from-yellow-700 to-amber-700 text-white rounded-md hover:from-yellow-800 hover:to-amber-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Pay tax"
                >
                  {isLoading ? 'Processing...' : 'Pay Tax'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Property Management Modal */}
      {modalState.management && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0B191A] p-6 rounded-[16px] w-full max-w-md border border-white/10">
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Property Management</h3>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-200"
                aria-label="Cancel property management"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyHouse}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Buy house"
              >
                {isLoading ? 'Processing...' : 'Buy House'}
              </button>
              <button
                onClick={handleBuyHotel}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Buy hotel"
              >
                {isLoading ? 'Processing...' : 'Buy Hotel'}
              </button>
              <button
                onClick={handleSellHouse}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Sell house"
              >
                {isLoading ? 'Processing...' : 'Sell House'}
              </button>
              <button
                onClick={handleSellHotel}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Sell hotel"
              >
                {isLoading ? 'Processing...' : 'Sell Hotel'}
              </button>
              <button
                onClick={handleMortgageProperty}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-yellow-700 to-amber-700 text-white rounded-md hover:from-yellow-800 hover:to-amber-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Mortgage property"
              >
                {isLoading ? 'Processing...' : 'Mortgage'}
              </button>
              <button
                onClick={handleUnmortgageProperty}
                disabled={isLoading}
                className={`px-4 py-2 bg-gradient-to-r from-green-700 to-emerald-700 text-white rounded-md hover:from-green-800 hover:to-emerald-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Unmortgage property"
              >
                {isLoading ? 'Processing...' : 'Unmortgage'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Players