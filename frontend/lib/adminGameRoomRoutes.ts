export const CANCELLABLE_GAME_STATUSES = new Set([
  "PENDING",
  "RUNNING",
  "IN_PROGRESS",
  "AWAITING_PLAYERS",
]);

type GamePlayRouteInput = {
  code: string;
  status: string;
  isAi?: boolean;
};

/** Frontend path to view or join a game (waiting room or board). */
export function getAdminGamePlayPath({ code, status, isAi }: GamePlayRouteInput): string {
  const q = `gameCode=${encodeURIComponent(code)}`;
  if (status === "PENDING" || status === "AWAITING_PLAYERS") {
    return `/game-waiting-3d?${q}`;
  }
  if (isAi) {
    return `/board-3d?${q}`;
  }
  return `/board-3d-multi?${q}`;
}

export function canCancelGameStatus(status: string): boolean {
  return CANCELLABLE_GAME_STATUSES.has(status);
}
