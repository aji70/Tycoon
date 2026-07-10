/** Soft-launch usernames that can see Multiplayer / Join Game / global online list / DMs. */
export const MULTIPLAYER_PREVIEW_USERNAMES = ["ajisabo", "jaibois"] as const;

export function canAccessMultiplayerPreview(username?: string | null): boolean {
  const key = (username ?? "").trim().toLowerCase();
  return (MULTIPLAYER_PREVIEW_USERNAMES as readonly string[]).includes(key);
}

/** Same soft-launch gate for 1:1 DMs. */
export function canAccessDirectMessages(username?: string | null): boolean {
  return canAccessMultiplayerPreview(username);
}

/** Same soft-launch gate for online player challenges. */
export function canAccessChallenges(username?: string | null): boolean {
  return canAccessMultiplayerPreview(username);
}
