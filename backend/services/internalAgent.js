/**
 * Internal AI Agent — LLM-based decisions for human vs AI games.
 * When a human starts an AI game, decisions (property buy, trade, building) are
 * made by this agent: it assesses game state and returns actions instead of
 * fixed rule-based logic. One logical "agent" per game (no separate process).
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.INTERNAL_AGENT_MODEL || "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = Number(process.env.INTERNAL_AGENT_TIMEOUT_MS) || 15000;

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function parseJsonResponse(text, fallback) {
  if (!text || typeof text !== "string") return fallback;
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return fallback;
  }
}

function getMonopolies(properties) {
  if (!Array.isArray(properties)) return [];
  const colorGroups = {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
  };
  const ownedIds = (properties || []).map((p) => p.id ?? p.property_id).filter(Boolean);
  return Object.keys(colorGroups).filter((color) => {
    const ids = colorGroups[color];
    return ids && ids.every((id) => ownedIds.includes(id));
  });
}

function buildPropertyPrompt(context) {
  const { landedProperty = {}, myBalance = 0, myProperties = [], opponents = [] } = context;
  return `You're an expert Monopoly AI player. Decide whether to buy this property.

LANDED ON: ${landedProperty.name ?? "Unknown"}
- Price: $${landedProperty.price ?? 0}
- Color: ${landedProperty.color ?? "—"}
- Landing frequency rank: #${landedProperty.landingRank ?? "?"} (lower = better, top 10 is excellent)
- Would complete monopoly: ${landedProperty.completesMonopoly ? "YES" : "No"}

YOUR STATUS:
- Current balance: $${myBalance}
- After purchase: $${myBalance - (landedProperty.price || 0)}
- Properties owned: ${(myProperties || []).length}
- Complete monopolies: ${getMonopolies(myProperties || []).length}

OPPONENTS:
${(opponents || []).map((o) => `- ${o.username ?? "Opponent"}: $${o.balance ?? 0}`).join("\n")}

MONOPOLY STRATEGY RULES:
1. Orange/Red/Yellow groups = highest ROI (most landed on)
2. Completing monopolies is CRITICAL - worth overpaying
3. Keep $500+ cash reserve minimum
4. Properties with landing rank <10 are excellent investments
5. Railroads are consistent income but low priority
6. Dark blue is expensive but low traffic

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "action": "buy" | "skip",
  "reasoning": "tactical explanation in max 60 words",
  "confidence": 85
}`;
}

function buildTradePrompt(context) {
  const trade = context.tradeOffer || {};
  const { myBalance = 0, myProperties = [], opponents = [] } = context;
  return `Evaluate this Monopoly trade offer.

RECEIVING:
- Cash: $${trade.offer_amount ?? 0}
- Properties: ${(trade.offer_properties || []).map((id) => id).join(", ") || "None"}

GIVING:
- Cash: $${trade.requested_amount ?? 0}
- Properties: ${(trade.requested_properties || []).map((id) => id).join(", ") || "None"}

YOUR STATUS:
- Balance: $${myBalance}
- Properties: ${(myProperties || []).map((p) => p.name ?? p.id).join(", ") || "None"}
- Monopolies: ${getMonopolies(myProperties || []).join(", ") || "None"}

ANALYSIS:
- Does this complete a monopoly for me? (HUGE value)
- Does this complete a monopoly for them? (Risky)
- Is the cash fair?
- Am I weakening my position?

Respond ONLY with JSON:
{
  "action": "accept" | "decline" | "counter",
  "reasoning": "max 60 words",
  "confidence": 85
}`;
}

function buildBuildingPrompt(context) {
  const { myBalance = 0, myProperties = [], opponents = [] } = context;
  return `You're playing Monopoly. Analyze whether to build houses/hotels now.

YOUR STATUS:
- Balance: $${myBalance}
- Properties: ${(myProperties || []).map((p) => `${p.name ?? p.id} (${p.development ?? 0} houses)`).join(", ")}
- Monopolies: ${getMonopolies(myProperties || []).join(", ") || "None"}

OPPONENTS:
${(opponents || []).map((o) => `- ${o.username ?? "Opponent"}: $${o.balance ?? 0}`).join("\n")}

STRATEGY:
- Build on monopolies with high traffic (orange, red, yellow)
- Keep $500+ cash reserve for safety
- Build evenly (3 houses per property is optimal)
- Hotels only when cash flow is secure

Respond ONLY with JSON:
{
  "action": "build" | "wait",
  "propertyId": 16,
  "reasoning": "brief explanation"
}`;
}

function buildStrategyPrompt(context) {
  const {
    myBalance = 0,
    myProperties = [],
    opponents = [],
    inDebt = false,
    hasMonopoly = false,
    canUnmortgage = false,
    canBuild = false,
    canSendTrade = false,
  } = context || {};
  const monopolies = getMonopolies(myProperties || []);
  return `You're an expert Monopoly strategist. Decide what this AI should do BEFORE rolling.

ALLOWED ACTIONS (pick ONE):
- "liquidate"    (sell houses / mortgage to fix negative balance)
- "unmortgage"   (redeem high-value mortgaged properties)
- "build"        (build houses/hotels on strong monopolies)
- "proposeTrade" (send a trade offer to improve monopolies)
- "roll"         (skip strategy and just roll the dice)

CURRENT STATUS:
- Balance: $${myBalance}
- In debt (balance < 0): ${inDebt ? "YES" : "NO"}
- Monopolies: ${monopolies.join(", ") || "None"}
- Has at least one full monopoly: ${hasMonopoly ? "YES" : "NO"}
- Can unmortgage good properties now: ${canUnmortgage ? "YES" : "NO"}
- Can build on monopolies now: ${canBuild ? "YES" : "NO"}
- Has a near-complete color set where a trade might finish a monopoly: ${canSendTrade ? "YES" : "NO"}

OPPONENTS:
${(opponents || []).map((o) => `- ${o.username ?? "Opponent"}: $${o.balance ?? 0}`).join("\n")}

Respond ONLY with JSON:
{
  "action": "liquidate" | "unmortgage" | "build" | "proposeTrade" | "roll",
  "reasoning": "max 50 words explaining the choice"
}`;
}

function buildTipPrompt(context) {
  const { myBalance = 0, myProperties = [], opponents = [], situation = "buy_property", property: landedProperty = {} } = context;
  const monopolies = getMonopolies(myProperties || []);
  if (situation === "buy_property" && landedProperty && Object.keys(landedProperty).length > 0) {
    return `You are helping a human Monopoly player. They just landed on a property and must decide whether to buy or skip.

PROPERTY: ${landedProperty.name ?? "Unknown"}
- Price: $${landedProperty.price ?? 0}
- Color: ${landedProperty.color ?? "—"}
- Would complete a monopoly for them: ${landedProperty.completesMonopoly ? "YES" : "No"}
- Landing frequency rank: #${landedProperty.landingRank ?? "?"} (lower = more landed on)

THEIR STATUS:
- Balance: $${myBalance}
- After buying: $${myBalance - (landedProperty.price || 0)}
- Properties owned: ${(myProperties || []).length}
- Complete monopolies: ${monopolies.join(", ") || "None"}

OPPONENTS:
${(opponents || []).map((o) => `- ${o.username ?? "Opponent"}: $${o.balance ?? 0}`).join("\n")}

Give ONE short, friendly tactical tip (1–2 sentences) to help them decide. Don't be patronizing. Do not tell them to "buy" or "skip" explicitly unless it's clear—focus on the reasoning (e.g. "Completes your orange set" or "Keep cash for rent"). Output ONLY valid JSON:
{
  "action": "ok",
  "reasoning": "your tip text here"
}`;
  }
  return `You are helping a human Monopoly player during their turn.

THEIR STATUS:
- Balance: $${myBalance}
- Properties: ${(myProperties || []).length}
- Monopolies: ${monopolies.join(", ") || "None"}

Give ONE short, friendly tip (1 sentence) for their situation. Be encouraging. Output ONLY valid JSON:
{
  "action": "ok",
  "reasoning": "your tip text here"
}`;
}

/**
 * Get a decision from the internal LLM agent.
 * @param {number} gameId
 * @param {number} slot
 * @param {string} decisionType - "property" | "trade" | "building" | "strategy" | "tip"
 * @param {object} context - game context (myBalance, myProperties, opponents, landedProperty, tradeOffer, gameState, etc.)
 * @returns {Promise<{ action: string, propertyId?: number, reasoning?: string, confidence?: number } | null>}
 */
