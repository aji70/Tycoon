"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast, Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { apiClient } from "@/lib/api";

// Child components
import BoardSquare from "./board-square";
import CenterArea from "./center-area";
import { ApiResponse } from "@/types/api";
import { BankruptcyModal } from "../modals/bankruptcy";
import { CardModal } from "../modals/cards";
import { PropertyActionModal } from "../modals/property-action";
import { VictoryModal } from "../modals/victory";

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 250;

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const MultiplayerBoard = ({
  game,
  properties,
  game_properties,
  me,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
}) => {
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [currentGameProperties, setCurrentGameProperties] = useState<GameProperty[]>(game_properties);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isSpecialMove, setIsSpecialMove] = useState(false);
  const [isPendingBankruptcy, setIsPendingBankruptcy] = useState(false);

  // Winner & claim states
  const [winner, setWinner] = useState<Player | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  const isMyTurn = me?.user_id === currentPlayerId;

  // NEW: Allow negative balance, but block roll if ≤ 0
  const playerCanRoll = Boolean(
    isMyTurn &&
    currentPlayer &&
    (currentPlayer.balance ?? 0) > 0 &&  // Must have positive balance to roll
    !currentPlayer.in_jail
  );

  // NEW: Player is insolvent (balance ≤ 0) on their turn
  const isInsolvent: boolean = isMyTurn && !!currentPlayer && (currentPlayer.balance ?? 0) <= 0;

  const currentProperty = useMemo(() => {
    return currentPlayer?.position
      ? properties.find((p) => p.id === currentPlayer.position) ?? null
      : null;
  }, [currentPlayer?.position, properties]);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (message === lastToastMessage.current) return;
    lastToastMessage.current = message;

    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  // Sync players & properties
  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const gameRes = await apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`);
      if (gameRes?.data?.success && gameRes.data.data) {
        setPlayers(gameRes.data.data.players);
      }
      const propertiesRes = await apiClient.get<ApiResponse<GameProperty[]>>(`/game-properties/game/${game.id}`);
      if (propertiesRes?.data?.success && propertiesRes.data.data) {
        setCurrentGameProperties(propertiesRes.data.data);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [game.code, game.id]);

  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 5000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame]);

  // Winner detection - when only one player with positive balance remains
  useEffect(() => {
    if (!players.length || game.status === "FINISHED" || winner) return;

    const activePlayers = players.filter(p => (p.balance ?? 0) > 0);

    if (activePlayers.length === 1) {
      const theWinner = activePlayers[0];
      setWinner(theWinner);

      apiClient.put<ApiResponse>(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: theWinner.user_id,
      }).catch(err => {
        console.error("Failed to finalize game status:", err);
      });

      showToast(`${theWinner.username} wins the game! 🎉`, "success");
    }
  }, [players, game.status, game.id, winner, showToast]);

  // Reset turn state when player changes
  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    landedPositionThisTurn.current = null;
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
  }, [currentPlayerId]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const END_TURN = useCallback(async () => {
    if (currentPlayerId === -1 || turnEndInProgress.current || !lockAction("END")) return;

    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
      });
      showToast("Turn ended", "success");
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, game.id, lockAction, unlockAction, showToast]);

  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock || !justLandedProperty?.price) {
      showToast("Cannot buy right now", "error");
      return;
    }

    const playerBalance = currentPlayer.balance ?? 0;
    if (playerBalance < justLandedProperty.price) {
      showToast("Not enough money!", "error");
      return;
    }

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
        property_id: justLandedProperty.id,
      });

      showToast(`${currentPlayer.username} bought ${justLandedProperty.name}!`, "success");

      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      setTimeout(END_TURN, 800);
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id]);

  // Bankruptcy Helpers
  const getGamePlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const ownedProp = currentGameProperties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return ownedProp?.player_id ?? null;
  };

  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number, player_address: string): Promise<boolean> => {
    if (!propertyId || !newPlayerId) {
      showToast("Cannot transfer: missing property or player", "error");
      return false;
    }

    try {
      const response = await apiClient.put<ApiResponse>(
        `/game-properties/${propertyId}`,
        {
          game_id: game.id,
          player_id: newPlayerId,
        }
      );
      return !!response.data?.success;
    } catch (error: any) {
      showToast(error?.message || "Failed to transfer property", "error");
      return false;
    }
  };

  const handleDeleteGameProperty = async (id: number): Promise<boolean> => {
    try {
      const res = await apiClient.delete<ApiResponse>(`/game-properties/${id}`, {
        data: { game_id: game.id }
      });
      return !!res?.data?.success;
    } catch (error: any) {
      showToast(error?.message || "Failed to return property to bank", "error");
      return false;
    }
  };

  const handleDeclareBankruptcy = async () => {
    if (!me || !currentPlayer || isPendingBankruptcy) return;

    setIsPendingBankruptcy(true);
    showToast("Declaring bankruptcy... Processing properties...", "default");

    try {
      const currentPos = currentPlayer.position ?? 0;
      const landedGameProperty = currentGameProperties.find(
        gp => gp.property_id === currentPos
      );
      const creditorAddress = landedGameProperty?.address &&
        landedGameProperty.address !== "bank" &&
        landedGameProperty.address !== currentPlayer.address
        ? landedGameProperty.address
        : null;

      const creditorPlayer = creditorAddress
        ? players.find(p => p.address?.toLowerCase() === creditorAddress.toLowerCase())
        : null;

      const bankruptProperties = currentGameProperties.filter(
        gp => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase()
      );

      let successCount = 0;
      let actionDescription = "";

      if (creditorPlayer && creditorPlayer.user_id !== currentPlayer.user_id) {
        const creditorPlayerId = getGamePlayerId(creditorPlayer.address);
        if (!creditorPlayerId) throw new Error("Cannot find creditor player ID");

        showToast(`Transferring ${bankruptProperties.length} properties to ${creditorPlayer.username}...`, "success");
        actionDescription = `to ${creditorPlayer.username}`;

        for (const prop of bankruptProperties) {
          const success = await handlePropertyTransfer(prop.id, creditorPlayerId, creditorPlayer.address!);
          if (success) successCount++;
        }
      } else {
        showToast(`Returning ${bankruptProperties.length} properties to bank...`, "default");
        actionDescription = "to bank";

        for (const prop of bankruptProperties) {
          const success = await handleDeleteGameProperty(prop.id);
          if (success) successCount++;
        }
      }

      await apiClient.post("/game-players/leave", {
        address: currentPlayer.address,
        code: game.code,
        reason: "bankruptcy",
      });

      showToast(
        `Bankruptcy complete! ${successCount}/${bankruptProperties.length} properties transferred ${actionDescription}.`,
        "error"
      );

      await fetchUpdatedGame();
      setShowBankruptcyModal(true);
    } catch (err: any) {
      showToast(err?.message || "Bankruptcy process failed", "error");
    } finally {
      setIsPendingBankruptcy(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!winner || !me || winner.user_id !== me.user_id) return;

    setIsClaiming(true);
    setClaimError(null);

    try {
      await apiClient.post("/games/claim-victory", {
        game_id: game.id,
        user_id: me.user_id,
      });

      showToast("Rewards claimed successfully! 🎉", "success");

      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (err: any) {
      const message = err?.message || "Failed to claim rewards";
      setClaimError(message);
      showToast(message, "error");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRollDice = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        showToast("DOUBLES! Roll again!", "success");
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);
      const player = currentPlayer;
      if (!player) return;

      const currentPos = player.position ?? 0;
      const totalMove = value.total + pendingRoll;
      const newPos = (currentPos + totalMove) % BOARD_SQUARES;

      if (totalMove > 0) {
        const movePath: number[] = [];
        for (let i = 1; i <= totalMove; i++) {
          movePath.push((currentPos + i) % BOARD_SQUARES);
        }

        for (let i = 0; i < movePath.length; i++) {
          await new Promise(resolve => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
          setAnimatedPositions(prev => ({
            ...prev,
            [currentPlayerId]: movePath[i],
          }));
        }
      }

      setHasMovementFinished(true);

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: currentPlayerId,
          game_id: game.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        landedPositionThisTurn.current = newPos;

        showToast(
          `${player.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
          "success"
        );
      } catch (err) {
        showToast("Move failed", "error");
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    currentPlayerId,
    currentPlayer,
    pendingRoll,
    game.id,
    showToast,
    END_TURN,
  ]);

  // Buy prompt detection
  useEffect(() => {
    if (!roll || landedPositionThisTurn.current === null || !hasMovementFinished) {
      setBuyPrompted(false);
      return;
    }

    const pos = landedPositionThisTurn.current;
    const square = properties.find(p => p.id === pos);

    if (!square || square.price == null) {
      setBuyPrompted(false);
      return;
    }

    const isOwned = currentGameProperties.some(gp => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyable = !!action && ["land", "railway", "utility"].includes(action);

    setBuyPrompted(!isOwned && isBuyable);
  }, [roll, landedPositionThisTurn.current, hasMovementFinished, currentGameProperties, properties]);

  // Auto end turn after roll (if no action needed)
  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll) return;

    const timer = setTimeout(END_TURN, 2000);
    return () => clearTimeout(timer);
  }, [roll, buyPrompted, isRolling, actionLock, END_TURN]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] ?? (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = (id: number) => {
    const gp = currentGameProperties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.development ?? 0;

  const isPropertyMortgaged = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.mortgaged === true;

  const handlePropertyClick = (square: Property) => {
    const gp = currentGameProperties.find(gp => gp.property_id === square.id);
    if (gp?.address === me?.address) {
      setSelectedProperty(square);
    } else {
      showToast("You don't own this property", "error");
    }
  };

  const handleDevelopment = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property developed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to develop property");
    }
  };

  const handleDowngrade = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property downgraded successfully");
      else toast.error(res.data?.message ?? "Failed to downgrade property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to downgrade property");
    }
  };

  const handleMortgage = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property mortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to mortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mortgage property");
    }
  };

  const handleUnmortgage = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property unmortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to unmortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to unmortgage property");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
            <CenterArea
              isMyTurn={isMyTurn}
              currentPlayer={currentPlayer}
              playerCanRoll={playerCanRoll}
              isInsolvent={isInsolvent} 
              isRolling={isRolling}
              roll={roll}
              buyPrompted={buyPrompted}
              currentProperty={justLandedProperty || currentProperty}
              currentPlayerBalance={currentPlayer?.balance ?? 0}
              history={game.history ?? []}
              onRollDice={handleRollDice}
              onBuyProperty={BUY_PROPERTY}
              onSkipBuy={() => {
                showToast("Skipped purchase");
                setBuyPrompted(false);
                landedPositionThisTurn.current = null;
                setTimeout(END_TURN, 900);
              }}
              onDeclareBankruptcy={handleDeclareBankruptcy}
              isPending={isPendingBankruptcy}
            />

            {properties.map((square) => (
              <BoardSquare
                key={square.id}
                square={square}
                playersHere={playersByPosition.get(square.id) ?? []}
                currentPlayerId={currentPlayerId}
                owner={propertyOwner(square.id)}
                devLevel={developmentStage(square.id)}
                mortgaged={isPropertyMortgaged(square.id)}
                onClick={() => handlePropertyClick(square)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      />

      <BankruptcyModal
        isOpen={showBankruptcyModal}
        tokensAwarded={0.5}
        onReturnHome={() => window.location.href = "/"}
      />

      <PropertyActionModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onDevelop={handleDevelopment}
        onDowngrade={handleDowngrade}
        onMortgage={handleMortgage}
        onUnmortgage={handleUnmortgage}
      />

      {/* Victory Modal - only visible to the winner */}
      <VictoryModal
        winner={winner}
        me={me}
        onClaim={handleClaimRewards}
        claiming={isClaiming}
        claimError={claimError}
        onClearError={() => setClaimError(null)}
      />

      {/* Game Over screen for non-winners */}
      <AnimatePresence>
        {winner && winner.user_id !== me?.user_id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9998] p-4"
          >
            <div className="text-center">
              <h2 className="text-5xl font-bold text-gray-300 mb-6">Game Over</h2>
              <p className="text-2xl text-white mb-8">
                {winner.username} is the winner!
              </p>
              <button
                onClick={() => window.location.href = "/"}
                className="px-10 py-5 bg-gray-700 hover:bg-gray-600 rounded-xl text-white text-xl"
              >
                Return to Lobby
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster position="top-center" />
    </div>
  );
};

export default MultiplayerBoard;