"use client";
import React, { useState, useEffect, Component, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PropertyCard from "./cards/property-card";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
import {
  PLAYER_TOKENS,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
} from "@/constants/constants";
import { Game, GameProperty, Property, Player } from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface GameProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  loading?: boolean;
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

const GameBoard = ({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  loading = false,
}: GameProps) => {
  const { address } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const forceRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  };
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [players, setPlayers] = useState<Player[] | []>(game.players);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rollAgain, setRollAgain] = useState(false);
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

  const [boardData, setBoardData] = useState<Property[]>(properties);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [roll, setRoll] = useState<{
    die1: number;
    die2: number;
    total: number;
  } | null>(null);
  const getDiceValues = () => {
    const die1 = Number(Math.floor(Math.random() * 6) + 1);
    const die2 = Number(Math.floor(Math.random() * 6) + 1);
    const total = Number(die1 + die2);
    if (total == 12) {
      return null;
    }
    return { die1, die2, total };
  };


  const UPDATE_GAME_PLAYER_POSITION = async (
    id: undefined | null | number,
    position: number
  ) => {
    if (!id) return;
    setPlayers((prevPlayers) =>
      prevPlayers.map((p) =>
        p.user_id === id ? { ...p, position } : p
      )
    );

    try {
      await apiClient.post("/game-players/change-position", {
        position,
        user_id: id,
        game_id: game.id,
      });
      const updatedGame = await apiClient.get<Game>(`/games/${game.code}`);

      if (updatedGame && updatedGame.players) {
        setPlayers(updatedGame.players);
      }

      queryClient.invalidateQueries({ queryKey: ["game", game.code] });
    } catch (err) {
      console.error("Error updating player position:", err);
      setError("Failed to update player position. Try again.");

      forceRefetch();
    }
  };


  const END_TURN = async (id?: number) => {
    setRollAgain(false);
    setRoll(null);

    if (!id || game.next_player_id !== id) return;

    try {

      await apiClient.post("/game-players/end-turn", {
        user_id: id,
        game_id: game.id,
      });

      const updatedGame = await apiClient.get<Game>(`/games/${game.code}`);

      if (updatedGame && updatedGame.players) {
        setPlayers(updatedGame.players);
      }

      queryClient.invalidateQueries({ queryKey: ["game", game.code] });
    } catch (err) {
      console.error("Error ending turn:", err);
      setError("Failed to end turn. Try again.");
      forceRefetch();
    }
  };

  const ROLL_DICE = () => {
    setIsRolling(true);
    setError(null);
    setTimeout(() => {
      const value = getDiceValues();
      if (!value) {
        setRollAgain(true);
        setRoll(null);
        setIsRolling(false);
        return;
      }
      setRoll(value);

      // fix precedence bug
      let newPosition = ((me?.position ?? 0) + value.total) % 40;
      if (newPosition < 0) newPosition += 40;

      setPlayers((prevPlayers) => {
        const newPlayers = [...prevPlayers];
        // fix indexing bug: find by user_id
        const playerIndex = newPlayers.findIndex(
          (p) => p.user_id === me?.user_id
        );
        if (playerIndex !== -1) {
          const currentPlayer = {
            ...newPlayers[playerIndex],
            position: newPosition,
          };
          newPlayers[playerIndex] = currentPlayer;
        }
        return newPlayers;
      });

      UPDATE_GAME_PLAYER_POSITION(me?.user_id, newPosition);
      setIsRolling(false);
    }, 3000);
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

  const getGridPosition = (square: Property) => ({
    gridRowStart: square.grid_row,
    gridColumnStart: square.grid_col,
  });

  const isTopHalf = (square: Property) => {
    return square.grid_row === 1; // Top row of the 11x11 grid
  };

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

                {game.next_player_id === me?.user_id ? (
                  <div className="flex flex-col gap-2">
                    {!roll ? (
                      <button
                        type="button"
                        onClick={ROLL_DICE}
                        aria-label="Roll the dice"
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200"
                      >
                        {isRolling ? "Rolling" : "Roll Dice"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => END_TURN(me?.user_id)}
                        aria-label="Move to next player"
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm rounded-full hover:from-amber-600 hover:to-rose-600 transform hover:scale-105 transition-all duration-200"
                      >
                        End Turn
                      </button>
                    )}
                    {rollAgain && (
                      <p className="text-xs font-normal text-red-600">You rolled a double 6 please roll again</p>
                    )}
                    {!isRolling && roll && !rollAgain && (
                      <p className="text-gray-300 text-sm text-center">
                        Rolled:{" "}
                        <span className="font-bold text-white">
                          {roll.die1} + {roll.die2} = {roll.total}
                        </span>
                      </p>
                    )}

                    {error && (
                      <p className="text-red-400 text-sm mt-2 text-center">
                        {error}
                      </p>
                    )}
                  </div>
                ) : (
                  <></>
                )}

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
                    className={`w-full h-full transform group-hover:scale-200 ${isTopHalf(square)
                      ? "origin-top group-hover:origin-bottom group-hover:translate-y-[100px]"
                      : ""
                      } group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200`}
                  >
                    {square.type === "property" && (
                      <PropertyCard
                        square={square}
                        owner={
                          my_properties.find((p) => p.id === square.id)
                            ? me?.username || null
                            : null
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
                          <button
                            type="button"
                            key={p.user_id}
                            className={`text-lg md:text-2xl ${p.user_id === game.next_player_id
                              ? "border-2 border-cyan-300 rounded"
                              : ""
                              }`}
                          >
                            {getPlayerSymbol(p.symbol)}
                          </button>
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
