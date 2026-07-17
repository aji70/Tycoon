/**
 * Built-in buy/skip tips for humans — rule-based, no Anthropic.
 * Uses the same context the frontend already sends for tip requests.
 */

const CASH_RESERVE = 500;

const RAILROAD_IDS = new Set([5, 15, 25, 35]);
const UTILITY_IDS = new Set([12, 28]);

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function propertyId(prop) {
  return num(prop?.id ?? prop?.property_id ?? prop?.propertyId, 0);
}

function isRailroad(prop) {
  const id = propertyId(prop);
  if (RAILROAD_IDS.has(id)) return true;
  const t = String(prop?.type || prop?.property_type || "").toLowerCase();
  const name = String(prop?.name || "").toLowerCase();
  return t.includes("rail") || name.includes("railroad") || name.includes("station");
}

function isUtility(prop) {
  const id = propertyId(prop);
  if (UTILITY_IDS.has(id)) return true;
  const t = String(prop?.type || prop?.property_type || "").toLowerCase();
  const name = String(prop?.name || "").toLowerCase();
  return t.includes("util") || name.includes("electric") || name.includes("water");
}

function colorLabel(prop) {
  const c = String(prop?.color || prop?.color_group || prop?.colorGroup || "").trim();
  if (!c) return "";
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

function countOpponentMonopolies(opponents) {
  let n = 0;
  for (const o of opponents || []) {
    const m = o?.monopolies ?? o?.monopoly_count ?? o?.monopolyCount;
    if (Array.isArray(m)) n += m.length;
    else if (typeof m === "number") n += m;
  }
  return n;
}

function pick(seed, options) {
  if (!options.length) return "";
  const i = Math.abs(seed) % options.length;
  return options[i];
}

/**
 * @param {object} context - tip context from frontend
 * @returns {{ action: "buy"|"skip", reasoning: string, confidence: number }}
 */
export function getBuiltinBuySkipTip(context = {}) {
  const prop = context.property || context.landedProperty || {};
  const balance = num(context.myBalance);
  const price = num(prop.price);
  const name = String(prop.name || "this property").trim() || "this property";
  const color = colorLabel(prop);
  const completes = !!prop.completesMonopoly;
  const rank = num(prop.landingRank, 99);
  const ownedInGroup = num(prop.ownedInGroup);
  const groupSize = num(prop.groupSize);
  const myProps = Array.isArray(context.myProperties) ? context.myProperties : [];
  const opponents = Array.isArray(context.opponents) ? context.opponents : [];
  const balanceAfter = balance - price;
  const canAfford = price > 0 && balance >= price;
  const seed = propertyId(prop) + Math.floor(balance / 50) + ownedInGroup * 7;
  const oppMonos = countOpponentMonopolies(opponents);
  const setName = color || name;
  const towardSet = groupSize > 0 && ownedInGroup > 0 && ownedInGroup < groupSize;
  const almostSet = groupSize > 0 && ownedInGroup === groupSize - 1;
  const hotLane = rank > 0 && rank <= 10;
  const solidLane = rank > 10 && rank <= 20;
  const railroad = isRailroad(prop);
  const utility = isUtility(prop);
  const cashTight = canAfford && balanceAfter < CASH_RESERVE;
  const veryTight = canAfford && balanceAfter < 200;

  // --- Skip cases ---
  if (price <= 0) {
    return {
      action: "skip",
      reasoning: "Nothing to buy here — move on.",
      confidence: 90,
    };
  }

  if (!canAfford) {
    return {
      action: "skip",
      reasoning: pick(seed, [
        `Skip — you need $${price.toLocaleString()} but only have $${balance.toLocaleString()}.`,
        `Can't afford ${name} ($${price.toLocaleString()}). Keep your cash.`,
        `Skip ${name} for now — short $${(price - balance).toLocaleString()}.`,
      ]),
      confidence: 95,
    };
  }

  // Completing a monopoly is almost always buy, even if cash dips
  if (completes || almostSet) {
    return {
      action: "buy",
      reasoning: pick(seed, [
        `Buy — this completes your ${setName} set. Huge.`,
        `Buy now — finishing the ${setName} monopoly is worth the cash hit.`,
        `Buy — monopoly on ${setName}. Rent skyrockets after houses.`,
      ]),
      confidence: 98,
    };
  }

  // Building toward a color set
  if (towardSet && !cashTight) {
    return {
      action: "buy",
      reasoning: pick(seed, [
        `Buy — you already own ${ownedInGroup}/${groupSize} of ${setName}.`,
        `Buy — keep stacking ${setName}; you're ${groupSize - ownedInGroup} away from a set.`,
        `Buy ${name} — strengthens your ${setName} position.`,
      ]),
      confidence: 88,
    };
  }

  if (towardSet && cashTight && !veryTight) {
    return {
      action: "buy",
      reasoning: pick(seed, [
        `Buy carefully — ${setName} progress matters more than a fat cash cushion.`,
        `Buy — stretch for ${setName}; you'll sit on ~$${balanceAfter.toLocaleString()}.`,
      ]),
      confidence: 72,
    };
  }

  // Railroads
  if (railroad) {
    if (cashTight && veryTight) {
      return {
        action: "skip",
        reasoning: `Skip the railroad — you'd only have $${balanceAfter.toLocaleString()} left.`,
        confidence: 70,
      };
    }
    const myRails = myProps.filter((p) => isRailroad(p)).length;
    return {
      action: "buy",
      reasoning: pick(seed, [
        myRails > 0
          ? `Buy — another railroad; rent scales with how many you own.`
          : `Buy the railroad — steady rent and trade bait.`,
        `Buy ${name} — railroads pay every lap.`,
        `Buy — railroads are safe income and hard for opponents to ignore.`,
      ]),
      confidence: 82,
    };
  }

  // Utilities
  if (utility) {
    if (veryTight) {
      return {
        action: "skip",
        reasoning: `Skip the utility — cash is too thin after a $${price.toLocaleString()} buy.`,
        confidence: 68,
      };
    }
    const myUtils = myProps.filter((p) => isUtility(p)).length;
    return {
      action: "buy",
      reasoning: pick(seed, [
        myUtils > 0
          ? `Buy — both utilities together hit much harder.`
          : `Buy the utility — cheap footprint and fine mid-game income.`,
        `Buy ${name} — low cost, permanent board presence.`,
      ]),
      confidence: 75,
    };
  }

  // Hot landing spots
  if (hotLane && !veryTight) {
    return {
      action: "buy",
      reasoning: pick(seed, [
        `Buy — ${name} is a high-traffic square (rank #${rank}).`,
        `Buy ${name} — lands often; rent will find you.`,
        color
          ? `Buy — ${color} / ${name} is premium board real estate.`
          : `Buy — strong landing frequency on ${name}.`,
      ]),
      confidence: 86,
    };
  }

  // Opponent pressure: prefer owning something over sitting on cash
  if (oppMonos > 0 && !veryTight) {
    return {
      action: "buy",
      reasoning: pick(seed, [
        `Buy — opponents already have monopolies; you need assets.`,
        `Buy ${name} — don't fall further behind on owned property.`,
        `Buy — board control matters more than hoarding cash now.`,
      ]),
      confidence: 80,
    };
  }

  // Cash too thin after buy (unless special cases above)
  if (veryTight) {
    return {
      action: "skip",
      reasoning: pick(seed, [
        `Skip — buying leaves only $${balanceAfter.toLocaleString()}; one rent could bankrupt you.`,
        `Skip ${name} — protect cash until you can buy without going broke.`,
        `Skip — keep a buffer; $${balanceAfter.toLocaleString()} after buy is too risky.`,
      ]),
      confidence: 84,
    };
  }

  if (cashTight && !hotLane && !solidLane) {
    return {
      action: "skip",
      reasoning: pick(seed, [
        `Skip — ${name} isn't premium enough to dip under $${CASH_RESERVE} cash.`,
        `Skip for now — save for better sets or a safer buy.`,
        `Skip — you'd have $${balanceAfter.toLocaleString()} left; wait for a stronger square.`,
      ]),
      confidence: 76,
    };
  }

  // Default: buying properties wins
  if (solidLane || myProps.length < 4) {
    return {
      action: "buy",
      reasoning: pick(seed, [
        `Buy ${name} — owning properties is how you win.`,
        color
          ? `Buy — grab ${color} while you can; empty lots don't pay rent.`
          : `Buy — expand your footprint before someone else does.`,
        `Buy ${name} ($${price.toLocaleString()}) — solid mid-board value.`,
      ]),
      confidence: 78,
    };
  }

  return {
    action: "buy",
    reasoning: pick(seed, [
      `Buy ${name} — more assets beat idle cash.`,
      `Buy — even average lots create trade leverage later.`,
      `Buy it — board ownership compounds every lap.`,
    ]),
    confidence: 70,
  };
}

export default { getBuiltinBuySkipTip };
