"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast, Toaster } from "react-hot-toast";

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
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";
import { BankruptcyModal } from "../modals/bankruptcy";
import { CardModal } from "../modals/cards";
import { PropertyActionModal } from "../modals/property-action";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory";

const MONOPOLY_STATS = {
  landingRank: {
    5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 11: 6, 13: 7, 14: 8, 16: 9, 18: 10,
    19: 11, 21: 12, 23: 13, 24: 14, 26: 15, 27: 16, 29: 17, 31: 18, 32: 19, 34: 20, 37: 21, 39: 22,
    1: 30, 2: 25, 3: 29, 4: 35, 12: 32, 17: 28, 22: 26, 28: 33, 33: 27, 36: 24, 38: 23,
  },
  colorGroups: {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
    railroad: [5, 15, 25, 35],
    utility: [12, 28],
  },
};

const BUILD_PRIORITY = ["orange", "red", "yellow", "pink", "lightblue", "green", "brown", "darkblue"];


const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 250;

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const JAIL_POSITION = 10;

const isAIPlayer = (player: Player | undefined): boolean =>
  player?.username?.toLowerCase().includes("ai_") ||
  player?.username?.toLowerCase().includes("bot") ||
  false;

const Board = ({
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
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isSpecialMove, setIsSpecialMove] = useState(false);

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const prevHistoryLength = useRef(game.history?.length ?? 0);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = isAIPlayer(currentPlayer);

  const playerCanRoll = Boolean(
    isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0
  );

  const currentPlayerInJail = currentPlayer?.position === JAIL_POSITION && currentPlayer?.in_jail === true;

  

  // const [endGameCandidate, setEndGameCandidate] = useState<{
  //   winner: Player | null;
  //   position: number;
  //   balance: bigint;
  // }>({ winner: null, position: 0, balance: BigInt(0) });

  const currentProperty = useMemo(() => {
    return currentPlayer?.position
      ? properties.find((p) => p.id === currentPlayer.position) ?? null
      : null;
  }, [currentPlayer?.position, properties]);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const onChainGameId = contractGame?.id;

  // const { write: endGame, isPending, reset } = useEndAiGame(
  //   Number(onChainGameId),
  //   endGameCandidate.position,
  //   endGameCandidate.balance,
  //   !!endGameCandidate.winner
  // );

  if (!game || !Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-2xl">
        Loading game board...
      </div>
    );
  }

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (message === lastToastMessage.current) return;
    lastToastMessage.current = message;

    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  // Sync players
  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
        if (res?.data?.success && res.data.data?.players) {
          setPlayers(res.data.data.players);
        }
      } catch (err) {
        console.error("Sync failed:", err);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [game.code]);

  // Reset turn state
  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    landedPositionThisTurn.current = null;
    rolledForPlayerId.current = null;
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
    setStrategyRanThisTurn(false);
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

  const BUY_PROPERTY = useCallback(async (isAiAction = false) => {
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

      showToast(isAiAction ? `AI bought ${justLandedProperty.name}!` : `You bought ${justLandedProperty.name}!`, "success");

      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      setTimeout(END_TURN, 800);
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
  // Prevent double calls / race conditions
  if (landedPositionThisTurn.current !== null) return;

  landedPositionThisTurn.current = newPosition;
  setIsSpecialMove(isSpecial);

  // Force buy prompt check
  setRoll({ die1: 0, die2: 0, total: 0 }); // fake roll just to trigger useEffect
  setHasMovementFinished(true);

  // Optional: tiny delay for better UX
  setTimeout(() => {
    const square = properties.find(p => p.id === newPosition);
    if (square?.price != null) {
      const isOwned = game_properties.some(gp => gp.property_id === newPosition);
      if (!isOwned && ["land", "railway", "utility"].includes(PROPERTY_ACTION(newPosition) || "")) {
        setBuyPrompted(true);
        toast(`Landed on ${square.name}! ${isSpecial ? "(Special Move)" : ""}`, { icon: "✨" });
      }
    }
  }, 300);
}, [properties, game_properties, setBuyPrompted, setHasMovementFinished]);

