"use client";
import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, MapPin, DollarSign, Home, Handshake, CheckCircle, Repeat, User, Key } from 'lucide-react';
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";

interface GamePlayersProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}

export default function GamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: GamePlayersProps) {
  const { address } = useAccount();
  const [showEmpire, setShowEmpire] = useState<boolean>(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleEmpire = useCallback(() => setShowEmpire((prev) => !prev), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

  const isMortgaged = useCallback(
    (property_id: number) =>
      game_properties.find((gp) => gp.property_id === property_id)?.mortgaged ?? false,
    [game_properties]
  );

  const developmentStage = useCallback(
    (property_id: number) =>
      game_properties.find((gp) => gp.property_id === property_id)?.development ?? 0,
    [game_properties]
  );

  const rentPrice = useCallback(
    (property_id: number) => {
      const property = properties.find((p) => p.id === property_id);
      const dev = developmentStage(property_id);
      switch (dev) {
        case 1:
          return property?.rent_one_house;
        case 2:
          return property?.rent_two_houses;
        case 3:
          return property?.rent_three_houses;
        case 4:
          return property?.rent_four_houses;
        case 5:
          return property?.rent_hotel;
        default:
          return property?.rent_site_only;
      }
    },
    [properties, developmentStage]
  );

  const sortedPlayers = useMemo(
    () =>
      [...(game?.players ?? [])].sort(
        (a, b) =>
          (a.turn_order ?? Number.POSITIVE_INFINITY) -
          (b.turn_order ?? Number.POSITIVE_INFINITY)
      ),
    [game?.players]
  );

  const decimalAddress = useMemo(() => address ? address.toLowerCase() : '', [address]);

  const myPlayer = useMemo(() => sortedPlayers.find(p => p.address?.toLowerCase() === decimalAddress), [sortedPlayers, decimalAddress]);

  const ownedPropertiesList = useMemo(() => {
    if (!myPlayer || !my_properties || my_properties.length === 0) {
      return [];
    }
    return my_properties.map(prop => ({
      id: prop.id,
      name: prop.name,
      rent_site_only: rentPrice(prop.id),
      development: developmentStage(prop.id),
      color: prop.color || '#FFFFFF',
    }));
  }, [my_properties, rentPrice, developmentStage, myPlayer]);

  const winningPlayerId = useMemo(() => {
    if (sortedPlayers.length === 0) return null;
    return sortedPlayers.reduce((max, player) => player.balance > max.balance ? player : max, sortedPlayers[0]).user_id;
  }, [sortedPlayers]);

  const currentProperty = useMemo(() => {
    if (!me?.position || !properties.length) return null;
    const prop = properties.find(p => p.id === me.position);
    if (!prop) return null;
    return {
      id: prop.id,
      name: prop.name,
      type: prop.type || 'property',
      owner: null,
      ownerUsername: null,
      rent_site_only: rentPrice(prop.id),
      cost: prop.price,
      color: prop.color || '#FFFFFF',
    };
  }, [me?.position, properties, rentPrice]);

  return (
    <>
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute top-0 left-0 bg-gradient-to-r from-[#010F10] to-[#0A1A20] z-10 lg:hidden text-[#F0F7F7] w-[44px] h-[44px] rounded-e-[12px] flex items-center justify-center border-[1px] border-white/10 transition-all duration-300 hover:from-cyan-900 hover:to-indigo-900 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          aria-label="Toggle sidebar"
        >
          <ChevronDown className="size-[28px] rotate-90" />
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
              className="inline-block px-3 py-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-sm rounded-md hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
              aria-label="Game ID"
            >
              Game ID: {game.code || 'N/A'}
            </button>
            <button
              onClick={toggleSidebar}
              className="text-[#F0F7F7] lg:hidden transition-all duration-300 hover:text-cyan-300 hover:rotate-180"
              aria-label="Toggle sidebar"
            >
              <ChevronDown className="w-6 h-6 rotate-90" />
            </button>
          </div>

          {/* Players Section */}
          <div className={`w-full flex flex-col gap-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-full p-4 bg-gradient-to-br from-[#0B191A]/90 to-[#1A262B]/90 backdrop-blur-sm rounded-[16px] shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,211,238,0.05),transparent_70%)] animate-pulse-slow"></div>
              <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar relative z-10">
                {sortedPlayers.map((player) => {
                  const isWinner = player.user_id === game.winner_id;
                  const isNext = player.user_id === game.next_player_id;
                  const isMe = player.address?.toLowerCase() === address?.toLowerCase();

                  return (
                    <li
                      key={player.user_id}
                      className={`p-3 bg-gradient-to-r from-[#131F25]/80 to-[#2A3A40]/80 rounded-[12px] text-[#F0F7F7] text-[13px] flex items-center gap-3 cursor-pointer hover:from-cyan-500/10 hover:to-indigo-500/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all duration-300 border-l-4 ${isNext ? 'border-cyan-300 bg-cyan-500/5' : 'border-transparent'}`}
                      aria-label={`Player ${player.username || player.address?.slice(0, 6)} with ${getPlayerSymbol(player.symbol)} token${isWinner ? ' (Leader)' : ''}`}
                    >
                      <span className="text-lg">{getPlayerSymbol(player.symbol)}</span>
                      <div className="flex-1">
                        <span className={`font-medium ${isMe ? 'text-cyan-300' : ''}`}>
                          {player.username || player.address?.slice(0, 6)}
                          {isWinner && <span className="ml-2 text-yellow-400">👑</span>}
                          {isMe && <span className="text-[11px] text-cyan-300"> (Me)</span>}
                        </span>
                          <span className="block text-[11px] text-[#A0B1B8]">
                          Position: {player.position ?? 0} | Balance: ${player.balance}
                          {("jailed" in player) && (player as any).jailed && <span className="ml-2 text-red-400">(Jailed)</span>}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {/* Current Property Section */}
              <div 
                className={`mt-4 cursor-pointer ${currentProperty ? 'hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]' : ''}`}
              >
                <h6 className="text-[13px] font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Current Property
                </h6>
                {currentProperty ? (
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
                  onClick={toggleEmpire}
                  className="flex items-center justify-between w-full px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-[12px] text-[#F0F7F7] text-[13px] font-semibold font-dmSans hover:from-cyan-700 hover:to-teal-700 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all duration-300 border border-white/10"
                  aria-label={showEmpire ? "Collapse My Empire" : "Expand My Empire"}
                >
                  <span>My Empire</span>
                  {showEmpire ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showEmpire && (
                  <div className="w-full p-4 bg-gradient-to-br from-[#0B191A]/90 to-[#1A262B]/90 backdrop-blur-sm rounded-[16px] shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,211,238,0.05),transparent_70%)] animate-pulse-slow"></div>
                    {ownedPropertiesList.length > 0 ? (
                      <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar relative z-10">
                        {ownedPropertiesList.map((property) => (
                          <li
                            key={property.id}
                            onClick={() => setSelectedProperty(properties.find(p => p.id === property.id) || null)}
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
                                {isMortgaged(property.id) && <span className="ml-2 text-red-400">(Mortgaged)</span>}
                              </span>
                            </div>
                          </li>
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
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-blue-700 to-indigo-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-blue-800 hover:to-indigo-800 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10"
                  aria-label="Offer Trade"
                >
                  <Handshake className='w-4 h-4' />
                  Offer Trade
                </button>
                <button
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-teal-700 to-cyan-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-teal-800 hover:to-cyan-800 hover:shadow-[0_0_15px_rgba(45,212,191,0.5)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 border border-white/10"
                  aria-label="Manage Trades"
                >
                  <CheckCircle className='w-4 h-4' />
                  Manage Trades
                </button>
                <button
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-orange-700 to-red-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-orange-800 hover:to-red-800 hover:shadow-[0_0_15px_rgba(249,115,22,0.5)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 border border-white/10"
                  aria-label="Counter Trade"
                >
                  <Repeat className='w-4 h-4' />
                  Counter Trade
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Property Modal */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            key="property-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative bg-gradient-to-br from-cyan-600 via-purple-600 to-indigo-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-cyan-500/50 animate-pop-in border border-white/20"
              aria-labelledby="property-management-modal-title"
              role="dialog"
              aria-modal="true"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c')] bg-cover bg-center opacity-20 rounded-2xl"></div>
              <div className="relative z-10">
                <div className="text-4xl mb-4">🏠</div>
                <h3 id="property-management-modal-title" className="text-2xl md:text-3xl font-bold text-white font-dmSans mb-2">
                  Manage {selectedProperty.name} (ID: {selectedProperty.id})
                </h3>
                <p className="text-lg text-cyan-200 mb-6">
                  Development: {developmentStage(selectedProperty.id)} | Rent: ${rentPrice(selectedProperty.id)}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    className="px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                    aria-label="Buy house for selected property"
                  >
                    Buy House
                  </button>
                  <button
                    className="px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-md hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                    aria-label="Buy hotel for selected property"
                  >
                    Buy Hotel
                  </button>
                  <button
                    className="px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                    aria-label="Sell house for selected property"
                  >
                    Sell House
                  </button>
                  <button
                    className="px-4 py-2 bg-gradient-to-r from-red-700 to-pink-700 text-white rounded-md hover:from-red-800 hover:to-pink-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                    aria-label="Sell hotel for selected property"
                  >
                    Sell Hotel
                  </button>
                  <button
                    className="px-4 py-2 bg-gradient-to-r from-yellow-700 to-amber-700 text-white rounded-md hover:from-yellow-800 hover:to-amber-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                    aria-label="Mortgage selected property"
                  >
                    Mortgage
                  </button>
                  <button
                    className="px-4 py-2 bg-gradient-to-r from-green-700 to-emerald-700 text-white rounded-md hover:from-green-800 hover:to-emerald-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                    aria-label="Unmortgage selected property"
                  >
                    Unmortgage
                  </button>
                  <button
                    onClick={() => setSelectedProperty(null)}
                    className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md hover:from-gray-700 hover:to-gray-800 transition-all duration-200 animate-pulse-slow shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                    aria-label="Cancel property management"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
  );
}