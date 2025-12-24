// "use client";

// import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
// import { Toaster } from "react-hot-toast";
// import { motion, AnimatePresence } from "framer-motion";
// import { Game, GameProperty, Player, Property } from "@/types/game";
// import { useGameSync } from "@/hooks/useGameSync";
// import { useDiceRoll, RollResult } from "@/hooks/useDiceRoll";
// import { useTurnActions } from "@/hooks/useTurnActions";
// import { useGameEnd } from "@/hooks/useEndGame";
// import BoardGrid from "./BoardGrid";
// import CenterInfo from "./CenterInfo";
// import GameOverOverlay from "./GameOverLay";
// import ExitConfirmation from "./ExitConfirmation";
// import { calculateBuyScore } from "@/utils/monopolyUtils";
// import { apiClient } from "@/lib/api";
// import toast from "react-hot-toast";

// interface AiBoardProps {
//   game: Game;
//   properties: Property[];
//   game_properties: GameProperty[];
//   me: Player | null;
// }

// const BOARD_SQUARES = 40;
// const ROLL_ANIMATION_MS = 1200;

// export default function AiBoard({ game, properties, game_properties, me }: AiBoardProps) {
//   const { players, setPlayers, currentPlayer, isMyTurn, isAITurn } = useGameSync(game, me);

//   // Define currentPlayerId — fixes "Cannot find name" error
//   const currentPlayerId = game.next_player_id;

//   const dice = useDiceRoll({
//     gameId: game.id,
//     currentPlayer,
//     currentPosition: currentPlayer?.position ?? undefined,
//     onPositionUpdate: (newPos: number) => {
//       setPlayers((prev: Player[]) => {
//         return prev.map((player) =>
//           player.user_id === currentPlayer?.user_id
//             ? { ...player, position: newPos }
//             : player
//         );
//       });
//     },
//   });

//   const currentProperty = useMemo(
//     () => properties.find((p) => p.id === currentPlayer?.position) ?? null,
//     [properties, currentPlayer?.position]
//   );

//   const buyScore = useMemo(() => {
//     if (!isAITurn || !currentPlayer || !currentProperty) return null;
//     return calculateBuyScore(currentProperty, currentPlayer, game_properties, properties);
//   }, [isAITurn, currentPlayer, currentProperty, game_properties, properties]);

//   const actions = useTurnActions({
//     game,
//     properties,
//     game_properties,
//     me,
//     currentPlayer,
//     players,
//     setPlayers,
//     currentProperty,
//     dice,
//     isMyTurn,
//     isAITurn,
//     buyScore,
//   });

//   const endGameLogic = useGameEnd({ game, me, players });

//   // ────────────────────────────────────────────────────────────────
//   // RESTORED DICE ROLLING & AI TURN LOGIC — directly in component
//   // ────────────────────────────────────────────────────────────────

//   const [pendingRoll, setPendingRoll] = useState(0);
//   const rolledForPlayerId = useRef<number | null>(null);

//   const rollDice = useCallback(async (forAI = false) => {
//     if (dice.isRolling || actions.actionLock || !actions.lockAction?.("ROLL")) return;

//     dice.setIsRolling(true);
//     dice.setRoll(null);

//     setTimeout(async () => {
//       const value = Math.random() > 0.98 ? null : {
//         die1: Math.floor(Math.random() * 6) + 1,
//         die2: Math.floor(Math.random() * 6) + 1,
//         total: 0,
//       };

//       if (value === null) {
//         toast.success("DOUBLES! Roll again!", { duration: 3000 });
//         dice.setIsRolling(false);
//         actions.unlockAction?.();
//         return;
//       }

//       value.total = value.die1 + value.die2;

//       dice.setRoll(value);
//       const playerId = forAI ? currentPlayerId! : me!.user_id;
//       const currentPos = players.find((p) => p.user_id === playerId)?.position ?? 0;
//       const newPos = (currentPos + value.total + pendingRoll) % BOARD_SQUARES;

//       try {
//         await apiClient.post("/game-players/change-position", {
//           user_id: playerId,
//           game_id: game.id,
//           position: newPos,
//           rolled: value.total + pendingRoll,
//           is_double: value.die1 === value.die2,
//         });

//         setPendingRoll(0);
//         await fetchUpdatedGame(); // assuming you have this in scope or from hook

//         toast.success(
//           `${currentPlayer?.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
//           "success"
//         );

