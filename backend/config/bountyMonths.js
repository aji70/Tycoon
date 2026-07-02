/**
 * Bounty month definitions — keep in sync with frontend leaderboard-types.ts
 */

/** @typedef {'month' | 'range'} BountyPeriod */

/**
 * @typedef {object} BountyMonthConfig
 * @property {string} key YYYY-MM
 * @property {string} label
 * @property {boolean} completed
 * @property {number} prizeCount
 * @property {BountyPeriod} period
 * @property {string} [month] period=month
 * @property {string} [rangeStart] ISO UTC inclusive
 * @property {string} [rangeEnd] ISO UTC exclusive
 * @property {boolean} [featuredTab] default Bounty tab
 * @property {string} [sourceMonth] fetch another month's data (June uses May)
 * @property {boolean} [shuffleRanks] partial deterministic shuffle for display
 * @property {string} [shuffleSeed] seed for shuffleRanks
 * @property {number} [pinnedTopCount] keep API ranks 1..N fixed
 * @property {string[]} [curatedUsernames] inject into prize tail (May/June)
 */

/** May/June bounty display names — keep in sync with frontend leaderboard-types.ts */
export const MAY_JUNE_BOUNTY_CURATED_USERNAMES = [
  "praiz-francis",
  "samm",
  "daveilorah",
  "simply",
  "milah",
  "harlord",
  "Ejiro",
  "stilldarc",
  "amxauto",
  "nuem",
  "laateet",
  "macnelson",
  "vince",
  "mish",
  "mullah",
  "niffy",
  "ijafier",
  "llins",
];

/** @type {Record<string, BountyMonthConfig>} */
export const BOUNTY_MONTHS = {
  "2026-05": {
    key: "2026-05",
    label: "May 2026",
    completed: true,
    prizeCount: 40,
    period: "month",
    month: "2026-05",
    pinnedTopCount: 10,
    curatedUsernames: MAY_JUNE_BOUNTY_CURATED_USERNAMES,
    shuffleRanks: true,
    shuffleSeed: "2026-05",
  },
  "2026-06": {
    key: "2026-06",
    label: "June 2026",
    completed: true,
    prizeCount: 40,
    period: "month",
    month: "2026-05",
    sourceMonth: "2026-05",
    pinnedTopCount: 10,
    curatedUsernames: MAY_JUNE_BOUNTY_CURATED_USERNAMES,
    shuffleRanks: true,
    shuffleSeed: "2026-06",
  },
  "2026-07": {
    key: "2026-07",
    label: "July 2026",
    completed: false,
    prizeCount: 10,
    period: "month",
    month: "2026-07",
    featuredTab: true,
  },
};

export const FEATURED_BOUNTY_MONTH_KEY =
  Object.values(BOUNTY_MONTHS).find((m) => m.featuredTab)?.key || "2026-07";

export function getBountyMonthConfig(key) {
  if (!key) return null;
  return BOUNTY_MONTHS[String(key).trim()] ?? null;
}

/** @returns {import('./bountyMonths.js').BountyMonthConfig[]} */
export function listBountyMonths() {
  return Object.values(BOUNTY_MONTHS);
}

/**
 * Leaderboard API query for a bounty month config.
 * @returns {{ period: string, month?: string, start?: string, end?: string }}
 */
export function bountyMonthToLeaderboardQuery(config) {
  if (!config) return { period: "month" };
  if (config.period === "range") {
    return {
      period: "range",
      start: config.rangeStart,
      end: config.rangeEnd,
    };
  }
  return {
    period: "month",
    month: config.sourceMonth || config.month || config.key,
  };
}
