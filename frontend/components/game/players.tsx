"use client";
import {
  ChevronLeft,
  Flag,
  Plus,
  Handshake,
  CheckCircle,
  Repeat,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { PiUsersThree } from "react-icons/pi";
import { boardData } from "@/data/board-data";
import { apiClient } from "@/lib/api";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface TradeInputs {
  to: string;
  offeredPropertyIds: string; // Comma-separated IDs
  requestedPropertyIds: string; // Comma-separated IDs
  cashAmount: string; // Single cash amount
  cashDirection: "offer" | "request"; // New field for cash direction
  tradeType:
    | "property_for_property"
    | "property_for_cash"
    | "cash_for_property";
  tradeId: string;
  originalOfferId: string;
}

interface OwnedProperty {
  owner: string;
  ownerUsername: string;
  token: string;
  houses: number;
  hotels: number;
}
interface GamePlayersProps {
  gameId: number;
}
const GamePlayers = ({ gameId }: GamePlayersProps) => {
  const queryClient = useQueryClient();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [tradeInputs, setTradeInputs] = useState<TradeInputs>({
    to: "",
    offeredPropertyIds: "",
    requestedPropertyIds: "",
    cashAmount: "0",
    cashDirection: "offer",
    tradeType: "property_for_property",
    tradeId: "",
    originalOfferId: "",
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
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [selectedRequestedProperties, setSelectedRequestedProperties] =
    useState<number[]>([]);

  const [userId, setUserId] = useState<number | null>(null);
  // const [game, setGame] = useState<Game | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentProperty, setCurrentProperty] = useState<Property | null>({
    id: 0,
    name: "Go",
    type: "corner",
    owner: null,
    ownerUsername: null,
    rent_site_only: 0,
    houses: 0,
    hotels: 0,
  });
  const [ownedProperties, setOwnedProperties] = useState<{
    [key: number]: OwnedProperty;
  }>({
    1: {
      owner: "Aji",
      ownerUsername: "Aji",
      token: "🚗",
      houses: 0,
      hotels: 0,
    },
    3: {
      owner: "Aji",
      ownerUsername: "Aji",
      token: "🚗",
      houses: 0,
      hotels: 0,
    },
    5: {
      owner: "Luna",
      ownerUsername: "Luna",
      token: "🐶",
      houses: 0,
      hotels: 0,
    },
    7: {
      owner: "Mira",
      ownerUsername: "Mira",
      token: "🐱",
      houses: 0,
      hotels: 0,
    },
    9: {
      owner: "Mira",
      ownerUsername: "Mira",
      token: "🐱",
      houses: 0,
      hotels: 0,
    },
    11: {
      owner: "Finn",
      ownerUsername: "Finn",
      token: "🛩️",
      houses: 0,
      hotels: 0,
    },
  });
  // const [allProperties, setAllProperties] = useState<Property[] | []>([]);
  const [gameProperties, setGameProperties] = useState<[]>([]);
  const { address, isConnecting } = useAccount();

  const getGame = async () => {
    return await apiClient.get<Game | null>(`/games/${gameId}`);
  };
  const getAllProperties = async () => {
    return await apiClient.get<Property[]>("/properties");
  };
  const getGameProperties = async () => {
    return await apiClient.get<GameProperty[]>(
      `/game-properties/game/${gameId}`
    );
  };
  const getPlayerProperties = async (id: number) => {
    return await apiClient.get<GameProperty[]>(`/game-properties/player/${id}`);
  };

  const {
    data: game,
    isLoading: gameLoading,
    isError: gameError,
  } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const res = await getGame();
      return res;
    },
    refetchInterval: 5000, // auto refetch every 5s
  });

  const {
    data: game_properties,
    isLoading: gamePropertiesLoading,
    isError: gamePropertiesError,
  } = useQuery({
    queryKey: ["game_properties", gameId],
    queryFn: async () => {
      const res = await getGameProperties();
      return res;
    },
    refetchInterval: 15000, // auto refetch every 15s
  });

  const {
    data: properties,
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await getAllProperties();
      return res;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  // ✅ Force refresh immediately after the mutation
  // queryClient.invalidateQueries({ queryKey: ["game", gameId] });
  // Compute properties owned by other players
  // const otherPlayersProperties = useMemo(() => {
  //   const currentPlayer = players[currentPlayerIndex];
  //   return boardData
  //     .filter(
  //       (property) =>
  //         property.owner &&
  //         property.owner !== currentPlayer.username &&
  //         property.type === "property"
  //     )
  //     .map((property) => ({
  //       id: property.id,
  //       name: property.name,
  //       ownerUsername: property.ownerUsername || "Unknown",
  //       color: property.color || "#FFFFFF",
  //     }));
  // }, [players, currentPlayerIndex, boardData]);

  // const winningPlayerId = useMemo(() => {
  //   return players.reduce(
  //     (max, player) => (player.balance > max.balance ? player : max),
  //     players[0]
  //   ).id;
  // }, [players]);

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
    if (modal === "offerTrade") {
      setSelectedRequestedProperties([]);
    }
  };

  const getCurrentPlayerId = () => {
    if (!game || !address) return null;
    const player = game.players.find(
      (p) => p.address.toLowerCase() === address.toLowerCase()
    );
    return player?.user_id ?? null;
  };

  const currentPlayerId = getCurrentPlayerId();

  const myProperties = useMemo(() => {
    if (!gameProperties || !properties || !currentPlayerId) return [];

    return gameProperties
      .filter((gp) => gp.user_id === currentPlayerId) // only owned by me
      .map((gp) => {
        const prop = properties.find((p) => p.id === gp.property_id);
        return prop ? { ...gp, ...prop } : gp;
        // merge fields so UI has both ownership + property info
      });
  }, [gameProperties, properties, currentPlayerId]);
  // const handleOfferTrade = () => {
  //   if (
  //     !tradeInputs.to ||
  //     !tradeInputs.offeredPropertyIds ||
  //     (!selectedRequestedProperties.length &&
  //       tradeInputs.tradeType !== "property_for_cash") ||
  //     (tradeInputs.cashAmount === "0" &&
  //       ["property_for_cash", "cash_for_property"].includes(
  //         tradeInputs.tradeType
  //       ))
  //   ) {
  //     setError("Please fill all required trade fields.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   const tradeData = {
  //     ...tradeInputs,
  //     requestedPropertyIds: selectedRequestedProperties.join(","),
  //     cashOffer:
  //       tradeInputs.cashDirection === "offer" ? tradeInputs.cashAmount : "0",
  //     cashRequest:
  //       tradeInputs.cashDirection === "request" ? tradeInputs.cashAmount : "0",
  //   };
  //   console.log("Offering trade:", tradeData);
  //   setTradeInputs({
  //     to: "",
  //     offeredPropertyIds: "",
  //     requestedPropertyIds: "",
  //     cashAmount: "0",
  //     cashDirection: "offer",
  //     tradeType: "property_for_property",
  //     tradeId: "",
  //     originalOfferId: "",
  //   });
  //   setSelectedRequestedProperties([]);
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, offerTrade: false }));
  // };

  // const handleAcceptTrade = () => {
  //   if (!tradeInputs.tradeId) {
  //     setError("Please enter a trade ID.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   console.log(`Accepting trade ID ${tradeInputs.tradeId}`);
  //   setTradeInputs((prev) => ({ ...prev, tradeId: "" }));
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, manageTrades: false }));
  // };

  // const handleRejectTrade = () => {
  //   if (!tradeInputs.tradeId) {
  //     setError("Please enter a trade ID.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   console.log(`Rejecting trade ID ${tradeInputs.tradeId}`);
  //   setTradeInputs((prev) => ({ ...prev, tradeId: "" }));
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, manageTrades: false }));
  // };

  // const handleCounterTrade = () => {
  //   if (
  //     !tradeInputs.originalOfferId ||
  //     !tradeInputs.offeredPropertyIds ||
  //     !tradeInputs.requestedPropertyIds
  //   ) {
  //     setError("Please fill all counter trade fields.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   console.log("Countering trade:", tradeInputs);
  //   setTradeInputs({
  //     to: "",
  //     offeredPropertyIds: "",
  //     requestedPropertyIds: "",
  //     cashAmount: "0",
  //     cashDirection: "offer",
  //     tradeType: "property_for_property",
  //     tradeId: "",
  //     originalOfferId: "",
  //   });
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, counterTrade: false }));
  // };

  // const handleApproveCounterTrade = () => {
  //   if (!tradeInputs.tradeId) {
  //     setError("Please enter a trade ID.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   console.log(`Approving counter trade ID ${tradeInputs.tradeId}`);
  //   setTradeInputs((prev) => ({ ...prev, tradeId: "" }));
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, manageTrades: false }));
  // };

  // const handleBuyProperty = () => {
  //   if (!propertyId || !currentProperty || currentProperty.owner) {
  //     setError("Cannot buy: Invalid property ID or property already owned.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (square && square.type === "property" && square.cost) {
  //     setPlayers((prevPlayers) => {
  //       const newPlayers = [...prevPlayers];
  //       const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //       if (currentPlayer.balance >= square.cost) {
  //         currentPlayer.balance -= square.cost;
  //         currentPlayer.properties_owned.push(square.id);
  //         newPlayers[currentPlayerIndex] = currentPlayer;
  //         setOwnedProperties((prev) => ({
  //           ...prev,
  //           [square.id]: {
  //             owner: currentPlayer.username,
  //             ownerUsername: currentPlayer.username,
  //             token: currentPlayer.token,
  //             houses: 0,
  //             hotels: 0,
  //           },
  //         }));
  //         setCurrentProperty((prev) =>
  //           prev
  //             ? {
  //                 ...prev,
  //                 owner: currentPlayer.username,
  //                 ownerUsername: currentPlayer.username,
  //                 houses: 0,
  //                 hotels: 0,
  //               }
  //             : null
  //         );
  //       } else {
  //         setError("Insufficient balance to buy property.");
  //       }
  //       return newPlayers;
  //     });
  //   }
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, property: false }));
  // };

  // const handlePayTax = () => {
  //   if (!propertyId || !currentProperty || currentProperty.name !== "Tax") {
  //     setError("Invalid tax square or property ID.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (square && square.type === "special" && square.cost) {
  //     setPlayers((prevPlayers) => {
  //       const newPlayers = [...prevPlayers];
  //       const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //       if (currentPlayer.balance >= square.cost) {
  //         currentPlayer.balance -= square.cost;
  //         newPlayers[currentPlayerIndex] = currentPlayer;
  //       } else {
  //         setError("Insufficient balance to pay tax.");
  //       }
  //       return newPlayers;
  //     });
  //   }
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, property: false }));
  // };

  // const handleBuyHouse = () => {
  //   if (
  //     !propertyId ||
  //     ownedProperties[Number(propertyId)]?.owner !==
  //       players[currentPlayerIndex].username
  //   ) {
  //     setError("Cannot buy house: Invalid property ID or not owned.");
  //     return;
  //   }
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (
  //     !square ||
  //     square.type !== "property" ||
  //     !square.house_cost ||
  //     ownedProperties[Number(propertyId)].houses >= 4 ||
  //     ownedProperties[Number(propertyId)].hotels > 0
  //   ) {
  //     setError(
  //       "Cannot buy house: Invalid property, max houses reached, or hotel already built."
  //     );
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   setPlayers((prevPlayers) => {
  //     const newPlayers = [...prevPlayers];
  //     const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //     if (currentPlayer.balance >= square.house_cost) {
  //       currentPlayer.balance -= square.house_cost;
  //       newPlayers[currentPlayerIndex] = currentPlayer;
  //       setOwnedProperties((prev) => ({
  //         ...prev,
  //         [Number(propertyId)]: {
  //           ...prev[Number(propertyId)],
  //           houses: prev[Number(propertyId)].houses + 1,
  //         },
  //       }));
  //       setCurrentProperty((prev) =>
  //         prev && prev.id === Number(propertyId)
  //           ? { ...prev, houses: prev.houses + 1 }
  //           : prev
  //       );
  //     } else {
  //       setError("Insufficient balance to buy house.");
  //     }
  //     return newPlayers;
  //   });
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, management: false }));
  // };

  // const handleBuyHotel = () => {
  //   if (
  //     !propertyId ||
  //     ownedProperties[Number(propertyId)]?.owner !==
  //       players[currentPlayerIndex].username
  //   ) {
  //     setError("Cannot buy hotel: Invalid property ID or not owned.");
  //     return;
  //   }
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (
  //     !square ||
  //     square.type !== "property" ||
  //     !square.hotel_cost ||
  //     ownedProperties[Number(propertyId)].houses < 4 ||
  //     ownedProperties[Number(propertyId)].hotels > 0
  //   ) {
  //     setError(
  //       "Cannot buy hotel: Invalid property, requires 4 houses, or hotel already built."
  //     );
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   setPlayers((prevPlayers) => {
  //     const newPlayers = [...prevPlayers];
  //     const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //     if (currentPlayer.balance >= square.hotel_cost) {
  //       currentPlayer.balance -= square.hotel_cost;
  //       newPlayers[currentPlayerIndex] = currentPlayer;
  //       setOwnedProperties((prev) => ({
  //         ...prev,
  //         [Number(propertyId)]: {
  //           ...prev[Number(propertyId)],
  //           houses: 0,
  //           hotels: 1,
  //         },
  //       }));
  //       setCurrentProperty((prev) =>
  //         prev && prev.id === Number(propertyId)
  //           ? { ...prev, houses: 0, hotels: 1 }
  //           : prev
  //       );
  //     } else {
  //       setError("Insufficient balance to buy hotel.");
  //     }
  //     return newPlayers;
  //   });
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, management: false }));
  // };

  // const handleSellHouse = () => {
  //   if (
  //     !propertyId ||
  //     ownedProperties[Number(propertyId)]?.owner !==
  //       players[currentPlayerIndex].username
  //   ) {
  //     setError("Cannot sell house: Invalid property ID or not owned.");
  //     return;
  //   }
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (
  //     !square ||
  //     square.type !== "property" ||
  //     !square.house_cost ||
  //     ownedProperties[Number(propertyId)].houses === 0
  //   ) {
  //     setError("Cannot sell house: Invalid property or no houses to sell.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   setPlayers((prevPlayers) => {
  //     const newPlayers = [...prevPlayers];
  //     const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //     const refund = Math.floor(square.house_cost / 2);
  //     currentPlayer.balance += refund;
  //     newPlayers[currentPlayerIndex] = currentPlayer;
  //     setOwnedProperties((prev) => ({
  //       ...prev,
  //       [Number(propertyId)]: {
  //         ...prev[Number(propertyId)],
  //         houses: prev[Number(propertyId)].houses - 1,
  //       },
  //     }));
  //     setCurrentProperty((prev) =>
  //       prev && prev.id === Number(propertyId)
  //         ? { ...prev, houses: prev.houses - 1 }
  //         : prev
  //     );
  //     return newPlayers;
  //   });
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, management: false }));
  // };

  // const handleSellHotel = () => {
  //   if (
  //     !propertyId ||
  //     ownedProperties[Number(propertyId)]?.owner !==
  //       players[currentPlayerIndex].username
  //   ) {
  //     setError("Cannot sell hotel: Invalid property ID or not owned.");
  //     return;
  //   }
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (
  //     !square ||
  //     square.type !== "property" ||
  //     !square.hotel_cost ||
  //     ownedProperties[Number(propertyId)].hotels === 0
  //   ) {
  //     setError("Cannot sell hotel: Invalid property or no hotel to sell.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   setPlayers((prevPlayers) => {
  //     const newPlayers = [...prevPlayers];
  //     const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //     const refund = Math.floor(square.hotel_cost / 2);
  //     currentPlayer.balance += refund;
  //     newPlayers[currentPlayerIndex] = currentPlayer;
  //     setOwnedProperties((prev) => ({
  //       ...prev,
  //       [Number(propertyId)]: {
  //         ...prev[Number(propertyId)],
  //         houses: 4,
  //         hotels: 0,
  //       },
  //     }));
  //     setCurrentProperty((prev) =>
  //       prev && prev.id === Number(propertyId)
  //         ? { ...prev, houses: 4, hotels: 0 }
  //         : prev
  //     );
  //     return newPlayers;
  //   });
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, management: false }));
  // };

  // const handleMortgageProperty = () => {
  //   if (
  //     !propertyId ||
  //     ownedProperties[Number(propertyId)]?.owner !==
  //       players[currentPlayerIndex].username
  //   ) {
  //     setError("Cannot mortgage: Invalid property ID or not owned.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (square?.mortgage) {
  //     setPlayers((prevPlayers) => {
  //       const newPlayers = [...prevPlayers];
  //       const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //       currentPlayer.balance += square.mortgage;
  //       newPlayers[currentPlayerIndex] = currentPlayer;
  //       return newPlayers;
  //     });
  //   }
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, management: false }));
  // };

  // const handleUnmortgageProperty = () => {
  //   if (!propertyId) {
  //     setError("Cannot unmortgage: Invalid property ID.");
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError(null);
  //   const square = boardData.find((s) => s.id === Number(propertyId));
  //   if (square?.mortgage) {
  //     setPlayers((prevPlayers) => {
  //       const newPlayers = [...prevPlayers];
  //       const currentPlayer = { ...newPlayers[currentPlayerIndex] };
  //       const unmortgageCost = Math.floor(square.mortgage * 1.1);
  //       if (currentPlayer.balance >= unmortgageCost) {
  //         currentPlayer.balance -= unmortgageCost;
  //         newPlayers[currentPlayerIndex] = currentPlayer;
  //       } else {
  //         setError("Insufficient balance to unmortgage property.");
  //       }
  //       return newPlayers;
  //     });
  //   }
  //   setPropertyId("");
  //   setIsLoading(false);
  //   setModalState((prev) => ({ ...prev, management: false }));
  // };

  // const ownedPropertiesList = players[currentPlayerIndex].properties_owned.map(
  //   (id) => {
  //     const property = boardData.find((p) => p.id === id);
  //     return (
  //       property || {
  //         id,
  //         name: `Property ${id}`,
  //         type: "unknown",
  //         owner: players[currentPlayerIndex].username,
  //         ownerUsername: players[currentPlayerIndex].username,
  //         rent_site_only: 0,
  //         color: "#FFFFFF",
  //         houses: ownedProperties[id]?.houses || 0,
  //         hotels: ownedProperties[id]?.hotels || 0,
  //       }
  //     );
  //   }
  // );

  return (
    <>
      {!isSidebarOpen && (
        <button
          type="button"
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
            transform ${
              isSidebarOpen
                ? "translate-x-0 lg:translate-x-0"
                : "-translate-x-full lg:translate-x-0"
            }
            lg:static lg:transform-none
            ${
              isSidebarOpen
                ? "lg:w-[300px] md:w-3/5 w-full"
                : "lg:w-[60px] w-full"
            }
          `}
      >
        <div className="w-full h-full flex flex-col gap-8">
          <div className="w-full sticky top-0 bg-[#010F10]/95 py-5 flex justify-between items-center">
            <h4
              className={`font-[700] font-dmSans text-[18px] text-[#F0F7F7] ${
                !isSidebarOpen && "hidden"
              }`}
            >
              Players
            </h4>
            <button
              type="button"
              onClick={toggleSidebar}
              className="text-[#F0F7F7] lg:hidden transition-colors duration-300 hover:text-cyan-300"
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? (
                <ChevronLeft className="w-6 h-6" />
              ) : (
                <PiUsersThree className="size-[28px]" />
              )}
            </button>
          </div>

          {/* Players Section */}
          <div
            className={`w-full flex flex-col gap-4 ${
              isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="w-full p-4 bg-[#0B191A]/90 backdrop-blur-sm rounded-[16px] shadow-lg border border-white/5">
              <h5 className="text-[14px] font-semibold text-cyan-300 mb-3">
                Players
              </h5>
              <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar">
                {game?.players
                  ?.slice()
                  .sort((a, b) => (a?.turn_order || 0) - (b?.turn_order || 0))
                  .map((player, index) => (
                    <li
                      key={player.user_id}
                      className={`p-3 bg-[#131F25]/80 rounded-[12px] text-[#F0F7F7] text-[13px] flex items-center gap-3 hover:bg-gradient-to-r hover:from-[#1A262B]/80 hover:to-[#2A3A40]/80 hover:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all duration-300 ${
                        player.user_id === game.next_player_id
                          ? "border-l-4 border-cyan-300"
                          : ""
                      }`}
                      aria-label={`Player ${player.username}${
                        player.user_id === game.winner_id ? "(Leader)" : ""
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full">
                        {getPlayerSymbol(player.symbol)}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">
                          {player.username}
                          {player.user_id === game.winner_id && (
                            <span className="ml-2 text-yellow-400">👑</span>
                          )}
                          {player.user_id === currentPlayerId && (
                            <span className="text-[11px] text-cyan-300">
                              {" "}
                              (Me)
                            </span>
                          )}
                        </span>
                        <div className="flex flex-col">
                          <div className="flex flex-row space-x-3 text-[11px] text-[#A0B1B8]">
                            <span>Position: {player.position}</span>
                            <span>|</span>
                            <span>Balance: ${player.balance}</span>
                          </div>
                          {player.position === 30 && (
                            <div className="ml-2 text-red-400">(Jailed)</div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* Properties Section */}
          <div
            className={`w-full flex flex-col gap-6 ${
              isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="w-full flex flex-col gap-4">
              <h4 className="font-[700] font-dmSans text-[16px] text-[#F0F7F7]">
                My Properties
              </h4>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={toggleProperties}
                  className="flex items-center justify-between w-full px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-[12px] text-[#F0F7F7] text-[13px] font-semibold font-dmSans hover:from-cyan-700 hover:to-teal-700 hover:shadow-[0_0_8px_rgba(45,212,191,0.3)] transition-all duration-300"
                  aria-label={
                    isPropertiesOpen ? "Collapse My Empire" : "Expand My Empire"
                  }
                >
                  <span>My Empire</span>
                  {isPropertiesOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {isPropertiesOpen && (
                  <div className="w-full p-4 bg-[#0B191A]/90 backdrop-blur-sm rounded-[16px] shadow-lg border border-white/5">
                    {myProperties.length > 0 ? (
                      <ul className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar">
                        {myProperties.map((property) => (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
                          <li
                            key={property.id}
                            className="p-3 bg-[#131F25]/80 rounded-[12px] text-[#F0F7F7] text-[13px] flex items-center gap-3 hover:bg-gradient-to-r hover:from-[#1A262B]/80 hover:to-[#2A3A40]/80 hover:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all duration-300 cursor-pointer"
                            onClick={() =>
                              setPropertyId(property.id.toString())
                            }
                            aria-label={`Select property ${property.name}`}
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{
                                backgroundColor: property.color || "#FFFFFF",
                              }}
                            />
                            <div className="flex-1">
                              <span className="font-medium">
                                {property.name}
                              </span>
                              <span className="block text-[11px] text-[#A0B1B8]">
                                ID: {property.id} | Rent: $
                                {property.rent_site_only} | Houses:{" "}
                                {property.houses} | Hotels: {property.hotels}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#A0B1B8] text-[13px] text-center">
                        No properties owned yet.
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openModal("property")}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-green-700 to-emerald-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-green-800 hover:to-emerald-800 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Open property actions"
                >
                  <Plus className="w-4 h-4" />
                  Property
                </button>
                <button
                  type="button"
                  onClick={() => openModal("management")}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-purple-700 to-indigo-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-purple-800 hover:to-indigo-800 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label="Open property management actions"
                >
                  <Plus className="w-4 h-4" />
                  Management
                </button>
                <button
                  type="button"
                  onClick={() => {}}
                  className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-red-700 to-pink-700 text-[#F0F7F7] text-[13px] font-semibold font-dmSans flex items-center gap-2 hover:from-red-800 hover:to-pink-800 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Declare bankruptcy"
                >
                  <Flag className="w-4 h-4" />
                  Bankruptcy
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default GamePlayers;
