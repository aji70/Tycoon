/** Soft-launch usernames that can see Multiplayer / Join Game / global online list. */
export const MULTIPLAYER_PREVIEW_USERNAMES = ["ajisabo", "jaibois"] as const;

export function canAccessMultiplayerPreview(username?: string | null): boolean {
  const key = (username ?? "").trim().toLowerCase();
  return (MULTIPLAYER_PREVIEW_USERNAMES as readonly string[]).includes(key);
}
