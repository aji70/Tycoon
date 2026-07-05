import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { isAlreadyRolledError, isBenignTurnOrderError } from "@/lib/utils/contractErrors";
import { gameBoardContractError, gameBoardToastError } from "@/lib/utils/gameBoardErrors";

type RollRecoveryContext = {
  userId: number;
  gameId: number;
  refetchGame: () => Promise<unknown>;
};

async function tryEndTurnAfterAlreadyRolled(ctx: RollRecoveryContext): Promise<void> {
  try {
    const endRes = await apiClient.post<{
      data?: { success?: boolean; message?: string };
      success?: boolean;
      message?: string;
    }>("/game-players/end-turn", { user_id: ctx.userId, game_id: ctx.gameId });

    const ok =
      (endRes?.data as { success?: boolean })?.success ??
      (endRes as { success?: boolean })?.success;
    const endMsg =
      (endRes?.data as { message?: string })?.message ??
      (endRes as { message?: string })?.message ??
      "";

    if (ok || (typeof endMsg === "string" && endMsg.includes("cannot end another player"))) {
      toast.success("Turn passed to next player.");
    } else if (!ok && endMsg && !isBenignTurnOrderError({ message: String(endMsg) })) {
      gameBoardToastError(endMsg);
    }
  } catch (endErr) {
    if (!isBenignTurnOrderError(endErr)) {
      gameBoardContractError(endErr, "Failed to pass turn");
    }
  }

  await ctx.refetchGame();
}

/**
 * Roll / change-position failures: recover from stale "already rolled" races silently,
 * only surface errors that are not benign turn-order noise (common during doubles chains).
 */
export async function recoverFromRollPositionError(
  error: unknown,
  ctx: RollRecoveryContext,
  fallback = "Roll failed"
): Promise<void> {
  if (isBenignTurnOrderError(error)) {
    await ctx.refetchGame();
    return;
  }

  if (isAlreadyRolledError(error)) {
    await tryEndTurnAfterAlreadyRolled(ctx);
    return;
  }

  gameBoardContractError(error, fallback);
  await ctx.refetchGame();
}

/** change-position or three-doubles failures — suppress benign races, refetch state. */
export async function recoverFromDoublesJailError(
  error: unknown,
  refetchGame: () => Promise<unknown>,
  fallback = "Failed to process three doubles"
): Promise<void> {
  if (isBenignTurnOrderError(error)) {
    await refetchGame();
    return;
  }
  gameBoardContractError(error, fallback);
  await refetchGame();
}
