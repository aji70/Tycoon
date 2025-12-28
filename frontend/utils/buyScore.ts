import { MONOPOLY_STATS } from "./monopolyStats";
import type { Property, GameProperty, Player } from "@/types/game";

export function calculateBuyScore(
  property: Property,
  player: Player,
  gameProperties: GameProperty[],
  allProperties: Property[]
): number {
  if (!property.price || property.type !== "property") return 0;

  const price = property.price;
  const baseRent = property.rent_site_only || 0;
  const cash = player.balance ?? 0;

  let score = 30;

  // Cash position modifiers
  if (cash < price * 1.5) score -= 80;
  else if (cash < price * 2) score -= 40;
  else if (cash > price * 4) score += 35;
  else if (cash > price * 3) score += 15;

  // Color group completion bonus
  const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color ?? "")) {
    const owned = group.filter(id =>
      gameProperties.find(gp => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 120;
    else if (owned === group.length - 2) score += 60;
    else if (owned >= 1) score += 25;
  }

  // Railroad & Utility bonuses
  if (property.color === "railroad") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 22;
  }

  if (property.color === "utility") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 28;
  }

  // Landing rank bonus
  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += 35 - rank;

  // ROI bonus
  const roi = baseRent / price;
  if (roi > 0.14) score += 30;
  else if (roi > 0.10) score += 15;

  // Last-property defense bonus
  if (group && group.length <= 3) {
    const opponentOwns = group.filter(id => {
      const gp = gameProperties.find(gp => gp.property_id === id);
      return gp && gp.address !== player.address && gp.address !== null;
    }).length;

    if (opponentOwns === group.length - 1) score += 70;
  }

  return Math.max(0, Math.min(95, score));
}