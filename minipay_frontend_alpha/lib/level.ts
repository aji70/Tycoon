/**
 * Activity-based level and XP for Tycoon.
 * Level is derived from games played, wins, and (optional) property activity.
 */

export interface ActivityStats {
  gamesPlayed?: number;
  gamesWon?: number;
  gamesLost?: number;
  /** For guest users: total games from backend (my-games count) */
  totalGames?: number;
}

/** XP weights: playing gives base XP, wins give bonus */
const XP_PER_GAME = 12;
const XP_PER_WIN = 50;
const XP_PER_GUEST_GAME = 20;

/**
 * Compute total XP from activity.
 * Wallet users: use contract stats (gamesPlayed, gamesWon).
 * Guest users: use totalGames (e.g. from my-games count) with XP_PER_GUEST_GAME.
 */
export function computeXP(stats: ActivityStats): number {
  if (stats.totalGames !== undefined) {
    return stats.totalGames * XP_PER_GUEST_GAME;
  }
  const played = Number(stats.gamesPlayed) || 0;
  const won = Number(stats.gamesWon) || 0;
  return played * XP_PER_GAME + won * XP_PER_WIN;
}

/** Level thresholds (XP required to reach that level). Level 1 = 0, then 100, 250, 450, 700, 1000, ... */
const LEVEL_XP_THRESHOLDS: number[] = (() => {
  const arr: number[] = [0];
  for (let l = 1; l <= 99; l++) {
    // Level 2 = 100, 3 = 250, 4 = 450, 5 = 700, 6 = 1000, 7 = 1350, ...
    // Formula: cumulative XP for level L = 50 * L * (L + 1) roughly, so threshold[L] = 50 * L * (L-1) / 2 + 100*(L-1)
    const prev = arr[l - 1];
    const next = prev + 80 + (l - 1) * 25;
    arr.push(next);
  }
  return arr;
})();

const MAX_LEVEL = LEVEL_XP_THRESHOLDS.length;

export interface LevelInfo {
  level: number;
  xp: number;
  xpInLevel: number;
  xpForNextLevel: number;
  progress: number;
  label: string;
}

/**
 * Get level and progress from total XP.
 */
export function getLevelFromXP(totalXP: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXP));
  let level = 1;
  for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const capLevel = Math.min(level, MAX_LEVEL);
  const xpAtLevelStart = LEVEL_XP_THRESHOLDS[capLevel - 1] ?? 0;
  const xpAtNextLevel = LEVEL_XP_THRESHOLDS[capLevel] ?? xpAtLevelStart + 500;
  const xpInLevel = xp - xpAtLevelStart;
  const xpForNextLevel = xpAtNextLevel - xpAtLevelStart;
  const progress = capLevel >= MAX_LEVEL ? 1 : xpForNextLevel > 0 ? xpInLevel / xpForNextLevel : 0;

  const labels: Record<number, string> = {
    1: "Rookie",
    2: "Player",
    3: "Trader",
    4: "Investor",
    5: "Tycoon",
    6: "Mogul",
    7: "Magnate",
    8: "Baron",
    9: "Legend",
    10: "Champion",
  };
  const label = labels[capLevel] ?? (capLevel > 10 ? "Elite" : `Level ${capLevel}`);

  return {
    level: capLevel,
    xp: totalXP,
    xpInLevel,
    xpForNextLevel,
    progress: Math.min(1, Math.max(0, progress)),
    label,
  };
}

/**
 * Get level info from activity stats (one-step helper).
 */
export function getLevelFromActivity(stats: ActivityStats): LevelInfo {
  const xp = computeXP(stats);
  return getLevelFromXP(xp);
}
