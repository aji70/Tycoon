/** Soft-launch: only these usernames may use DMs. */
export const DM_PREVIEW_USERNAMES = ["ajisabo", "jaibois"];

export function canAccessDirectMessages(username) {
  const key = String(username ?? "")
    .trim()
    .toLowerCase();
  return DM_PREVIEW_USERNAMES.includes(key);
}
