/** Soft-launch username allowlists are retired — DMs and challenges are open to all. */
export const DM_PREVIEW_USERNAMES = ["ajisabo", "jaibois"];

export function canAccessDirectMessages(_username) {
  return true;
}

export function canAccessChallenges(_username) {
  return true;
}
