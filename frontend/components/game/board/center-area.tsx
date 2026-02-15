import { motion } from "framer-motion";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";

import { Property, Player, Game } from "@/types/game";

type CenterAreaProps = {
  isMyTurn: boolean;
  currentPlayer?: Player;
  me?: Player | null;
  game?: Game;
  playerCanRoll: boolean;
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
  buyPrompted: boolean;
  currentProperty: Property | null | undefined;
  currentPlayerBalance: number;
  history: Game["history"];
  onRollDice: () => void;
  onBuyProperty: () => void;
  onSkipBuy: () => void;
  onDeclareBankruptcy: () => void;
  isPending: boolean;
  timerSlot?: React.ReactNode;
  /** Seconds left to roll (90s turn timer); null when not applicable */
  turnTimeLeft?: number | null;
  /** Players that can be voted out (timed out OR 3+ consecutive timeouts) */
  voteablePlayers?: Player[];
  /** Vote status for each voteable player */
  voteStatuses?: Record<number, { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> }>;
  /** Loading state for voting */
  votingLoading?: Record<number, boolean>;
  onVoteToRemove?: (targetUserId: number) => void;
  /** Legacy: kept for backward compatibility */
  removablePlayers?: Player[];
  onRemoveInactive?: (targetUserId: number) => void;
  /** When true, show "Time's Up!" and hide Roll Dice (game ended by time) */
  gameTimeUp?: boolean;
};

