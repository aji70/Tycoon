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
      <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-6 z-10">
        Tycoon
      </h1>

      {/* Game timer (countdown) in center */}
      {timerSlot && <div className="flex justify-center mb-4 z-10">{timerSlot}</div>}

      {/* 90s roll countdown — show only while waiting to roll; hide as soon as they click Roll Dice */}
      {isMyTurn && !roll && !isRolling && (
        <div className={`text-center mb-2 z-10 font-mono font-bold rounded-lg px-3 py-1.5 bg-black/90 ${(turnTimeLeft ?? 90) <= 10 ? "text-red-400 animate-pulse" : "text-cyan-300"}`}>
          Roll in {Math.floor((turnTimeLeft ?? 90) / 60)}:{((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")}
        </div>
      )}

      {/* Vote to remove inactive/timed-out players - multiplayer only */}
      {voteablePlayers && voteablePlayers.length > 0 && onVoteToRemove && (
        <div className="flex flex-col items-center gap-3 mb-3 z-10 max-w-md">
          {voteablePlayers.map((p) => {
            const strikes = p.consecutive_timeouts ?? 0;
            const hasThreeStrikes = strikes >= 3;
            const status = voteStatuses[p.user_id];
            const isLoading = votingLoading[p.user_id];
            const hasVoted = status?.voters?.some((v) => v.user_id === me?.user_id) ?? false;
            
            return (
              <div
                key={p.user_id}
                className="w-full bg-red-950/60 border border-red-500/50 rounded-lg p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-red-300">
                      {p.username}
                      {strikes > 0 && ` (${strikes} timeout${strikes > 1 ? 's' : ''})`}
                    </span>
                    {status && (
                      <span className="text-xs text-red-200/70">
                        Votes: {status.vote_count}/{status.required_votes}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onVoteToRemove(p.user_id)}
                    disabled={isLoading || hasVoted}
                    className={`text-xs font-medium rounded-lg px-4 py-2 border transition-all ${
                      hasVoted
                        ? "bg-green-900/60 text-green-200 border-green-500/50 cursor-not-allowed"
                        : isLoading
                        ? "bg-amber-900/60 text-amber-200 border-amber-500/50 cursor-wait"
                        : "bg-red-900/80 text-red-200 border-red-500/50 hover:bg-red-800/80 hover:scale-105"
                    }`}
                  >
                    {hasVoted ? "✓ Voted" : isLoading ? "Voting..." : `Vote ${p.username} Out`}
                  </button>
                </div>
                {status && status.voters && status.voters.length > 0 && (
                  <div className="text-xs text-red-200/50">
                    Voted by: {status.voters.map((v) => v.username).join(", ")}
                  </div>
                )}
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

      {/* Player's Turn: Roll or Bankruptcy */}
      {isMyTurn && !roll && !isRolling && (
        playerCanRoll ? (
          <button
            onClick={onRollDice}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-xl"
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

      {/* Buy Property Prompt */}
      {isMyTurn && buyPrompted && currentProperty && (
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

      {/* AI Turn Indicator */}
      {!isMyTurn && (
        <div className="mt-5 text-center z-10">
          <motion.h2
            className="text-2xl font-bold text-pink-300 mb-3"
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {currentPlayer?.username} is playing…
          </motion.h2>
     
          <div className="flex justify-center mt-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400"></div>
          </div>
         
        </div>
      )}

      {/* Action Log at the bottom */}
      <ActionLog history={history} />
    </div>
  );
}