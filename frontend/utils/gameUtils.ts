import { Property, GameProperty, Player } from "@/types/game";

export const isMortgaged = (property_id: number, game_properties: GameProperty[]) =>
  game_properties.find((gp) => gp.property_id === property_id)?.mortgaged ?? false;

export const developmentStage = (property_id: number, game_properties: GameProperty[]) =>
  game_properties.find((gp) => gp.property_id === property_id)?.development ?? 0;

export const rentPrice = (
  property_id: number,
  properties: Property[],
  game_properties: GameProperty[]
) => {
  const property = properties.find((p) => p.id === property_id);
  const dev = developmentStage(property_id, game_properties);
  switch (dev) {
    case 1: return property?.rent_one_house || 0;
    case 2: return property?.rent_two_houses || 0;
    case 3: return property?.rent_three_houses || 0;
    case 4: return property?.rent_four_houses || 0;
    case 5: return property?.rent_hotel || 0;
    default: return property?.rent_site_only || 0;
  }
};

export const calculateFavorability = (trade: any, properties: Property[]) => {
  const offerValue =
    trade.offer_properties.reduce(
      (sum: number, id: number) =>
        sum + (properties.find((p) => p.id === id)?.price || 0),
      0
    ) + (trade.offer_amount || 0);

  const requestValue =
    trade.requested_properties.reduce(
      (sum: number, id: number) =>
        sum + (properties.find((p) => p.id === id)?.price || 0),
      0
    ) + (trade.requested_amount || 0);

  if (requestValue === 0) return 100;
  const ratio = ((offerValue - requestValue) / requestValue) * 100;
  return Math.min(100, Math.max(-100, Math.round(ratio)));
};

/** Thresholds for built-in trade decisions. */
export const TRADE_ACCEPT_THRESHOLD = 30; // Ratio-based (-100..100): accept if >= 30 (usePlayerSidebar)
export const TRADE_ACCEPT_STRONG = 30; // "Fantastic deal" if >= 30
export const TRADE_ACCEPT_FAIR = 10; // Consider accept if 10-30
export const TRADE_COUNTER_THRESHOLD = -15; // Consider counter if >= -15 (usePlayerSidebar)
export const TRADE_FAVORABILITY_ACCEPT_RAW = 50; // Raw score (ai-board monopoly-weighted): accept if >= 50

export type AiDifficultyLevel = "easy" | "hard" | "boss";

/** Built-in (non-Claude) trade strictness by difficulty. Boss usually uses Tycoon Agent; this is fallback. */
export function getTradeHeuristicConfig(difficulty?: string | null) {
  const d = String(difficulty || "easy").toLowerCase();
  if (d === "hard" || d === "boss") {
    return {
      acceptStrong: 35,
      acceptFair: 15,
      fairAcceptProb: 0.45,
      weakAcceptProb: 0.12,
      counterThreshold: -8,
      counterProb: 0.28,
    };
  }
  // easy — generous / predictable for learning trades
  return {
    acceptStrong: 15,
    acceptFair: 0,
    fairAcceptProb: 0.85,
    weakAcceptProb: 0.5,
    counterThreshold: -25,
    counterProb: 0.55,
  };
}

/** Resolve this seat's difficulty from game settings (supports random per-slot). */
export function resolveAiDifficultyForSlot(
  settings: { ai_difficulty?: string | null; ai_difficulty_mode?: string | null; ai_difficulty_per_slot?: Record<string, string> | null } | null | undefined,
  slot: number | null
): AiDifficultyLevel {
  const mode = String(settings?.ai_difficulty_mode || "same").toLowerCase();
  if (mode === "random" && slot != null && settings?.ai_difficulty_per_slot) {
    const per = settings.ai_difficulty_per_slot[String(slot)];
    if (per && ["easy", "hard", "boss"].includes(String(per).toLowerCase())) {
      return String(per).toLowerCase() as AiDifficultyLevel;
    }
  }
  const d = String(settings?.ai_difficulty || "easy").toLowerCase();
  if (d === "hard" || d === "boss") return d;
  return "easy";
}

export const calculateAiFavorability = (trade: any, properties: Property[]) => {
  const props = properties ?? [];
  const offerIds = Array.isArray(trade?.offer_properties) ? trade.offer_properties : [];
  const requestIds = Array.isArray(trade?.requested_properties) ? trade.requested_properties : [];

  const aiGetsValue =
    (trade?.offer_amount || 0) +
    offerIds.reduce(
      (sum: number, id: number) =>
        sum + (props.find((p) => p.id === id)?.price || 0),
      0
    );

  const aiGivesValue =
    (trade?.requested_amount || 0) +
    requestIds.reduce(
      (sum: number, id: number) =>
        sum + (props.find((p) => p.id === id)?.price || 0),
      0
    );

  if (aiGivesValue === 0) return 100;
  const ratio = ((aiGetsValue - aiGivesValue) / aiGivesValue) * 100;
  return Math.min(100, Math.max(-100, Math.round(ratio)));
};

export const isAIPlayer = (player: Player) => {
  const username = (player.username || "").toLowerCase();
  return username.includes("ai_") || username.includes("bot") || username.includes("computer");
};

/** Derive AI slot (2–8) from player username (e.g. AI_2 -> 2) for Celo agent registry. */
export function getAiSlotFromPlayer(player: Player): number | null {
  const username = player.username || "";
  const match = username.match(/ai_(\d+)/i);
  if (match) return Math.min(8, Math.max(2, parseInt(match[1], 10)));
  if (isAIPlayer(player) && player.turn_order != null) return Math.min(8, Math.max(2, player.turn_order));
  return null;
}

/**
 * Seat 1–8 for `/agent-registry/decision` and telemetry. Uses AI_* username rules, else `turn_order` (arena / human seats).
 */
export function getDecisionSlotForPlayer(player: Player): number {
  const fromAi = getAiSlotFromPlayer(player);
  if (fromAi != null) return fromAi;
  const t = Number(player.turn_order);
  if (Number.isFinite(t) && t >= 1 && t <= 8) return t;
  return 2;
}