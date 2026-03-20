/**
 * Placeholder decision logic — fixed rules only, no intelligence.
 * Tycoon's main default is the built-in rule-based logic (in-app); that stays the primary behavior.
 * This file is here so the agent server has something to run; replace it with real logic (LLM, etc.) when you're ready.
 */

function propertyDecision(context) {
  const { myBalance = 0, landedProperty, myProperties = [] } = context;
  const price = landedProperty?.price ?? 0;
  const canAfford = myBalance >= price;
  const reserve = 500;
  const wouldHave = myBalance - price;
  // Simple rule: buy if we can afford and keep reserve, prefer completing monopolies
  const completesMonopoly = landedProperty?.completesMonopoly === true;
  const action = canAfford && (wouldHave >= reserve || completesMonopoly) ? "buy" : "skip";
  return {
    action,
    reasoning: action === "buy" ? "Good value and cash reserve OK." : "Skipping to preserve cash.",
    confidence: 0.8,
  };
}

function tradeDecision(context) {
  const { tradeOffer = {}, myBalance = 0, myProperties = [] } = context;
  const offerAmount = tradeOffer.offer_amount ?? 0;
  const requestAmount = tradeOffer.requested_amount ?? 0;
  const offerPropIds = tradeOffer.offer_properties ?? [];
  const requestPropIds = tradeOffer.requested_properties ?? [];
  // Simple value comparison (agent can use property prices from context if provided)
  const offerValue = offerAmount + (offerPropIds.length * 150);
  const requestValue = requestAmount + (requestPropIds.length * 150);
  const favorability = requestValue === 0 ? 100 : ((offerValue - requestValue) / requestValue) * 100;
  const action = favorability >= 20 ? "accept" : favorability >= 0 ? (Math.random() < 0.4 ? "accept" : "decline") : "decline";
  return {
    action,
    reasoning: `Favorability ${favorability.toFixed(0)}% – ${action}.`,
    confidence: 0.75,
  };
}

/** Street color sets only — must match backend agentGameRunner / frontend MONOPOLY_STATS. */
const COLOR_GROUP_IDS = [
  [1, 3],
  [6, 8, 9],
  [11, 13, 14],
  [16, 18, 19],
  [21, 23, 24],
  [26, 27, 29],
  [31, 32, 34],
  [37, 39],
];

function propertyIdOf(p) {
  return Number(p.property_id ?? p.propertyId ?? p.id ?? 0) || 0;
}

/**
 * Monopoly-style even building: only consider complete monopolies; within each color group,
 * only the least-developed lots; then prefer the globally lowest tier, then cheapest house cost.
 */
function buildingDecision(context) {
  const { myBalance = 0, myProperties = [] } = context;
  if (myBalance < 300) return { action: "wait", reasoning: "Low cash.", confidence: 0.9 };

  const byPid = new Map();
  for (const p of myProperties) {
    const id = propertyIdOf(p);
    if (id) byPid.set(id, p);
  }

  const candidates = [];
  for (const ids of COLOR_GROUP_IDS) {
    if (!ids.every((id) => byPid.has(id))) continue;
    const rows = ids.map((id) => byPid.get(id));
    if (rows.some((r) => r.mortgaged || Number(r.development ?? 0) >= 5)) continue;
    const minD = Math.min(...rows.map((r) => Number(r.development ?? 0)));
    for (const r of rows) {
      if (Number(r.development ?? 0) !== minD) continue;
      const cost = Number(r.cost_of_house ?? 0);
      if (cost <= 0) continue;
      candidates.push({ pid: propertyIdOf(r), cost, dev: minD });
    }
  }

  if (!candidates.length) return { action: "wait", reasoning: "Nothing to build.", confidence: 0.9 };

  const minGlobal = Math.min(...candidates.map((c) => c.dev));
  const tier = candidates.filter((c) => c.dev === minGlobal).sort((a, b) => a.cost - b.cost);
  const pick = tier.find((c) => myBalance >= c.cost);
  if (!pick) return { action: "wait", reasoning: "Cannot afford build.", confidence: 0.9 };

  return {
    action: "build",
    propertyId: pick.pid,
    reasoning: "Even build: complete set, lowest tier, cheapest house.",
    confidence: 0.7,
  };
}

function strategyDecision(_context) {
  return { action: "wait", reasoning: "Strategy handled by turn flow.", confidence: 1 };
}

export function decide(decisionType, context) {
  switch (decisionType) {
    case "property":
      return propertyDecision(context);
    case "trade":
      return tradeDecision(context);
    case "building":
      return buildingDecision(context);
    case "strategy":
      return strategyDecision(context);
    default:
      return { action: "wait", reasoning: "Unknown type.", confidence: 0 };
  }
}
