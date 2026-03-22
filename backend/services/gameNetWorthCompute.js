/**
 * Shared net-worth ranking for games (used by timed finish and tournament bracket resolution).
 * Does not modify DB.
 */
import db from "../config/database.js";

const PROPERTY_TYPES = {
  RAILWAY: [5, 15, 25, 35],
  UTILITY: [12, 28],
};
const RAILWAY_RENT = { 1: 25, 2: 50, 3: 100, 4: 200 };
const UTILITY_MULTIPLIER = { 1: 4, 2: 10 };
const AVERAGE_DICE_ROLL = 7;

/**
 * @param {number} gameId
 * @returns {Promise<{ winner_id: number|null, net_worths: { user_id: number, net_worth: number }[], winner_turn_count: number, valid_win: boolean } | null>}
 */
export async function computeNetWorthResultForGameId(gameId) {
  const gid = Number(gameId);
  if (!Number.isInteger(gid) || gid <= 0) return null;

  const players = await db("game_players").where({ game_id: gid }).select("id", "user_id", "balance", "turn_count");
  if (players.length === 0) return null;

  const rows = await db("game_properties as gp")
    .join("properties as p", "gp.property_id", "p.id")
    .where("gp.game_id", gid)
    .whereNotNull("gp.player_id")
    .select(
      "gp.player_id",
      "gp.property_id",
      "gp.development",
      "gp.mortgaged",
      "p.price",
      "p.cost_of_house",
      "p.rent_site_only",
      "p.rent_one_house",
      "p.rent_two_houses",
      "p.rent_three_houses",
      "p.rent_four_houses",
      "p.rent_hotel"
    );

  const byPlayerId = new Map();
  for (const row of rows) byPlayerId.set(row.player_id, [...(byPlayerId.get(row.player_id) || []), row]);

  function oneTurnRent(gp, ownedByThisPlayer) {
    if (Number(gp.mortgaged)) return 0;
    if (PROPERTY_TYPES.RAILWAY.includes(gp.property_id)) {
      const count = ownedByThisPlayer.filter((o) => PROPERTY_TYPES.RAILWAY.includes(o.property_id)).length;
      return RAILWAY_RENT[count] || 0;
    }
    if (PROPERTY_TYPES.UTILITY.includes(gp.property_id)) {
      const count = ownedByThisPlayer.filter((o) => PROPERTY_TYPES.UTILITY.includes(o.property_id)).length;
      return AVERAGE_DICE_ROLL * (UTILITY_MULTIPLIER[count] || 0);
    }
    const dev = Math.min(5, Math.max(0, Number(gp.development || 0)));
    const rents = [
      gp.rent_site_only,
      gp.rent_one_house,
      gp.rent_two_houses,
      gp.rent_three_houses,
      gp.rent_four_houses,
      gp.rent_hotel,
    ];
    return Number(rents[dev] || 0);
  }

  const net_worths = [];
  let best = { user_id: null, net_worth: -1, turn_count: 0, valid_win: true };
  for (const player of players) {
    const cash = Number(player.balance) || 0;
    const owned = byPlayerId.get(player.id) || [];
    let propertyValue = 0;
    let buildingValue = 0;
    let rentTotal = 0;
    for (const gp of owned) {
      const price = Number(gp.price) || 0;
      propertyValue += Number(gp.mortgaged) ? Math.floor(price / 2) : price;
      const dev = Math.min(5, Math.max(0, Number(gp.development || 0)));
      const costOfHouse = Number(gp.cost_of_house) || 0;
      buildingValue += Math.floor((dev * costOfHouse) / 2);
      rentTotal += oneTurnRent(gp, owned);
    }
    const net_worth = cash + propertyValue + buildingValue + rentTotal;
    net_worths.push({ user_id: player.user_id, net_worth });
    const winnerTurnCount = Number(player.turn_count || 0);
    if (net_worth > best.net_worth) {
      best = {
        user_id: player.user_id,
        net_worth,
        turn_count: winnerTurnCount,
        valid_win: winnerTurnCount >= 20,
      };
    }
  }
  return {
    winner_id: best.user_id,
    net_worths,
    winner_turn_count: best.turn_count || 0,
    valid_win: best.valid_win !== false,
  };
}

/** Placement 1 = best (highest net worth), same scheme as finishGameByNetWorthAndNotify. */
export function placementsFromNetWorths(netWorths) {
  const sorted = [...(netWorths || [])].sort((a, b) => (a.net_worth ?? 0) - (b.net_worth ?? 0));
  const placements = {};
  for (let i = 0; i < sorted.length; i++) {
    placements[sorted[i].user_id] = sorted.length - i;
  }
  return placements;
}
