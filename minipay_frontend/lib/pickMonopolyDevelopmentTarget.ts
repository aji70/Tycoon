import type { Game, GameProperty, Player, Property } from "@/types/game";
import { MONOPOLY_STATS } from "@/utils/constants/monopoly";

type BuildRow = {
  property_id: number;
  development: number;
  cost_of_house: number;
  group_id: number;
};

export function isEvenBuildEnabled(
  game: { settings?: { even_build?: number | boolean | null } } | null | undefined
): boolean {
  const v = game?.settings?.even_build;
  if (v === undefined || v === null) return true;
  if (v === false || v === 0) return false;
  return true;
}

function getMonopolyBuildRows(
  properties: Property[],
  game_properties: GameProperty[],
  player: Pick<Player, "address">
): BuildRow[] {
  const addr = player.address?.toLowerCase();
  if (!addr) return [];

  const ownedIds = game_properties
    .filter((gp) => gp.address?.toLowerCase() === addr)
    .map((gp) => gp.property_id);

  const buildableColorGroups = Object.entries(MONOPOLY_STATS.colorGroups).filter(
    ([color]) => !["railroad", "utility"].includes(color)
  );

  const completeGroupIds = new Set<number>();
  for (const [, ids] of buildableColorGroups) {
    if ((ids as number[]).every((id) => ownedIds.includes(id))) {
      for (const id of ids as number[]) completeGroupIds.add(id);
    }
  }

  const rows: BuildRow[] = [];
  for (const gp of game_properties) {
    if (gp.address?.toLowerCase() !== addr) continue;
    if (!completeGroupIds.has(gp.property_id)) continue;
    if (gp.mortgaged) continue;
    if ((gp.development ?? 0) >= 5) continue;

    const prop = properties.find((p) => p.id === gp.property_id);
    if (!prop) continue;
    if (String(prop.type || "").toLowerCase() !== "property") continue;
    const gid = Number(prop.group_id ?? 0);
    if (!gid) continue;

    const cost = Number(prop.cost_of_house ?? 0);
    if (cost <= 0) continue;

    rows.push({
      property_id: gp.property_id,
      development: Number(gp.development ?? 0),
      cost_of_house: cost,
      group_id: gid,
    });
  }
  return rows;
}

function filterEvenBuildPerGroup(rows: BuildRow[]): BuildRow[] {
  const byGid = new Map<number, BuildRow[]>();
  for (const r of rows) {
    const list = byGid.get(r.group_id) ?? [];
    list.push(r);
    byGid.set(r.group_id, list);
  }
  const out: BuildRow[] = [];
  for (const list of byGid.values()) {
    const minD = Math.min(...list.map((x) => x.development));
    out.push(...list.filter((x) => x.development === minD));
  }
  return out;
}

function canAfford(balance: number, cost: number, reserveAfter: number): boolean {
  return balance - cost >= reserveAfter;
}

/**
 * Picks a single legal property_id for one house/hotel step.
 * When even-build is on (game setting), only properties at the minimum development
 * within each color group are considered, matching server validation.
 */
export function pickMonopolyDevelopmentTarget(options: {
  game: { settings?: { even_build?: number | boolean | null } };
  properties: Property[];
  game_properties: GameProperty[];
  player: Pick<Player, "address" | "balance">;
  /** If set and legal under rules below, prefer this id when affordable. */
  preferredPropertyId?: number | null;
  balanceReserveAfter?: number;
}): number | null {
  const {
    game,
    properties,
    game_properties,
    player,
    preferredPropertyId,
    balanceReserveAfter = 0,
  } = options;

  const balance = Number(player.balance ?? 0);
  const even = isEvenBuildEnabled(game);

  const baseRows = getMonopolyBuildRows(properties, game_properties, player);
  if (!baseRows.length) return null;

  const rowsForTier = even ? filterEvenBuildPerGroup(baseRows) : baseRows;
  if (!rowsForTier.length) return null;

  const minDev = Math.min(...rowsForTier.map((r) => r.development));
  let tier = rowsForTier.filter((r) => r.development === minDev);
  tier = [...tier].sort((a, b) => a.cost_of_house - b.cost_of_house);

  const preferred =
    preferredPropertyId != null && Number.isFinite(Number(preferredPropertyId))
      ? Number(preferredPropertyId)
      : null;

  if (preferred != null) {
    if (even) {
      const row = tier.find((r) => r.property_id === preferred);
      if (row && canAfford(balance, row.cost_of_house, balanceReserveAfter)) {
        return preferred;
      }
    } else {
      const row = baseRows.find((r) => r.property_id === preferred);
      if (row && canAfford(balance, row.cost_of_house, balanceReserveAfter)) {
        return preferred;
      }
    }
  }

  const fallback = tier.find((r) => canAfford(balance, r.cost_of_house, balanceReserveAfter));
  return fallback?.property_id ?? null;
}
