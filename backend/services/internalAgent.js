/**
 * Internal AI Agent — LLM-based decisions for human vs AI games.
 * When a human starts an AI game, decisions (property buy, trade, building) are
 * made by this agent: it assesses game state and returns actions instead of
 * fixed rule-based logic. One logical "agent" per game (no separate process).
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.INTERNAL_AGENT_MODEL || "claude-sonnet-4-20250514";
const MAX_TOKENS = Number(process.env.INTERNAL_AGENT_MAX_TOKENS) || 256;
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
  const monopolies = getMonopolies(myProperties || []);
  const opps = (opponents || []).map((o) => `${o.username ?? "Opp"}: $${o.balance ?? 0}`).join("; ");
  return `Monopoly: buy or skip? Property: ${landedProperty.name ?? "?"} $${landedProperty.price ?? 0} ${landedProperty.color ?? ""}. Rank #${landedProperty.landingRank ?? "?"} (lower=better). Completes monopoly: ${landedProperty.completesMonopoly ? "Y" : "N"}. Your balance: $${myBalance} (after: $${myBalance - (landedProperty.price || 0)}). Own ${(myProperties || []).length} props, ${monopolies.length} monopolies. Opponents: ${opps}. Rules: orange/red/yellow best; complete monopolies critical; keep $500+; rank <10 good; railroads low priority. JSON only: {"action":"buy"|"skip","reasoning":"brief reason","confidence":85}`;
}

function buildTradePrompt(context) {
  const trade = context.tradeOffer || {};
  const { myBalance = 0, myProperties = [], opponents = [] } = context;
  const monopolies = getMonopolies(myProperties || []).join(", ") || "None";
  return `Monopoly trade. Receive: $${trade.offer_amount ?? 0}, props ${(trade.offer_properties || []).join(",") || "none"}. Give: $${trade.requested_amount ?? 0}, props ${(trade.requested_properties || []).join(",") || "none"}. Balance: $${myBalance}. My monopolies: ${monopolies}. Does it complete my monopoly? Theirs? Fair? JSON only: {"action":"accept"|"decline"|"counter","reasoning":"brief","confidence":85}`;
}

function buildBuildingPrompt(context) {
  const { myBalance = 0, myProperties = [], opponents = [] } = context;
  const monos = getMonopolies(myProperties || []).join(", ") || "None";
  const props = (myProperties || []).map((p) => `${p.name ?? p.id}:${p.development ?? 0}`).join("; ");
  return `Monopoly: build now? Balance: $${myBalance}. Properties: ${props}. Monopolies: ${monos}. Keep $500+; build on orange/red/yellow; 3 houses optimal. JSON only: {"action":"build"|"wait","propertyId":<id or null>,"reasoning":"brief"}`;
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
  const monopolies = getMonopolies(myProperties || []).join(", ") || "None";
  const opps = (opponents || []).map((o) => `${o.username ?? "Opp"}: $${o.balance ?? 0}`).join("; ");
  return `Monopoly pre-roll. Pick ONE: liquidate|unmortgage|build|proposeTrade|roll. Balance: $${myBalance}. Debt: ${inDebt ? "Y" : "N"}. Monopolies: ${monopolies}. Can unmortgage: ${canUnmortgage}. Can build: ${canBuild}. Trade opportunity: ${canSendTrade}. Opponents: ${opps}. JSON only: {"action":"...","reasoning":"brief"}`;
}

function buildTipPrompt(context) {
  const { myBalance = 0, myProperties = [], opponents = [], situation = "buy_property", property: landedProperty = {} } = context;
  const monopolies = getMonopolies(myProperties || []);
  if (situation === "buy_property" && landedProperty && Object.keys(landedProperty).length > 0) {
    const opps = (opponents || []).map((o) => `${o.username ?? "Opp"}: $${o.balance ?? 0}`).join("; ");
    return `Monopoly: human landed on ${landedProperty.name ?? "?"} ($${landedProperty.price ?? 0}). Completes set: ${landedProperty.completesMonopoly ? "Y" : "N"}. Their balance: $${myBalance}. Give ONE short tip in plain language. Examples: "Buy it — you'd complete a set." or "Skip — save your cash." or "Worth it — good value." Keep to one sentence, max 10 words. No jargon. JSON only: {"action":"ok","reasoning":"your one-sentence tip"}`;
  }
  return `Monopoly turn. Balance: $${myBalance}. One short encouraging tip, one sentence, simple words. JSON only: {"action":"ok","reasoning":"tip"}`;
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
      fallback = { action: "ok", reasoning: "Buy if it completes a set; otherwise save cash." };
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
