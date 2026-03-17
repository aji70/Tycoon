import {
  Zap,
  Sparkles,
  Coins,
  Shield,
  Gem,
  Ticket,
  Star,
  KeyRound,
} from "lucide-react";
// Local enum for perk IDs (matches on-chain and ContractProvider; avoids client-only import during prerender).
export enum CollectiblePerk {
  NONE = 0,
  EXTRA_TURN = 1,
  JAIL_FREE = 2,
  DOUBLE_RENT = 3,
  ROLL_BOOST = 4,
  CASH_TIERED = 5,
  TELEPORT = 6,
  SHIELD = 7,
  PROPERTY_DISCOUNT = 8,
  TAX_REFUND = 9,
  ROLL_EXACT = 10,
  RENT_CASHBACK = 11,
  INTEREST = 12,
  LUCKY_7 = 13,
  FREE_PARKING_BONUS = 14,
}

export const PERK_NAMES: Record<number, string> = {
  [0]: "None",
  [1]: "Extra Turn",
  [2]: "Get Out of Jail Free",
  [3]: "Double Rent",
  [4]: "Roll Boost",
  [5]: "Instant Cash (Tiered)",
  [6]: "Teleport",
  [7]: "Shield",
  [8]: "Property Discount",
  [9]: "Tax Refund (Tiered)",
  [10]: "Exact Roll",
  [11]: "Rent Cashback",
  [12]: "Interest",
  [13]: "Lucky 7",
  [14]: "Free Parking Bonus",
};

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

export const INITIAL_COLLECTIBLES: readonly {
  perk: CollectiblePerk;
  name: string;
  strength: number;
  tycPrice: string;
  usdcPrice: string;
  icon: React.ReactNode;
}[] = [
  { perk: CollectiblePerk.EXTRA_TURN, name: "Extra Turn", strength: 1, tycPrice: "0.75", usdcPrice: "0.08", icon: <Zap className="w-8 h-8" /> },
  { perk: CollectiblePerk.JAIL_FREE, name: "Get Out of Jail Free", strength: 1, tycPrice: "1.0", usdcPrice: "0.12", icon: <KeyRound className="w-8 h-8" /> },
  { perk: CollectiblePerk.ROLL_BOOST, name: "Roll Boost", strength: 1, tycPrice: "1.0", usdcPrice: "0.10", icon: <Sparkles className="w-8 h-8" /> },
  { perk: CollectiblePerk.PROPERTY_DISCOUNT, name: "Property Discount", strength: 1, tycPrice: "1.25", usdcPrice: "0.25", icon: <Coins className="w-8 h-8" /> },
  { perk: CollectiblePerk.SHIELD, name: "Shield", strength: 1, tycPrice: "1.5", usdcPrice: "0.40", icon: <Shield className="w-8 h-8" /> },
  { perk: CollectiblePerk.TELEPORT, name: "Teleport", strength: 1, tycPrice: "1.8", usdcPrice: "0.60", icon: <Zap className="w-8 h-8" /> },
  { perk: CollectiblePerk.ROLL_EXACT, name: "Exact Roll (Legendary)", strength: 1, tycPrice: "2.5", usdcPrice: "1.00", icon: <Sparkles className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 1", strength: 1, tycPrice: "0.5", usdcPrice: "0.05", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 2", strength: 2, tycPrice: "0.8", usdcPrice: "0.15", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 3", strength: 3, tycPrice: "1.2", usdcPrice: "0.30", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 4", strength: 4, tycPrice: "1.6", usdcPrice: "0.50", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 5", strength: 5, tycPrice: "2.0", usdcPrice: "0.90", icon: <Gem className="w-8 h-8" /> },
];