export default function CenterArea({
  isMyTurn,
  currentPlayer,
  me,
  game,
  playerCanRoll,
  isRolling,
  roll,
  buyPrompted,
  currentProperty,
  currentPlayerBalance,
  history,
  onRollDice,
  onBuyProperty,
  onSkipBuy,
  onDeclareBankruptcy,
  isPending,
  timerSlot,
  turnTimeLeft,
  voteablePlayers,
  voteStatuses = {},
  votingLoading = {},
  onVoteToRemove,
  removablePlayers,
  onRemoveInactive,
  gameTimeUp = false,
}: CenterAreaProps) {
  return (
    <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative overflow-hidden"
      style={{
    backgroundImage: `url(/bb.jpg)`,
    backgroundSize: 'cover',    // ← usually good to add
    backgroundPosition: 'center',
  }}
    >
      {/* Dice Animation */}
      <DiceAnimation isRolling={isRolling} roll={roll} />

      {/* Roll Result */}
      {roll && !isRolling && <RollResult roll={roll} />}

      {/* Game Title */}
      <h1 className="text-3xl lg:text-5xl font-bold font-orbitron text-center mb-2 z-10 text-cyan-400">
        Tycoon
      </h1>

      {/* Multiplayer: "Username is playing" — right under Tycoon, above time (hidden when Time's Up) */}
      {!gameTimeUp && !isMyTurn && (
        <div className="text-center mb-4 z-10" aria-live="polite">
          <motion.h2
            className="text-xl font-bold text-cyan-400"
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {currentPlayer?.username ?? "Player"} is playing…
          </motion.h2>
        </div>
      )}

      {/* Game timer (countdown) in center */}
      {timerSlot && <div className="flex justify-center mb-4 z-10">{timerSlot}</div>}

      {/* Time's Up (net worth) — multiplayer game ended by time */}
      {gameTimeUp && (
        <div className="text-center mb-4 z-10 font-mono font-bold rounded-xl px-6 py-3 bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 text-lg">
          Time&apos;s Up!
        </div>
      )}

      {/* 90s turn timer — countdown stops when they roll; show to ALL players */}
      {turnTimeLeft != null && (
        <div className={`text-center mb-2 z-10 font-mono font-bold rounded-lg px-3 py-1.5 bg-black/90 ${(turnTimeLeft ?? 90) <= 10 ? "text-red-400 animate-pulse" : "text-cyan-300"}`}>
          {roll
            ? isMyTurn
              ? `Complete in ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")}`
              : `${currentPlayer?.username ?? "Player"} has ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")} to wrap up`
            : isMyTurn
              ? `Roll in ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")}`
              : `${currentPlayer?.username ?? "Player"} has ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")} to roll`}
        </div>
      )}

      {/* Vote to remove inactive/timed-out players - multiplayer only */}
      {voteablePlayers && voteablePlayers.length > 0 && onVoteToRemove && (
        <div className="flex flex-col items-center gap-3 mb-3 z-10 max-w-md">
          {voteablePlayers.map((p) => {
            const status = voteStatuses[p.user_id];
            const isLoading = votingLoading[p.user_id];
            const hasVoted = status?.voters?.some((v) => v.user_id === me?.user_id) ?? false;
            const voteRatio = status ? ` ${status.vote_count}/${status.required_votes}` : "";
            
            return (
              <div
                key={p.user_id}
                className="w-full flex justify-center"
              >
                <button
                  onClick={() => onVoteToRemove(p.user_id)}
                  disabled={isLoading || hasVoted}
                  className={`text-xs font-medium rounded-lg px-4 py-2 border transition-all ${
                    hasVoted
                      ? "bg-emerald-900/60 text-emerald-200 border-emerald-500/50 cursor-not-allowed"
                      : isLoading
                      ? "bg-amber-900/60 text-amber-200 border-amber-500/50 cursor-wait"
                      : "bg-cyan-900/70 text-cyan-100 border-cyan-500/50 hover:bg-cyan-800/80 hover:scale-105"
                  }`}
                >
                  {hasVoted ? `✓ Voted${voteRatio}` : isLoading ? "Voting..." : `Vote ${p.username} Out${voteRatio}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Legacy: Remove inactive player (3 consecutive 90s timeouts) - fallback if voteablePlayers not provided */}
      {!voteablePlayers && removablePlayers && removablePlayers.length > 0 && onRemoveInactive && (
        <div className="flex flex-wrap justify-center gap-2 mb-3 z-10">
          {removablePlayers.map((p) => (
            <button
              key={p.user_id}
              onClick={() => onRemoveInactive(p.user_id)}
              className="text-sm font-medium rounded-lg px-3 py-1.5 bg-amber-900/80 text-amber-200 border border-amber-500/50 hover:bg-amber-800/80"
            >
              Remove {p.username} (3 timeouts)
            </button>
          ))}
        </div>
      )}

      {/* Player's Turn: Roll or Bankruptcy (hidden when gameTimeUp) */}
      {!gameTimeUp && isMyTurn && !roll && !isRolling && (
        playerCanRoll ? (
          <button
            onClick={onRollDice}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-xl rounded-full hover:from-cyan-400 hover:to-cyan-500 transform hover:scale-110 active:scale-95 transition-all shadow-xl shadow-cyan-500/30 border border-cyan-400/30"
          >
            Roll Dice
          </button>
        ) : (
          <button
            onClick={onDeclareBankruptcy}
            disabled={isPending}
            className="px-12 py-6 bg-gradient-to-r from-red-700 to-red-900 text-white text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 border-4 border-red-500/50 disabled:opacity-70"
          >
            {isPending ? "Ending Game..." : "💔 Declare Bankruptcy"}
          </button>
        )
      )}

      {/* Buy Property Prompt (hidden when gameTimeUp) */}
      {!gameTimeUp && isMyTurn && buyPrompted && currentProperty && (
        <div className="flex gap-4 flex-wrap justify-center mt-4">
          <button
            onClick={onBuyProperty}
            disabled={currentProperty.price != null && currentPlayerBalance < currentProperty.price}
            className={`px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg ${
              currentProperty.price != null && currentPlayerBalance < currentProperty.price
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            Buy for ${currentProperty.price}
          </button>
          <button
            onClick={onSkipBuy}
            className="px-6 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            Skip
          </button>
        </div>
      )}

      {/* Multiplayer: Spinner when not my turn — in place of Roll Dice (hidden when Time's Up) */}
      {!gameTimeUp && !isMyTurn && (
        <div className="mt-5 flex justify-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-cyan-400 border-b-cyan-600/50" />
        </div>
      )}

      {/* Action Log at the bottom */}
      <ActionLog history={history} />
    </div>
  );
}