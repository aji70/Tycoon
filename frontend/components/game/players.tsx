'use client'
import { ChevronLeft, Flag, Plus, Handshake, CheckCircle, Repeat, ChevronDown, ChevronUp } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { PiUsersThree } from 'react-icons/pi';
import { boardData } from '@/data/board-data'; // Assuming boardData is available

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

interface Player {
  id: number;
  name: string;
  username: string;
  position: number;
  balance: number;
  jailed: boolean;
  properties_owned: number[];
  isNext: boolean;
  token: string;
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
}

interface OwnedProperty {
  owner: string;
  ownerUsername: string;
  token: string;
}

const Players = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
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
  const [modalState, setModalState] = useState({
    offerTrade: false,
    manageTrades: false,
    counterTrade: false,
    property: false,
    management: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');

  // Mock player data (8 players)
  const [players, setPlayers] = useState<Player[]>([
    { id: 0, name: 'Aji', username: 'Aji', position: 0, balance: 1500, jailed: false, properties_owned: [1, 3], isNext: true, token: '🚗' },
    { id: 1, name: 'Signor', username: 'Signor', position: 5, balance: 1200, jailed: false, properties_owned: [], isNext: false, token: '🚢' },
    { id: 2, name: 'Luna', username: 'Luna', position: 10, balance: 1800, jailed: false, properties_owned: [5], isNext: false, token: '🐶' },
    { id: 3, name: 'Rex', username: 'Rex', position: 15, balance: 900, jailed: true, properties_owned: [], isNext: false, token: '🎩' },
    { id: 4, name: 'Mira', username: 'Mira', position: 20, balance: 2000, jailed: false, properties_owned: [7, 9], isNext: false, token: '🐱' },
    { id: 5, name: 'Zoe', username: 'Zoe', position: 25, balance: 1100, jailed: false, properties_owned: [], isNext: false, token: '🚲' },
    { id: 6, name: 'Finn', username: 'Finn', position: 30, balance: 1600, jailed: false, properties_owned: [11], isNext: false, token: '🛩️' },
    { id: 7, name: 'Tara', username: 'Tara', position: 35, balance: 1300, jailed: false, properties_owned: [], isNext: false, token: '🚀' },
  ]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentProperty, setCurrentProperty] = useState<Property | null>({
    id: 0,
    name: 'Go',
    type: 'corner',
    owner: null,
    ownerUsername: null,
    rent_site_only: 0,
  });
  const [ownedProperties, setOwnedProperties] = useState<{ [key: number]: OwnedProperty }>({});

  // Determine the winning player (highest balance)
  const winningPlayerId = useMemo(() => {
    return players.reduce((max, player) => player.balance > max.balance ? player : max, players[0]).id;
  }, [players]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleProperties = () => {
    setIsPropertiesOpen(!isPropertiesOpen);
  };

  const openModal = (modal: keyof typeof modalState) => {
    setModalState({
      offerTrade: false,
      manageTrades: false,
      counterTrade: false,
      property: false,
      management: false,
      [modal]: true,
    });
  };

  const handleOfferTrade = () => {
    if (!tradeInputs.to || !tradeInputs.offeredPropertyIds || !tradeInputs.requestedPropertyIds) {
      setError('Please fill all trade fields.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log('Offering trade:', tradeInputs);
    setTradeInputs({
      to: '',
      offeredPropertyIds: '',
      requestedPropertyIds: '',
      cashOffer: '0',
      cashRequest: '0',
      tradeType: '0',
      tradeId: '',
      originalOfferId: '',
    });
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, offerTrade: false }));
  };

  const handleAcceptTrade = () => {
    if (!tradeInputs.tradeId) {
      setError('Please enter a trade ID.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Accepting trade ID ${tradeInputs.tradeId}`);
    setTradeInputs((prev) => ({ ...prev, tradeId: '' }));
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, manageTrades: false }));
  };

  const handleRejectTrade = () => {
    if (!tradeInputs.tradeId) {
      setError('Please enter a trade ID.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Rejecting trade ID ${tradeInputs.tradeId}`);
    setTradeInputs((prev) => ({ ...prev, tradeId: '' }));
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, manageTrades: false }));
  };

  const handleCounterTrade = () => {
    if (!tradeInputs.originalOfferId || !tradeInputs.offeredPropertyIds || !tradeInputs.requestedPropertyIds) {
      setError('Please fill all counter trade fields.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log('Countering trade:', tradeInputs);
    setTradeInputs({
      to: '',
      offeredPropertyIds: '',
      requestedPropertyIds: '',
      cashOffer: '0',
      cashRequest: '0',
      tradeType: '0',
      tradeId: '',
      originalOfferId: '',
    });
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, counterTrade: false }));
  };

  const handleApproveCounterTrade = () => {
    if (!tradeInputs.tradeId) {
      setError('Please enter a trade ID.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Approving counter trade ID ${tradeInputs.tradeId}`);
    setTradeInputs((prev) => ({ ...prev, tradeId: '' }));
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, manageTrades: false }));
  };

  const handleBuyProperty = () => {
    if (!propertyId || !currentProperty || currentProperty.owner) {
      setError('Cannot buy: Invalid property ID or property already owned.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const square = boardData.find((s) => s.id === Number(propertyId));
    if (square && square.type === 'property' && square.cost) {
      setPlayers((prevPlayers) => {
        const newPlayers = [...prevPlayers];
        const currentPlayer = { ...newPlayers[currentPlayerIndex] };
        if (currentPlayer.balance >= square.cost) {
          currentPlayer.balance -= square.cost;
          currentPlayer.properties_owned.push(square.id);
          newPlayers[currentPlayerIndex] = currentPlayer;
          setOwnedProperties((prev) => ({
            ...prev,
            [square.id]: {
              owner: currentPlayer.username,
              ownerUsername: currentPlayer.username,
              token: currentPlayer.token,
            },
          }));
          setCurrentProperty((prev) => prev ? { ...prev, owner: currentPlayer.username, ownerUsername: currentPlayer.username } : null);
        } else {
          setError('Insufficient balance to buy property.');
        }
        return newPlayers;
      });
    }
    setPropertyId('');
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, property: false }));
  };

  const handlePayTax = () => {
    if (!propertyId || !currentProperty || currentProperty.name !== 'Tax') {
      setError('Invalid tax square or property ID.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const square = boardData.find((s) => s.id === Number(propertyId));
    if (square && square.type === 'special' && square.cost) {
      setPlayers((prevPlayers) => {
        const newPlayers = [...prevPlayers];
        const currentPlayer = { ...newPlayers[currentPlayerIndex] };
        if (currentPlayer.balance >= square.cost) {
          currentPlayer.balance -= square.cost;
          newPlayers[currentPlayerIndex] = currentPlayer;
        } else {
          setError('Insufficient balance to pay tax.');
        }
        return newPlayers;
      });
    }
    setPropertyId('');
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, property: false }));
  };

  const handleBuyHouseOrHotel = () => {
    if (!propertyId || ownedProperties[Number(propertyId)]?.owner !== players[currentPlayerIndex].username) {
      setError('Cannot buy house or hotel: Invalid property ID or not owned.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Buying house/hotel for property ${propertyId}`);
    setPropertyId('');
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, management: false }));
  };

  const handleSellHouseOrHotel = () => {
    if (!propertyId || ownedProperties[Number(propertyId)]?.owner !== players[currentPlayerIndex].username) {
      setError('Cannot sell house or hotel: Invalid property ID or not owned.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Selling house/hotel for property ${propertyId}`);
    setPropertyId('');
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, management: false }));
  };

  const handleMortgageProperty = () => {
    if (!propertyId || ownedProperties[Number(propertyId)]?.owner !== players[currentPlayerIndex].username) {
      setError('Cannot mortgage: Invalid property ID or not owned.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const square = boardData.find((s) => s.id === Number(propertyId));
    if (square && square.mortgage) {
      setPlayers((prevPlayers) => {
        const newPlayers = [...prevPlayers];
        const currentPlayer = { ...newPlayers[currentPlayerIndex] };
        currentPlayer.balance += square.mortgage;
        newPlayers[currentPlayerIndex] = currentPlayer;
        return newPlayers;
      });
    }
    setPropertyId('');
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, management: false }));
  };

  const handleUnmortgageProperty = () => {
    if (!propertyId) {
      setError('Cannot unmortgage: Invalid property ID.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const square = boardData.find((s) => s.id === Number(propertyId));
    if (square && square.mortgage) {
      setPlayers((prevPlayers) => {
        const newPlayers = [...prevPlayers];
        const currentPlayer = { ...newPlayers[currentPlayerIndex] };
        const unmortgageCost = Math.floor(square.mortgage * 1.1);
        if (currentPlayer.balance >= unmortgageCost) {
          currentPlayer.balance -= unmortgageCost;
          newPlayers[currentPlayerIndex] = currentPlayer;
        } else {
          setError('Insufficient balance to unmortgage property.');
        }
        return newPlayers;
      });
    }
    setPropertyId('');
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, management: false }));
  };

  // Get owned properties for display
  const ownedPropertiesList = players[currentPlayerIndex].properties_owned.map((id) => {
    const property = boardData.find((p) => p.id === id);
    return property || { id, name: `Property ${id}`, type: 'unknown', owner: players[currentPlayerIndex].username, ownerUsername: players[currentPlayerIndex].username, rent_site_only: 0, color: '#FFFFFF' };
  });

  return (
    <>
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute top-0 left-0 bg-[#010F10] z-10 lg:hidden text-[#F0F7F7] w-[44px] h-[44px] rounded-e-[12px] flex items-center justify-center border-[1px] border-white/10 transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-900 hover:to-indigo-900 hover:shadow-md"
          aria-label="Toggle sidebar"
        >
          <PiUsersThree className="w-6 h-6" />
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
            <button onClick={toggleSidebar} className="text-[#F0F7F7] lg:hidden transition-colors duration-300 hover:text-cyan-300" aria-label="Toggle sidebar">
              {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <PiUsersThree className="size-[28px]" />}
            </button>
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
                      index === currentPlayerIndex ? 'border-l-4 border-cyan-300' : ''
                    }`}
                    aria-label={`Player ${player.name}${player.id === winningPlayerId ? ' (Leader)' : ''}`}
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: player.token === '🚗' ? '#FFBE04' : player.token === '🚢' ? '#0E8AED' : player.token === '🐶' ? '#A52A2A' : player.token === '🎩' ? '#000000' : player.token === '🐱' ? '#FFD700' : player.token === '🚲' ? '#228B22' : player.token === '🛩️' ? '#4682B4' : '#FF4500' }} />
                    <div className="flex-1">
                      <span className="font-medium">
                        {player.name}
                        {player.id === winningPlayerId && <span className="ml-2 text-yellow-400">👑</span>}
                        {index === currentPlayerIndex && <span className="text-[11px] text-cyan-300"> (Me)</span>}
                      </span>
                      <span className="block text-[11px] text-[#A0B1B8]">
                        Position: {player.position} | Balance: ${player.balance}
                        {player.jailed && <span className="ml-2 text-red-400">(Jailed)</span>}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Properties Section */}
          <div className={`w-full flex flex-col gap-6 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full flex flex-col gap-4">
              <h4 className='font-[700] font-dmSans text-[16px] text-[#F0F7F7]'>My Properties</h4>
              <div className="flex flex-col gap-3">
                {/* My Empire Dropdown */}
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
                            onClick={() => setPropertyId(property.id.toString())}
                            aria-label={`Select property ${property.name}`}
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: property.color || '#FFFFFF' }}
                            />
                            <div className="flex-1">
                              <span className="font-medium">{property.name}</span>
                              <span className="block text-[11px] text-[#A0B1B8]">ID: {property.id} | Rent: ${property.rent_site_only}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#A0B1B8] text-[13px] text-center">No properties owned yet.</p>
                    )}
                  </div>
                )}
                {/* Property Actions */}
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
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-purple-700 to-indigo-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-purple-800 hover:to-indigo-800 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label="Open counter trade modal"
                >
                  <Repeat className='w-4 h-4' />
                  Counter Trade
                </button>
              </div>
            </div>
          </div>

          {/* Offer Trade Modal */}
          {modalState.offerTrade && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-8 rounded-[16px] w-full max-w-[360px] bg-[#0B191A]/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-white/10 overflow-y-auto max-h-[85vh]"
            >
              <h2 className="text-xl font-semibold text-cyan-300 mb-5">Offer Trade</h2>
              {isLoading && <p className="text-cyan-300 text-[13px] text-center mb-4">Loading...</p>}
              {error && <p className="text-red-400 text-[13px] text-center mb-4">{error}</p>}
              <div className="mb-5 space-y-3">
                <input
                  type="text"
                  placeholder="To Player Username"
                  value={tradeInputs.to}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, to: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter recipient username"
                />
                <input
                  type="text"
                  placeholder="Offered Property IDs"
                  value={tradeInputs.offeredPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, offeredPropertyIds: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter offered property IDs"
                />
                <input
                  type="text"
                  placeholder="Requested Property IDs"
                  value={tradeInputs.requestedPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, requestedPropertyIds: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter requested property IDs"
                />
                <input
                  type="number"
                  placeholder="Cash Offer"
                  value={tradeInputs.cashOffer}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashOffer: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter cash offer amount"
                />
                <input
                  type="number"
                  placeholder="Cash Request"
                  value={tradeInputs.cashRequest}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashRequest: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter cash request amount"
                />
                <button
                  onClick={handleOfferTrade}
                  aria-label="Offer a trade"
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-blue-700 hover:to-indigo-700 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Offer Trade
                </button>
              </div>
              <button
                onClick={() => setModalState((prev) => ({ ...prev, offerTrade: false }))}
                aria-label="Close offer trade modal"
                className="w-full px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-gray-700 hover:to-gray-900 hover:shadow-[0_0_12px_rgba(107,114,128,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          )}

          {/* Manage Trades Modal */}
          {modalState.manageTrades && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-8 rounded-[16px] w-full max-w-[360px] bg-[#0B191A]/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-white/10 overflow-y-auto max-h-[85vh]"
            >
              <h2 className="text-xl font-semibold text-cyan-300 mb-5">Manage Trades</h2>
              {isLoading && <p className="text-cyan-300 text-[13px] text-center mb-4">Loading...</p>}
              {error && <p className="text-red-400 text-[13px] text-center mb-4">{error}</p>}
              <div className="mb-5">
                <input
                  type="text"
                  placeholder="Trade ID"
                  value={tradeInputs.tradeId}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, tradeId: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter trade ID"
                />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button
                    onClick={handleAcceptTrade}
                    aria-label="Accept a trade"
                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-green-700 hover:to-emerald-700 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Accept
                  </button>
                  <button
                    onClick={handleRejectTrade}
                    aria-label="Reject a trade"
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-red-700 hover:to-pink-700 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApproveCounterTrade}
                    aria-label="Approve a counter trade"
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-teal-700 hover:to-cyan-700 hover:shadow-[0_0_12px_rgba(45,212,191,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 col-span-2"
                  >
                    Approve Counter
                  </button>
                </div>
              </div>
              <button
                onClick={() => setModalState((prev) => ({ ...prev, manageTrades: false }))}
                aria-label="Close manage trades modal"
                className="w-full px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-gray-700 hover:to-gray-900 hover:shadow-[0_0_12px_rgba(107,114,128,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          )}

          {/* Counter Trade Modal */}
          {modalState.counterTrade && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-8 rounded-[16px] w-full max-w-[360px] bg-[#0B191A]/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-white/10 overflow-y-auto max-h-[85vh]"
            >
              <h2 className="text-xl font-semibold text-cyan-300 mb-5">Counter Trade</h2>
              {isLoading && <p className="text-cyan-300 text-[13px] text-center mb-4">Loading...</p>}
              {error && <p className="text-red-400 text-[13px] text-center mb-4">{error}</p>}
              <div className="mb-5 space-y-3">
                <input
                  type="text"
                  placeholder="Original Offer ID"
                  value={tradeInputs.originalOfferId}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, originalOfferId: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter original offer ID"
                />
                <input
                  type="text"
                  placeholder="Offered Property IDs"
                  value={tradeInputs.offeredPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, offeredPropertyIds: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter offered property IDs"
                />
                <input
                  type="text"
                  placeholder="Requested Property IDs"
                  value={tradeInputs.requestedPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, requestedPropertyIds: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter requested property IDs"
                />
                <input
                  type="number"
                  placeholder="Cash Offer"
                  value={tradeInputs.cashOffer}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashOffer: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter cash offer amount"
                />
                <input
                  type="number"
                  placeholder="Cash Request"
                  value={tradeInputs.cashRequest}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashRequest: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                  aria-label="Enter cash request amount"
                />
                <button
                  onClick={handleCounterTrade}
                  aria-label="Counter a trade"
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-purple-700 hover:to-indigo-700 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Counter Trade
                </button>
              </div>
              <button
                onClick={() => setModalState((prev) => ({ ...prev, counterTrade: false }))}
                aria-label="Close counter trade modal"
                className="w-full px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-gray-700 hover:to-gray-900 hover:shadow-[0_0_12px_rgba(107,114,128,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          )}

          {/* Property Actions Modal */}
          {modalState.property && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-8 rounded-[16px] w-full max-w-[360px] bg-[#0B191A]/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-white/10 overflow-y-auto max-h-[85vh]"
            >
              <h2 className="text-xl font-semibold text-cyan-300 mb-5">Property Actions</h2>
              {isLoading && <p className="text-cyan-300 text-[13px] text-center mb-4">Loading...</p>}
              {error && <p className="text-red-400 text-[13px] text-center mb-4">{error}</p>}
              <input
                type="number"
                placeholder="Property ID"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                aria-label="Enter property ID"
              />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button
                  onClick={handleBuyProperty}
                  aria-label="Buy the property"
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-green-700 hover:to-emerald-700 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Buy
                </button>
                <button
                  onClick={handlePayTax}
                  aria-label="Pay tax for the square"
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-purple-700 hover:to-violet-700 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Pay Tax
                </button>
                <button
                  onClick={() => setModalState((prev) => ({ ...prev, property: false }))}
                  aria-label="Close property actions"
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-gray-700 hover:to-gray-900 hover:shadow-[0_0_12px_rgba(107,114,128,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500 col-span-2"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Property Management Modal */}
          {modalState.management && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-8 rounded-[16px] w-full max-w-[360px] bg-[#0B191A]/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-white/10 overflow-y-auto max-h-[85vh]"
            >
              <h2 className="text-xl font-semibold text-cyan-300 mb-5">Property Management</h2>
              {isLoading && <p className="text-cyan-300 text-[13px] text-center mb-4">Loading...</p>}
              {error && <p className="text-red-400 text-[13px] text-center mb-4">{error}</p>}
              <input
                type="number"
                placeholder="Property ID"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
                aria-label="Enter property ID"
              />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button
                  onClick={handleBuyHouseOrHotel}
                  aria-label="Buy a house or hotel"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-indigo-700 hover:to-purple-700 hover:shadow-[0_0_12px_rgba(99,102,241,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Buy House/Hotel
                </button>
                <button
                  onClick={handleSellHouseOrHotel}
                  aria-label="Sell a house or hotel"
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-amber-700 hover:to-orange-700 hover:shadow-[0_0_12px_rgba(249,115,22,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  Sell House/Hotel
                </button>
                <button
                  onClick={handleMortgageProperty}
                  aria-label="Mortgage the property"
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-gray-700 hover:to-gray-900 hover:shadow-[0_0_12px_rgba(107,114,128,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-600"
                >
                  Mortgage
                </button>
                <button
                  onClick={handleUnmortgageProperty}
                  aria-label="Unmortgage the property"
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-green-700 hover:to-emerald-700 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Unmortgage
                </button>
                <button
                  onClick={() => setModalState((prev) => ({ ...prev, management: false }))}
                  aria-label="Close property management actions"
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-gray-700 hover:to-gray-900 hover:shadow-[0_0_12px_rgba(107,114,128,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500 col-span-2"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default Players