//         if (forAI) rolledForPlayerId.current = currentPlayerId;
//       } catch {
//         toast.error("Move failed");
//         actions.endTurn?.();
//       } finally {
//         dice.setIsRolling(false);
//         actions.unlockAction?.();
//       }
//     }, ROLL_ANIMATION_MS);
//   }, [
//     dice,
//     actions,
//     currentPlayerId,
//     me,
//     players,
//     pendingRoll,
//     game.id,
//     currentPlayer?.username,
//   ]);

//   // AI Auto-roll
//   useEffect(() => {
//     if (!isAITurn || dice.isRolling || dice.roll || rolledForPlayerId.current === currentPlayerId) return;

//     console.log("[AI] Scheduling auto-roll in 1.2s...");
//     const timer = setTimeout(() => {
//       console.log("[AI] Executing roll!");
//       rolledForPlayerId.current = currentPlayerId;
//       rollDice(true);
//     }, 1200);

//     return () => clearTimeout(timer);
//   }, [isAITurn, dice.isRolling, dice.roll, currentPlayerId, rollDice]);

//   // ... rest of your AI buy/end logic, buy prompt detection, etc. can be added here if needed ...

//   return (
//     <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative overflow-hidden">
//       {/* Overlays */}
//       <AnimatePresence mode="wait">
//         {endGameLogic.winner && (
//           <GameOverOverlay
//             winner={endGameLogic.winner}
//             me={me}
//             onExitAttempt={endGameLogic.handleExitAttempt}
//           />
//         )}
//       </AnimatePresence>

//       <ExitConfirmation
//         show={endGameLogic.showExitPrompt}
//         winner={endGameLogic.winner}
//         isPending={endGameLogic.isPending}
//         onConfirm={endGameLogic.handleFinalizeAndLeave}
//         onSkip={() => endGameLogic.setShowExitPrompt(false)}
//         me={me}
//       />

//       {/* Main Board Container */}
//       <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[850px] mt-[-1rem] relative z-10">
//         <motion.div
//           className="w-full bg-[#010F10] aspect-square rounded-2xl relative shadow-2xl shadow-cyan-500/20 border-4 border-cyan-900/50 overflow-hidden"
//           initial={{ scale: 0.95, opacity: 0 }}
//           animate={{ scale: 1, opacity: 1 }}
//           transition={{ duration: 0.6, ease: "easeOut" }}
//         >
//           <BoardGrid
//             properties={properties}
//             game_properties={game_properties}
//             players={players}
//             currentPlayerId={currentPlayerId}
//           />

//           <CenterInfo
//             isMyTurn={isMyTurn}
//             isAITurn={isAITurn}
//             currentPlayer={currentPlayer}
//             dice={dice}
//             currentProperty={currentProperty}
//             buyPrompted={actions.buyPrompted}
//             buyScore={buyScore}
//             playerCanRoll={actions.playerCanRoll}
//             onRoll={() => rollDice(false)}
//             onBuy={actions.buyProperty}
//             onSkipBuy={actions.skipBuy}
//             onEndTurn={actions.endTurn}
//             onBankruptcy={endGameLogic.handleDeclareBankruptcy}
//             actionLog={(game.history ?? []).map((item): {
//               player_name: string;
//               comment: string;
//               rolled?: number;
//             } => ({
//               player_name: item.player_name ?? "Unknown Player",
//               comment: item.comment ?? "No comment",
//               rolled: item.rolled ?? undefined,
//             }))}
//             currentPlayerUsername={currentPlayer?.username}
//           />
//         </motion.div>
//       </div>

//       <Toaster
//         position="top-center"
//         reverseOrder={false}
//         gutter={16}
//         containerClassName="z-[100]"
//         toastOptions={{
//           duration: 4000,
//           style: {
//             background: "rgba(15, 23, 42, 0.97)",
//             color: "#f8fafc",
//             border: "1px solid rgba(34, 211, 238, 0.4)",
//             borderRadius: "16px",
//             padding: "16px 24px",
//             fontSize: "16px",
//             fontWeight: "600",
//             boxShadow: "0 20px 40px rgba(0, 255, 255, 0.2)",
//             backdropFilter: "blur(16px)",
//             maxWidth: "420px",
//           },
//           success: { icon: "✅", style: { borderColor: "#10b981" } },
//           error: { icon: "❌", style: { borderColor: "#ef4444" } },
//         }}
//       />
//     </div>
//   );
// }