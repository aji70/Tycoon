/** Where the player currently is in the app (for global online list). */
export type PresenceStatus = "lobby" | "waiting" | "game";

export function presenceStatusRank(status?: string | null): number {
  if (status === "game") return 3;
  if (status === "waiting") return 2;
  return 1;
}

export function resolvePresenceFromPath(
  pathname: string | null | undefined,
  gameCode?: string | null
): { status: PresenceStatus; gameCode?: string } {
  const path = pathname || "";
  const code = gameCode?.trim() ? gameCode.trim().toUpperCase() : undefined;

  const onBoard =
    path.includes("/board-3d") ||
    path.includes("/board-3d-mobile") ||
    path.includes("/board-3d-multi") ||
    path.includes("/game-play") ||
    path.includes("/ai-play");

  if (onBoard) {
    return { status: "game", gameCode: code };
  }

  if (path.includes("/game-waiting")) {
    return { status: "waiting", gameCode: code };
  }

  return { status: "lobby" };
}

export function presenceStatusLabel(status?: string | null, gameCode?: string | null): string {
  if (status === "game") {
    return gameCode ? `In game · ${gameCode}` : "In game";
  }
  if (status === "waiting") {
    return gameCode ? `War room · ${gameCode}` : "In war room";
  }
  return "In lobby";
}