const endTurnAfterSpecialMove = useCallback(() => {
  setBuyPrompted(false);
  landedPositionThisTurn.current = null;
  setIsSpecialMove(false);
  setTimeout(END_TURN, 800);
}, [END_TURN]);

  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number) => {
    if (!propertyId || !newPlayerId) {
      toast("Cannot transfer: missing property or player");
      return;
    }

    try {
      const response = await apiClient.put<ApiResponse>(
        `/game-properties/${propertyId}`,
        {
          game_id: game.id,
          player_id: newPlayerId,
        }
      );

      if (response.data?.success) {
        toast.success("Property transferred successfully! 🎉");
      } else {
        throw new Error(response.data?.message || "Transfer failed");
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to transfer property";

      toast.error(message);
      console.error("Property transfer failed:", error);
    }
  };

  // ── AI STRATEGY HELPERS ─────────────────────────────────────

  const getPlayerOwnedProperties = (playerAddress: string | undefined, game_properties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];
    return game_properties
      .filter(gp => gp.address?.toLowerCase() === playerAddress.toLowerCase())
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!,
      }))
      .filter(item => !!item.prop);
  };

  const getCompleteMonopolies = (playerAddress: string | undefined, game_properties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];

    const owned = getPlayerOwnedProperties(playerAddress, game_properties, properties);
    const monopolies: string[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;

      const ownedInGroup = owned.filter(o => ids.includes(o.prop.id));
      if (ownedInGroup.length === ids.length) {
        const allUnmortgaged = ownedInGroup.every(o => !o.gp.mortgaged);
        if (allUnmortgaged) {
          monopolies.push(groupName);
        }
      }
    });

    return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
  };

  const getNearCompleteOpportunities = (playerAddress: string | undefined, game_properties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];

    const owned = getPlayerOwnedProperties(playerAddress, game_properties, properties);
    const opportunities: {
      group: string;
      needs: number;
      missing: { id: number; name: string; ownerAddress: string | null; ownerName: string }[];
    }[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;

      const ownedCount = owned.filter(o => ids.includes(o.prop.id)).length;
      const needs = ids.length - ownedCount;

      if (needs === 1 || needs === 2) {
        const missing = ids
          .filter(id => !owned.some(o => o.prop.id === id))
          .map(id => {
            const gp = game_properties.find(g => g.property_id === id);
            const prop = properties.find(p => p.id === id)!;
            const ownerName = gp?.address
              ? players.find(p => p.address?.toLowerCase() === gp.address?.toLowerCase())?.username || gp.address.slice(0, 8)
              : "Bank";
            return {
              id,
              name: prop.name,
              ownerAddress: gp?.address || null,
              ownerName,
            };
          });

        opportunities.push({ group: groupName, needs, missing });
      }
    });

    return opportunities.sort((a, b) => {
      if (a.needs !== b.needs) return a.needs - b.needs;
      return BUILD_PRIORITY.indexOf(a.group) - BUILD_PRIORITY.indexOf(b.group);
    });
  };

  const refreshGame = async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Refresh failed", err);
    }
  };



  const ROLL_DICE = useCallback(async (forAI = false) => {
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
      const playerId = forAI ? currentPlayerId : me!.user_id;
      const player = players.find((p) => p.user_id === playerId);
      if (!player) return;

      const currentPos = player.position ?? 0;
      const isInJail = player.in_jail === true && currentPos === JAIL_POSITION;

      console.log("player in jail", isInJail)


      let newPos = currentPos;
      let shouldAnimate = false;

      if (!isInJail) {
        const totalMove = value.total + pendingRoll;
        newPos = (currentPos + totalMove) % BOARD_SQUARES;
        shouldAnimate = totalMove > 0;

        if (shouldAnimate) {
          const movePath: number[] = [];
          for (let i = 1; i <= totalMove; i++) {
            movePath.push((currentPos + i) % BOARD_SQUARES);
          }

          for (let i = 0; i < movePath.length; i++) {
            await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
            setAnimatedPositions((prev) => ({
              ...prev,
              [playerId]: movePath[i],
            }));
          }
        }
      } else {
        showToast(
          `${player.username || "Player"} is in jail — rolled ${value.die1} + ${value.die2} = ${value.total}`,
          "default"
        );
      }

      setHasMovementFinished(true);

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: game.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        landedPositionThisTurn.current = isInJail ? null : newPos;

        if (!isInJail) {
          showToast(
            `${player.username || "Player"} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
            "success"
          );
        }

        if (forAI) rolledForPlayerId.current = currentPlayerId;
      } catch (err) {
        console.error("Move failed:", err);
        showToast("Move failed", "error");
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling, actionLock, lockAction, unlockAction,
    currentPlayerId, me, players, pendingRoll, game.id,
    showToast, END_TURN
  ]);


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

    const isOwned = game_properties.some(gp => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);

    const canBuy = !isOwned && isBuyableType;

    setBuyPrompted(canBuy);

    if (canBuy && (currentPlayer?.balance ?? 0) < square.price) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [
    roll,
    landedPositionThisTurn.current,
    hasMovementFinished,
    game_properties,
    properties,
    currentPlayer,
    showToast
  ]);


  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, isAITurn ? 1000 : 1200);

    return () => clearTimeout(timer);
  }, [roll, buyPrompted, isRolling, actionLock, isAITurn, END_TURN]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = (id: number) => {
    const gp = game_properties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    game_properties.find((gp) => gp.property_id === id)?.development ?? 0;

  const isPropertyMortgaged = (id: number) =>
    game_properties.find((gp) => gp.property_id === id)?.mortgaged === true;

  const handleRollDice = () => ROLL_DICE(false);
  const handleBuyProperty = () => BUY_PROPERTY(false);
  const handleSkipBuy = () => {
    showToast("Skipped purchase");
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 900);
  };

  const handleDeclareBankruptcy = async () => {
    showToast("Declaring bankruptcy...", "default");

    try {
      // if (endGame) await endGame();

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
    } catch (err) {
      showToast("Failed to end game", "error");
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

  const handlePropertyClick = (square: Property) => {
    const gp = game_properties.find(gp => gp.property_id === square.id);
    if (gp?.address === me?.address) {
      setSelectedProperty(square);
    } else {
      showToast("You don't own this property", "error");
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
              isRolling={isRolling}
              roll={roll}
              buyPrompted={buyPrompted}
              currentProperty={justLandedProperty || currentProperty}
              currentPlayerBalance={currentPlayer?.balance ?? 0}
              history={game.history ?? []}
              onRollDice={handleRollDice}
              onBuyProperty={handleBuyProperty}
              onSkipBuy={handleSkipBuy}
              onDeclareBankruptcy={handleDeclareBankruptcy}
              isPending={false}
            />

            {properties.map((square) => {
              const allPlayersHere = playersByPosition.get(square.id) ?? [];
              const playersHere = allPlayersHere;

              return (
                <BoardSquare
                  key={square.id}
                  square={square}
                  playersHere={playersHere}
                  currentPlayerId={currentPlayerId}
                  owner={propertyOwner(square.id)}
                  devLevel={developmentStage(square.id)}
                  mortgaged={isPropertyMortgaged(square.id)}
                  onClick={() => handlePropertyClick(square)}
                />
              );
            })}
          </div>
        </div>
      </div>

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

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        containerClassName="z-50"
        toastOptions={{
          duration: 3200,
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            border: "1px solid rgba(34, 211, 238, 0.3)",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 10px 30px rgba(0, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
          },
          success: { icon: "✔", style: { borderColor: "#10b981" } },
          error: { icon: "✖", style: { borderColor: "#ef4444" } },
        }}
      />

     {/* <CollectibleInventoryBar
  game={game}
  game_properties={game_properties}
  isMyTurn={isMyTurn}
  ROLL_DICE={ROLL_DICE}
  END_TURN={END_TURN}
  triggerSpecialLanding={triggerLandingLogic}
  endTurnAfterSpecial={endTurnAfterSpecialMove}
/> */}
    </div>
  );
};

export default Board;