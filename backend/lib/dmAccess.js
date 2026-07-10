/** Soft-launch: DMs only. Challenges are open to all signed-in users. */
export const DM_PREVIEW_USERNAMES = ["ajisabo", "jaibois"];

export function canAccessDirectMessages(username) {
  const key = String(username ?? "")
    .trim()
    .toLowerCase();
  return DM_PREVIEW_USERNAMES.includes(key);
}

export function canAccessChallenges(_username) {
  return true;
}
