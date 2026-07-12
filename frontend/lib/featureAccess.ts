/**
 * Feature access flags.
 * Soft-launch username allowlists are retired — multiplayer, join, DMs, and challenges are open.
 */

/** @deprecated Soft-launch list retained for reference only; access is open to all. */
export const MULTIPLAYER_PREVIEW_USERNAMES = ["ajisabo", "jaibois"] as const;

/** Multiplayer create / join — open to everyone. */
export function canAccessMultiplayerPreview(_username?: string | null): boolean {
  return true;
}

/** Who's online + public lobby — open to everyone. */
export function canAccessOnlineAndLobby(_username?: string | null): boolean {
  return true;
}

/** 1:1 DMs — open to everyone. */
export function canAccessDirectMessages(_username?: string | null): boolean {
  return true;
}

/** Online player challenges — open to everyone. */
export function canAccessChallenges(_username?: string | null): boolean {
  return true;
}
