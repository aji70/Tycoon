export type ArenaRank = "Legend" | "Diamond" | "Gold" | "Silver";
export type DecisionType = "BUY" | "SKIP" | "TRADE" | "BUILD" | "AUCTION";

export interface ShowcaseAgent {
  id: number;
  name: string;
  emoji: string;
  creator: string;
  rank: ArenaRank;
  wins: number;
  losses: number;
  xp: number;
  erc8004: boolean;
  erc8004Score?: number;
  address: string;
}

export interface DecisionFeedEntry {
  id: string;
  agentName: string;
  emoji: string;
  type: DecisionType;
  target: string;
  txHash: string;
  secondsAgo: number;
}

export const CELO_MAINNET_CHAIN_ID = 42220;
export const CELOSCAN_TX = "https://celoscan.io/tx/";
export const CELOSCAN_ADDR = "https://celoscan.io/address/";

export const SHOWCASE_AGENTS: ShowcaseAgent[] = [
  {
    id: 9001,
    name: "Jambox",
    emoji: "🎵",
    creator: "JamesJambox",
    rank: "Legend",
    wins: 12,
    losses: 7,
    xp: 28279,
    erc8004: true,
    erc8004Score: 94,
    address: "0x7a3f9c2e1b8d4a6f0e5c8b2d9a1f4e7c3b6d8a2f",
  },
  {
    id: 9002,
    name: "Loner",
    emoji: "🌙",
    creator: "Loner",
    rank: "Legend",
    wins: 0,
    losses: 0,
    xp: 16525,
    erc8004: true,
    erc8004Score: 88,
    address: "0x2e8b1c4f7a9d3e6b0f2a5c8d1e4b7a0c3f6e9d2b5a8",
  },
  {
    id: 9003,
    name: "Mimah_bot",
    emoji: "🤖",
    creator: "MimahYero",
    rank: "Diamond",
    wins: 0,
    losses: 0,
    xp: 11459,
    erc8004: false,
    address: "0x9d4e2a7f1c8b5e0a3d6f9c2b8e5a1d4f7c0b3e6a9d2",
  },
  {
    id: 9004,
    name: "OG_Bot",
    emoji: "👑",
    creator: "OG",
    rank: "Legend",
    wins: 24,
    losses: 3,
    xp: 41200,
    erc8004: true,
    erc8004Score: 97,
    address: "0x1f6a9c3e8b2d5f0a4c7e1b9d6f3a8c2e5b0d7f4a1c8e3",
  },
  {
    id: 9005,
    name: "DeepMonopoly",
    emoji: "🧠",
    creator: "deepbuilder",
    rank: "Gold",
    wins: 8,
    losses: 5,
    xp: 9800,
    erc8004: false,
    address: "0x5c8e2a1f9b4d7e0a3c6f2b8d5e1a9c4f7b0e3d6a2f5",
  },
  {
    id: 9006,
    name: "CeloMaxi",
    emoji: "💚",
    creator: "celofan",
    rank: "Diamond",
    wins: 3,
    losses: 2,
    xp: 7200,
    erc8004: true,
    erc8004Score: 91,
    address: "0x8b3f1e6a9c2d5f0b7e4a1c8d3f6b9e2a5c0f7d4b1e8a3",
  },
];

export const INITIAL_DECISION_FEED: DecisionFeedEntry[] = [
  {
    id: "d1",
    agentName: "OG_Bot",
    emoji: "👑",
    type: "BUY",
    target: "Boardwalk",
    txHash: "0xa3f8c2e91b4d7f0e5a2c8b6d1f9e4a7c3b0d5f2e8a1c6b9d4f7e2a5c8b1d0",
    secondsAgo: 12,
  },
  {
    id: "d2",
    agentName: "Jambox",
    emoji: "🎵",
    type: "TRADE",
    target: "Park Place ↔ St. James",
    txHash: "0x7e2b5a9c1d4f8e0a3b6c2d9f5e1a7c4b8d0f3e6a2c5b9d1f4e7a0c3b8d5f2",
    secondsAgo: 28,
  },
  {
    id: "d3",
    agentName: "CeloMaxi",
    emoji: "💚",
    type: "BUILD",
    target: "3 houses on Vermont Ave",
    txHash: "0x4c9e1a7f3b8d2e5a0c6f9b3d1e8a4c7f0b5d2e9a3c6f1b8d4e7a2c5f0b9d3",
    secondsAgo: 45,
  },
  {
    id: "d4",
    agentName: "DeepMonopoly",
    emoji: "🧠",
    type: "SKIP",
    target: "Marvin Gardens",
    txHash: "0xf2a8c5e1b9d4f7a0c3e6b2d8f1a5c9e4b7d0f3a6c2e8b5d1f9e4a7c0b3d6f2",
    secondsAgo: 61,
  },
  {
    id: "d5",
    agentName: "Loner",
    emoji: "🌙",
    type: "AUCTION",
    target: "Baltic Avenue — bid 120 USDC",
    txHash: "0x1d6f9a3c8e2b5f0a7c4e1d9b6f3a8c2e5b0d7f4a1c8e3b6d2f9e5a0c4b7d1",
    secondsAgo: 89,
  },
];

export const RANK_COLORS: Record<ArenaRank, string> = {
  Legend: "#FFD700",
  Diamond: "#00FFFF",
  Gold: "#FFFF00",
  Silver: "#C0C0C0",
};

export const DECISION_COLORS: Record<DecisionType, string> = {
  BUY: "#C8FF00",
  SKIP: "#6B7280",
  TRADE: "#00E5FF",
  BUILD: "#FFB020",
  AUCTION: "#FF4040",
};

export function truncateAddress(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end + 2) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

export function truncateHash(hash: string, start = 10, end = 6): string {
  if (hash.length <= start + end + 2) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

export function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}
