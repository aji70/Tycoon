'use client'
import { Check, ChevronLeft, CircleAlert, Flag, Plus } from 'lucide-react'
import React, { useState } from 'react'
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
}

interface OwnedProperty {
  owner: string;
  ownerUsername: string;
  token: string;
}

const Players = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    trade: false,
    property: false,
    management: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [showTradeInfo, setShowTradeInfo] = useState(true);
  const [showPropertiesInfo, setShowPropertiesInfo] = useState(true);

  // Mock player data
  const [players, setPlayers] = useState<Player[]>([
    {
      id: 0,
      name: 'Aji',
      username: 'Aji',
      position: 0,
      balance: 1500,
      jailed: false,
      properties_owned: [],
      isNext: true,
      token: '🚗',
    },
    {
      id: 1,
      name: 'Signor',
      username: 'Signor',
      position: 0,
      balance: 1500,
      jailed: false,
      properties_owned: [],
      isNext: false,
      token: '🚢',
    },
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

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
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
    setModalState((prev) => ({ ...prev, trade: false }));
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
    setModalState((prev) => ({ ...prev, trade: false }));
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
    setModalState((prev) => ({ ...prev, trade: false }));
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
    setModalState((prev) => ({ ...prev, trade: false }));
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
    setModalState((prev) => ({ ...prev, trade: false }));
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

  const handlePayRent = () => {
    if (!propertyId || !currentProperty || !currentProperty.owner) {
      setError('Cannot pay rent: No owner or invalid property.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const square = boardData.find((s) => s.id === Number(propertyId));
    if (square && square.type === 'property' && square.rent_site_only) {
      setPlayers((prevPlayers) => {
        const newPlayers = [...prevPlayers];
        const currentPlayer = { ...newPlayers[currentPlayerIndex] };
        const owner = newPlayers.find((p) => p.username === currentProperty.owner);
        if (currentPlayer.balance >= square.rent_site_only && owner) {
          currentPlayer.balance -= square.rent_site_only;
          owner.balance += square.rent_site_only;
          newPlayers[currentPlayerIndex] = currentPlayer;
          newPlayers[players.indexOf(owner)] = owner;
        } else {
          setError('Insufficient balance to pay rent.');
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

  return (
    <>
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute top-0 left-0 bg-[#010F10] z-10 lg:hidden text-[#869298] hover:text-[#F0F7F7] w-[40px] h-[40px] rounded-e-[8px] flex items-center justify-center border-[1px] border-white/10 transition-all duration-200 hover:bg-[#131F25]"
          aria-label="Toggle sidebar"
        >
          <PiUsersThree className="w-5 h-5" />
        </button>
      )}
      <aside
        className={`
          h-full overflow-y-auto no-scrollbar bg-[#010F10] px-4 pb-10 rounded-e-[12px] border-r-[1px] border-white/10
          transition-all duration-300 ease-in-out
          fixed z-20 top-0 left-0 
          transform ${isSidebarOpen ? 'translate-x-0 lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:static lg:transform-none
          ${isSidebarOpen ? 'lg:w-[272px] md:w-1/2 w-full' : 'lg:w-[60px] w-full'}
        `}
      >
        <div className="w-full h-full flex flex-col gap-6">
          <div className="w-full sticky top-0 bg-[#010F10] py-4 flex justify-between items-center">
            <h4 className={`font-[700] font-dmSans md:text-[16px] text-[14px] text-[#F0F7F7] ${!isSidebarOpen && 'hidden'}`}>
              Players
            </h4>
            <button onClick={toggleSidebar} className="text-[#869298] hover:text-[#F0F7F7] lg:hidden transition-colors duration-200" aria-label="Toggle sidebar">
              {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <PiUsersThree className="size-[25px]" />}
            </button>
          </div>

          {/* Player */}
          <div className={`
            w-full flex flex-col gap-3 bg-[#0B191A] p-3 rounded-[12px]
            transition-opacity duration-200
            ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}>
            <div className="flex items-center gap-2">
              <div className="size-[32px] rounded-full bg-[#FFBE04] shadow-md" />
              <span className='text-[#F0F7F7] font-medium font-dmSans text-[16px]'>Aji <span className='text-[10px]'>(Me)</span></span>
            </div>
            <button
              type="button"
              className='w-[118px] h-[29px] border-[1px] border-[#003B3E] rounded-[20px] bg-transparent text-[#869298] hover:text-[#F0F7F7] hover:bg-[#131F25] self-end text-[10px] cursor-pointer transition-all duration-200'
              aria-label="Change player appearance"
            >
              Change appearance
            </button>
          </div>

          {/* Another player */}
          <div className={`
            w-full flex flex-col gap-3 bg-[#0B191A] p-3 rounded-[12px]
            transition-opacity duration-200
            ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}>
            <div className="flex items-center gap-2">
              <div className="size-[32px] rounded-full bg-[#0E8AED] shadow-md" />
              <span className='text-[#F0F7F7] font-medium font-dmSans text-[16px]'>Signor</span>
            </div>
          </div>

          {/* Trade Section */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full flex justify-between items-center">
              <h4 className='font-[700] font-dmSans text-[14px] text-[#F0F7F7]'>Trade</h4>
              <button
                onClick={() => setModalState((prev) => ({ ...prev, trade: true }))}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[12px] font-medium font-dmSans flex items-center gap-1 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Open trade actions"
              >
                <Plus className='w-4 h-4' />
                Trade
              </button>
            </div>
            {showTradeInfo && (
              <div className="w-full p-3 bg-[#0B191A] rounded-[12px] shadow-sm">
                <div className="bg-[#131F25] w-full flex flex-col items-center p-3 rounded-[8px] gap-3">
                  <p className='text-[#73838B] text-[11px] text-center'>
                    <CircleAlert className='w-3 h-3 inline mr-1' />Make trades with other players to exchange properties, money, and bonus cards. Use the &quot;Trade&quot; button to create a new trade.
                  </p>
                  <button
                    onClick={() => setShowTradeInfo(false)}
                    className='px-3 py-1 rounded-[20px] bg-[#263238] text-[#869298] hover:text-[#F0F7F7] hover:bg-[#2A3A40] flex items-center gap-1 text-[10px] transition-all duration-200'
                    aria-label="Dismiss trade info"
                  >
                    <Check className='w-3 h-3' />
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Trade Actions Modal */}
          {modalState.trade && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-6 rounded-lg w-full max-w-[340px] bg-[#0B191A] shadow-2xl shadow-cyan-500/10 overflow-y-auto max-h-[80vh]"
            >
              <h2 className="text-lg font-semibold text-cyan-300 mb-4">Trade Actions</h2>
              {isLoading && <p className="text-cyan-300 text-xs text-center mb-3">Loading...</p>}
              {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-cyan-300 mb-2">Offer Trade</h3>
                <input
                  type="text"
                  placeholder="To Player Username"
                  value={tradeInputs.to}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter recipient username"
                />
                <input
                  type="text"
                  placeholder="Offered Property IDs"
                  value={tradeInputs.offeredPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, offeredPropertyIds: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter offered property IDs"
                />
                <input
                  type="text"
                  placeholder="Requested Property IDs"
                  value={tradeInputs.requestedPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, requestedPropertyIds: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter requested property IDs"
                />
                <input
                  type="number"
                  placeholder="Cash Offer"
                  value={tradeInputs.cashOffer}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashOffer: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter cash offer amount"
                />
                <input
                  type="number"
                  placeholder="Cash Request"
                  value={tradeInputs.cashRequest}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashRequest: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter cash request amount"
                />
                <button
                  onClick={handleOfferTrade}
                  aria-label="Offer a trade"
                  className="w-full px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Offer Trade
                </button>
              </div>
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-cyan-300 mb-2">Manage Trades</h3>
                <input
                  type="text"
                  placeholder="Trade ID"
                  value={tradeInputs.tradeId}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, tradeId: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter trade ID"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleAcceptTrade}
                    aria-label="Accept a trade"
                    className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Accept
                  </button>
                  <button
                    onClick={handleRejectTrade}
                    aria-label="Reject a trade"
                    className="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full hover:from-red-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApproveCounterTrade}
                    aria-label="Approve a counter trade"
                    className="px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs rounded-full hover:from-teal-600 hover:to-cyan-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 col-span-2"
                  >
                    Approve Counter
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-cyan-300 mb-2">Counter Trade</h3>
                <input
                  type="text"
                  placeholder="Original Offer ID"
                  value={tradeInputs.originalOfferId}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, originalOfferId: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter original offer ID"
                />
                <input
                  type="text"
                  placeholder="Offered Property IDs"
                  value={tradeInputs.offeredPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, offeredPropertyIds: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter offered property IDs"
                />
                <input
                  type="text"
                  placeholder="Requested Property IDs"
                  value={tradeInputs.requestedPropertyIds}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, requestedPropertyIds: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter requested property IDs"
                />
                <input
                  type="number"
                  placeholder="Cash Offer"
                  value={tradeInputs.cashOffer}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashOffer: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter cash offer amount"
                />
                <input
                  type="number"
                  placeholder="Cash Request"
                  value={tradeInputs.cashRequest}
                  onChange={(e) => setTradeInputs((prev) => ({ ...prev, cashRequest: e.target.value }))}
                  className="w-full px-3 py-2 mb-2 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                  aria-label="Enter cash request amount"
                />
                <button
                  onClick={handleCounterTrade}
                  aria-label="Counter a trade"
                  className="w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs rounded-full hover:from-purple-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Counter Trade
                </button>
              </div>
              <button
                onClick={() => setModalState((prev) => ({ ...prev, trade: false }))}
                aria-label="Close trade actions"
                className="w-full px-3 py-2 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          )}

          {/* Properties Section */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h4 className='font-[700] font-dmSans text-[14px] text-[#F0F7F7]'>My Properties</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setModalState((prev) => ({ ...prev, property: true }))}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 text-white text-[12px] font-medium font-dmSans flex items-center gap-1 hover:from-green-700 hover:to-emerald-700 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                    aria-label="Open property actions"
                  >
                    <Plus className='w-4 h-4' />
                    Property
                  </button>
                  <button
                    onClick={() => setModalState((prev) => ({ ...prev, management: true }))}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[12px] font-medium font-dmSans flex items-center gap-1 hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label="Open property management actions"
                  >
                    <Plus className='w-4 h-4' />
                    Management
                  </button>
                  <button
                    onClick={() => {}}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-red-600 to-pink-600 text-white text-[12px] font-medium font-dmSans flex items-center gap-1 hover:from-red-700 hover:to-pink-700 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Declare bankruptcy"
                  >
                    <Flag className='w-4 h-4' />
                    Bankruptcy
                  </button>
                </div>
              </div>
            </div>
            {showPropertiesInfo && (
              <div className="w-full p-3 bg-[#0B191A] rounded-[12px] shadow-sm">
                <div className="bg-[#131F25] w-full flex flex-col items-center p-3 rounded-[8px] gap-3">
                  <p className='text-[#73838B] text-[11px] text-center'>
                    <CircleAlert className='w-3 h-3 inline mr-1' />You can start building houses on your property when you have a complete set.
                  </p>
                  <p className='text-[#73838B] text-[11px] text-center'>
                    Click on a property to upgrade, downgrade, or sell it.
                  </p>
                  <button
                    onClick={() => setShowPropertiesInfo(false)}
                    className='px-3 py-1 rounded-[20px] bg-[#263238] text-[#869298] hover:text-[#F0F7F7] hover:bg-[#2A3A40] flex items-center gap-1 text-[10px] transition-all duration-200'
                    aria-label="Dismiss properties info"
                  >
                    <Check className='w-3 h-3' />
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Property Actions Modal */}
          {modalState.property && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-6 rounded-lg w-full max-w-[340px] bg-[#0B191A] shadow-2xl shadow-cyan-500/10 overflow-y-auto max-h-[80vh]"
            >
              <h2 className="text-lg font-semibold text-cyan-300 mb-4">Property Actions</h2>
              {isLoading && <p className="text-cyan-300 text-xs text-center mb-3">Loading...</p>}
              {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}
              <input
                type="number"
                placeholder="Property ID"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 mb-3 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                aria-label="Enter property ID"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleBuyProperty}
                  aria-label="Buy the property"
                  className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Buy
                </button>
                <button
                  onClick={handlePayRent}
                  aria-label="Pay rent for the property"
                  className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs rounded-full hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  Pay Rent
                </button>
                <button
                  onClick={handlePayTax}
                  aria-label="Pay tax for the square"
                  className="px-3 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs rounded-full hover:from-purple-600 hover:to-violet-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 col-span-2"
                >
                  Pay Tax
                </button>
                <button
                  onClick={() => setModalState((prev) => ({ ...prev, property: false }))}
                  aria-label="Close property actions"
                  className="px-3 py-2 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 col-span-2"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Property Management Modal */}
          {modalState.management && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-6 rounded-lg w-full max-w-[340px] bg-[#0B191A] shadow-2xl shadow-cyan-500/10 overflow-y-auto max-h-[80vh]"
            >
              <h2 className="text-lg font-semibold text-cyan-300 mb-4">Property Management</h2>
              {isLoading && <p className="text-cyan-300 text-xs text-center mb-3">Loading...</p>}
              {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}
              <input
                type="number"
                placeholder="Property ID"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 mb-3 bg-gray-800 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                aria-label="Enter property ID"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleBuyHouseOrHotel}
                  aria-label="Buy a house or hotel"
                  className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded-full hover:from-indigo-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Buy House/Hotel
                </button>
                <button
                  onClick={handleSellHouseOrHotel}
                  aria-label="Sell a house or hotel"
                  className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs rounded-full hover:from-amber-600 hover:to-orange-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  Sell House/Hotel
                </button>
                <button
                  onClick={handleMortgageProperty}
                  aria-label="Mortgage the property"
                  className="px-3 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-white text-xs rounded-full hover:from-gray-700 hover:to-gray-900 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-600"
                >
                  Mortgage
                </button>
                <button
                  onClick={handleUnmortgageProperty}
                  aria-label="Unmortgage the property"
                  className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Unmortgage
                </button>
                <button
                  onClick={() => setModalState((prev) => ({ ...prev, management: false }))}
                  aria-label="Close property management actions"
                  className="px-3 py-2 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 col-span-2"
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