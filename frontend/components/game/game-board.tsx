"use client";
import React, { useState, useEffect, Component, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BoardDataSquare } from "@/types/game";
import PropertyCard from "./property-card";
import SpecialCard from "./special-card";
import CornerCard from "./corner-card";
import {
  PLAYER_TOKENS,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
} from "@/constants/constants";
import { apiClient } from "@/lib/api";

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

interface Game {
  id: string;
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

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-400 text-center">
          Something went wrong. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

const GameBoard = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([
    {
      id: 0,
      name: "Player 1",
      username: "Player1",
      position: 0,
      balance: 1500,
      jailed: false,
      properties_owned: [],
      isNext: true,
      token: PLAYER_TOKENS[0],
    },
    {
      id: 1,
      name: "Player 2",
      username: "Player2",
      position: 0,
      balance: 1500,
      jailed: false,
      properties_owned: [],
      isNext: false,
      token: PLAYER_TOKENS[1],
    },
  ]);
  const [playerTokens, setPlayerTokens] = useState<{ [key: string]: string }>({
    player1: PLAYER_TOKENS[0],
    player2: PLAYER_TOKENS[1],
  });
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [lastRoll, setLastRoll] = useState<{
    die1: number;
    die2: number;
    total: number;
  } | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(players[0]);
  const [currentProperty, setCurrentProperty] = useState<Property | null>({
    id: 0,
    name: "Go",
    type: "corner",
    owner: null,
    ownerUsername: null,
    rent_site_only: 0,
  });
  const [ownedProperties, setOwnedProperties] = useState<{
    [key: number]: OwnedProperty;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<
    "Chance" | "CommunityChest" | null
  >(null);
  const [propertyId, setPropertyId] = useState("");
  const [showRentInput, setShowRentInput] = useState(false); // New state for input visibility
  const [chatMessages, setChatMessages] = useState<
    { sender: string; message: string }[]
  >([{ sender: "Player1", message: "hi" }]);
  const [chatInput, setChatInput] = useState("");

  const [boardData, setBoardData] = useState<BoardDataSquare[] | []>([]);
  useEffect(() => {
    const id =
      searchParams.get("gameCode") ||
      localStorage.getItem("gameCode") ||
      "TZIYLR";
    setGameId(id);
    setGame({
      id: id,
      currentPlayer: players[0].username,
      nextPlayer: players[1].username,
      createdBy: "player1",
    });
    localStorage.setItem("gameCode", id);
  }, [searchParams, players]);

  useEffect(() => {
    updateCurrentProperty();
  }, [players, currentPlayerIndex]);

  const rollDice = () => {
    setIsLoading(true);
    setError(null);
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const roll = die1 + die2;
    setLastRoll({ die1, die2, total: roll });

    setPlayers((prevPlayers) => {
      const newPlayers = [...prevPlayers];
      const currentPlayer = { ...newPlayers[currentPlayerIndex] };
      let newPosition = (currentPlayer.position + roll) % 40;
      if (newPosition < 0) newPosition += 40;
      currentPlayer.position = newPosition;
      newPlayers[currentPlayerIndex] = currentPlayer;
      return newPlayers;
    });

    updateCurrentProperty();
    setIsLoading(false);
  };

  const updateCurrentProperty = () => {
    const currentPlayer = players[currentPlayerIndex];
    const square = boardData.find((s) => s.id === currentPlayer.position);
    if (square) {
      setCurrentProperty({
        id: square.id,
        name: square.name || "Unknown",
        type: square.type,
        owner: ownedProperties[square.id]?.owner || null,
        ownerUsername: ownedProperties[square.id]?.ownerUsername || null,
        rent_site_only: square.rent_site_only || 0,
      });
    } else {
      setCurrentProperty(null);
    }
  };

  const handleDrawCard = (type: "Chance" | "CommunityChest") => {
    setIsLoading(true);
    setError(null);
    const cardList = type === "Chance" ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS;
    const randomCard = cardList[Math.floor(Math.random() * cardList.length)];
    setSelectedCard(randomCard);
    setSelectedCardType(type);
    setIsLoading(false);
  };

  const handleProcessCard = () => {
    if (!selectedCard) {
      setError("No card selected to process.");
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Processing ${selectedCardType} card: ${selectedCard}`);
    setSelectedCard(null);
    setSelectedCardType(null);
    setIsLoading(false);
  };

  const handlePayRent = () => {
    if (!propertyId || !currentProperty || !currentProperty.owner) {
      setError("Cannot pay rent: No owner or invalid property.");
      setShowRentInput(false); // Hide input on error
      return;
    }
    setIsLoading(true);
    setError(null);
    const square = boardData.find((s) => s.id === Number(propertyId));
    if (square && square.type === "property" && square.rent_site_only) {
      setPlayers((prevPlayers) => {
        const newPlayers = [...prevPlayers];
        const currentPlayer = { ...newPlayers[currentPlayerIndex] };
        const owner = newPlayers.find(
          (p) => p.username === currentProperty.owner
        );
        if (currentPlayer.balance >= square.rent_site_only && owner) {
          currentPlayer.balance -= square.rent_site_only;
          owner.balance += square.rent_site_only;
          newPlayers[currentPlayerIndex] = currentPlayer;
          newPlayers[players.indexOf(owner)] = owner;
        } else {
          setError("Insufficient balance to pay rent.");
          setShowRentInput(false); // Hide input on error
        }
        return newPlayers;
      });
    }
    setPropertyId(""); // Clear input
    setShowRentInput(false); // Hide input after paying rent
    setIsLoading(false);
  };

  const handleCancelRent = () => {
    setPropertyId(""); // Clear input
    setShowRentInput(false); // Hide input
  };

  const handleEndTurn = () => {
    if (selectedCard) {
      setError("You must process the drawn card before ending your turn.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setPlayers((prevPlayers) => {
      const newPlayers = [...prevPlayers];
      newPlayers[currentPlayerIndex].isNext = false;
      const nextIndex = (currentPlayerIndex + 1) % newPlayers.length;
      newPlayers[nextIndex].isNext = true;
      setCurrentPlayerIndex(nextIndex);
      setPlayer(newPlayers[nextIndex]);
      setGame((prev) =>
        prev
          ? {
              ...prev,
              currentPlayer: newPlayers[nextIndex].username,
              nextPlayer:
                newPlayers[(nextIndex + 1) % newPlayers.length].username,
            }
          : null
      );
      return newPlayers;
    });
    updateCurrentProperty();
    setIsLoading(false);
  };

  const handlePayJailFine = () => {
    setIsLoading(true);
    setError(null);
    setPlayers((prevPlayers) => {
      const newPlayers = [...prevPlayers];
      const currentPlayer = { ...newPlayers[currentPlayerIndex] };
      if (currentPlayer.jailed && currentPlayer.balance >= 50) {
        currentPlayer.jailed = false;
        currentPlayer.balance -= 50;
        newPlayers[currentPlayerIndex] = currentPlayer;
        setPlayer(currentPlayer);
      } else {
        setError("Cannot pay jail fine: Not in jail or insufficient balance.");
      }
      return newPlayers;
    });
    setIsLoading(false);
  };

  const handleEndGame = () => {
    setIsLoading(true);
    setError(null);
    setGameId(null);
    setPlayers([]);
    setGame(null);
    setPlayer(null);
    setCurrentProperty(null);
    setOwnedProperties({});
    setSelectedCard(null);
    setSelectedCardType(null);
    setLastRoll(null);
    localStorage.removeItem("gameCode");
    router.push("/");
    setIsLoading(false);
  };

  const handleLeaveGame = () => {
    handleEndGame();
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { sender: player?.username || "Anonymous", message: chatInput },
    ]);
    setChatInput("");
  };

  const handleCopyGameLink = () => {
    if (gameId) {
      const link = `https://gameroom10qd.io/${gameId}`;
      navigator.clipboard
        .writeText(link)
        .then(() => {
          alert("Game link copied to clipboard!");
        })
        .catch(() => {
          setError("Failed to copy game link.");
        });
    } else {
      setError("No game ID available to copy.");
    }
  };

  const getGridPosition = (square: BoardDataSquare) => ({
    gridRowStart: square.grid_row,
    gridColumnStart: square.grid_col,
  });

  const isTopHalf = (square: BoardDataSquare) => {
    return square.grid_row === 1; // Top row of the 11x11 grid
  };

  useEffect(() => {
    const getProperties = async () => {
      const response = await apiClient.get<BoardDataSquare[]>("/properties");
      if (response.length === 40) {
        setBoardData(response);
      }
    };
    getProperties();
  }, []);

  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        {/* Rotate Prompt for Mobile Portrait */}
        <div className="rotate-prompt hidden fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 text-center text-white p-4">
          <p className="text-lg font-semibold">
            Please rotate your device to landscape mode for the best experience.
          </p>
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
                  <h2 className="text-base font-semibold text-cyan-300 mb-3">
                    Game Actions
                  </h2>
                  {isLoading && (
                    <p className="text-cyan-300 text-sm text-center mb-2">
                      Loading...
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={rollDice}
                      aria-label="Roll the dice to move your player"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200"
                    >
                      Roll Dice
                    </button>
                    {lastRoll && (
                      <p className="text-gray-300 text-sm text-center">
                        Rolled:{" "}
                        <span className="font-bold text-white">
                          {lastRoll.die1} + {lastRoll.die2} = {lastRoll.total}
                        </span>
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
                            type="button"
                            onClick={handlePayRent}
                            aria-label="Confirm rent payment"
                            className="px-2 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs rounded-full hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
                          >
                            Confirm Rent
                          </button>
                          <button
                            type="button"
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
                        type="button"
                        onClick={() => setShowRentInput(true)} // Show input on click
                        aria-label="Pay rent for the property"
                        className="px-2 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs rounded-full hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Rent
                      </button>
                      <button
                        type="button"
                        onClick={handleEndTurn}
                        aria-label="End your turn"
                        className="px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200"
                      >
                        End Turn
                      </button>
                      <button
                        type="button"
                        onClick={handlePayJailFine}
                        aria-label="Pay jail fine"
                        className="px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs rounded-full hover:from-pink-600 hover:to-rose-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Pay Jail Fine
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDrawCard("Chance")}
                        aria-label="Draw a Chance card"
                        className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-lime-500 text-white text-xs rounded-full hover:from-yellow-600 hover:to-lime-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Draw Chance
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDrawCard("CommunityChest")}
                        aria-label="Draw a Community Chest card"
                        className="px-2 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs rounded-full hover:from-teal-600 hover:to-cyan-600 transform hover:scale-105 transition-all duration-200"
                      >
                        Draw CChest
                      </button>
                      <button
                        type="button"
                        onClick={handleEndGame}
                        aria-label="End the game"
                        className="px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full hover:from-red-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200"
                      >
                        End Game
                      </button>
                      <button
                        type="button"
                        onClick={handleLeaveGame}
                        aria-label="Leave the game"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                      >
                        Leave Game
                      </button>
                    </div>
                    {error && (
                      <p className="text-red-400 text-sm mt-2 text-center">
                        {error}
                      </p>
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
                      {selectedCardType === "CommunityChest"
                        ? "Community Chest"
                        : "Chance"}{" "}
                      Card
                    </h3>
                    <p className="text-sm text-gray-300">{selectedCard}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleProcessCard}
                        aria-label="Process the drawn card"
                        className="px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs rounded-full hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200"
                        disabled={!selectedCardType}
                      >
                        Process
                      </button>
                      <button
                        type="button"
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
                      isTopHalf(square)
                        ? "origin-top group-hover:origin-bottom group-hover:translate-y-[100px]"
                        : ""
                    } group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200`}
                  >
                    {square.type === "property" && (
                      <PropertyCard
                        square={square}
                        owner={ownedProperties[square.id]?.owner || null}
                        ownerUsername={
                          ownedProperties[square.id]?.ownerUsername || null
                        }
                        isConnectedPlayer={
                          ownedProperties[square.id]?.owner === player?.username
                        }
                      />
                    )}
                    {square.type === "special" && (
                      <SpecialCard square={square} />
                    )}
                    {square.type === "corner" && <CornerCard square={square} />}
                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1 z-10">
                      {players
                        .filter((p) => p.position === index)
                        .map((p) => (
                          <span
                            key={p.id}
                            className={`text-lg md:text-2xl ${
                              p.isNext ? "border-2 border-cyan-300 rounded" : ""
                            }`}
                          >
                            {p.token || playerTokens[p.username] || ""}
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
