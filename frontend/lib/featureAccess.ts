/** Soft-launch usernames for Multiplayer create/join, DMs, and challenges. */
export const MULTIPLAYER_PREVIEW_USERNAMES = ["ajisabo", "jaibois"] as const;

export function canAccessMultiplayerPreview(username?: string | null): boolean {
  const key = (username ?? "").trim().toLowerCase();
  return (MULTIPLAYER_PREVIEW_USERNAMES as readonly string[]).includes(key);
}

/** Who's online + public lobby — open to everyone. */
export function canAccessOnlineAndLobby(_username?: string | null): boolean {
  return true;
}

/** Soft-launch gate for 1:1 DMs. */
export function canAccessDirectMessages(username?: string | null): boolean {
  return canAccessMultiplayerPreview(username);
}

/** Online player challenges — open to all signed-in users. */
export function canAccessChallenges(_username?: string | null): boolean {
  return true;
}