async function getDecision(gameId, slot, decisionType, context) {
  const anthropic = getClient();
  if (!anthropic) {
    console.log("[internalAgent] No ANTHROPIC_API_KEY; internal agent disabled.");
    return null;
  }

  let prompt;
  let fallback;

  switch (decisionType) {
    case "property":
      prompt = buildPropertyPrompt(context);
      fallback = { action: "skip", reasoning: "No API", confidence: 0 };
      break;
    case "trade":
      prompt = buildTradePrompt(context);
      fallback = { action: "decline", reasoning: "No API", confidence: 0 };
      break;
    case "building":
      prompt = buildBuildingPrompt(context);
      fallback = { action: "wait", reasoning: "No API", confidence: 0 };
      break;
    case "strategy":
      prompt = buildStrategyPrompt(context);
      fallback = { action: "roll", reasoning: "No API", confidence: 0 };
      break;
    case "tip":
      prompt = buildTipPrompt(context);
      fallback = { action: "ok", reasoning: "Consider cash flow and completing color sets." };
      break;
    default:
      return { action: "wait", reasoning: "Unknown type.", confidence: 0 };
  }

  try {
    const createPromise = anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), REQUEST_TIMEOUT_MS)
    );
    const message = await Promise.race([createPromise, timeoutPromise]);

    const text =
      message.content &&
      message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    const parsed = parseJsonResponse(text, fallback);

    const out = {
      action: String(parsed.action || fallback.action).toLowerCase(),
      reasoning: parsed.reasoning ?? fallback.reasoning,
      confidence: Number(parsed.confidence) ?? fallback.confidence,
    };
    if (parsed.propertyId != null) out.propertyId = Number(parsed.propertyId);
    return out;
  } catch (err) {
    console.error("[internalAgent] LLM request failed:", err.message);
    return null;
  }
}

export default {
  getDecision,
};
