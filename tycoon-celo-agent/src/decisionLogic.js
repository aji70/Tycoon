/**
 * Default decision logic for Tycoon Celo Agent.
 * Mirrors Tycoon's built-in rules (see frontend utils/gameUtils calculateAiFavorability, etc.)
 * so the agent "wraps" the same behavior. Replace with MonopolyAIDecisionEngine or your own LLM.
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

function buildingDecision(context) {
  const { myBalance = 0, myProperties = [] } = context;
  if (myBalance < 300) return { action: "wait", reasoning: "Low cash.", confidence: 0.9 };
  const withHouses = myProperties.filter((p) => (p.development ?? 0) > 0);
  const buildable = myProperties.find((p) => (p.development ?? 0) < 5 && (p.development ?? 0) >= 0);
  if (!buildable) return { action: "wait", reasoning: "Nothing to build.", confidence: 0.9 };
  return {
    action: "build",
    propertyId: buildable.id ?? buildable.property_id,
    reasoning: "Building on monopoly.",
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
