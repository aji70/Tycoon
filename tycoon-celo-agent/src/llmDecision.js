/**
 * LLM-based decision logic for Tycoon Celo Agent.
 * Uses Claude (Anthropic) when ANTHROPIC_API_KEY is set.
 * Returns null on failure so the caller can fall back to rule-based logic.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.INTERNAL_AGENT_MODEL || "claude-sonnet-4-20250514";
const MAX_TOKENS = Number(process.env.INTERNAL_AGENT_MAX_TOKENS) || 256;
const REQUEST_TIMEOUT_MS = Number(process.env.INTERNAL_AGENT_TIMEOUT_MS) || 15000;
const MAX_RETRIES = 2;
const CASH_RESERVE_MIN = 500;

function parseJsonResponse(text, fallback) {
  if (!text || typeof text !== "string") return fallback;
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* try extracting JSON object */
  }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(stripped.slice(start, end + 1));
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* ignore */
    }
  }
  return fallback;
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
  const { landedProperty = {}, myBalance = 0, myProperties = [], opponents = [], turnCount, opponentMonopolies } = context;
  const monopolies = getMonopolies(myProperties || []);
  const opps = (opponents || [])
    .map((o) => {
      const mono = o.monopolies != null ? ` (${o.monopolies} monos)` : "";
      return `${o.username ?? "Opp"}: $${o.balance ?? 0}${mono}`;
    })
    .join("; ");
  const phase = turnCount != null ? ` Turn ~${turnCount}.` : "";
  const oppMonos = opponentMonopolies != null ? ` Opponent monopolies: ${opponentMonopolies}.` : "";
  const price = Number(landedProperty.price) || 0;
  const balanceAfter = myBalance - price;
  return `Monopoly AI: buy or skip this property? Default strategy is BUY — acquiring properties is how you win. Only skip if you truly can't afford it or it hurts your position. Property: ${landedProperty.name ?? "?"} $${price} ${landedProperty.color ?? ""}. Rank #${landedProperty.landingRank ?? "?"} (lower=better). Completes monopoly: ${landedProperty.completesMonopoly ? "Y" : "N"}. Your balance: $${myBalance} (after buy: $${balanceAfter}). Own ${(myProperties || []).length} props, ${monopolies.length} monopolies. Opponents: ${opps}.${phase}${oppMonos} RULES: (1) MUST skip only if price > balance or balance after would be under $${CASH_RESERVE_MIN} (unless completing a monopoly). (2) Buy everything else — all color groups, railroads, utilities are valuable. (3) Completing a monopoly is always worth it even if cash falls below reserve. JSON only: {"action":"buy"|"skip","reasoning":"brief reason","confidence":85}`;
}

function buildTradePrompt(context) {
  const trade = context.tradeOffer || {};
  const { myBalance = 0, myProperties = [], opponents = [], opponentMonopolies } = context;
  const monopolies = getMonopolies(myProperties || []).join(", ") || "None";
  const oppMonos = opponentMonopolies != null ? ` Opponent monopolies: ${opponentMonopolies}.` : "";
  const allKnownProps = [...(myProperties || [])];
  const resolvePropName = (id) => {
    const found = allKnownProps.find((p) => (p.id ?? p.property_id) === id);
    return found?.name ? `${found.name}($${found.price ?? "?"})` : `#${id}`;
  };
  const receiveProps = (trade.offer_properties || []).map(resolvePropName).join(", ") || "none";
  const giveProps = (trade.requested_properties || []).map(resolvePropName).join(", ") || "none";
  const receiveCash = trade.offer_amount ?? 0;
  const giveCash = trade.requested_amount ?? 0;
  return `Monopoly trade offer received. You (AI) are evaluating whether to accept. Receive: $${receiveCash} cash + properties [${receiveProps}]. Give: $${giveCash} cash + properties [${giveProps}]. Your balance: $${myBalance}. Your monopolies: ${monopolies}.${oppMonos} Key questions: Does receiving these properties complete or progress YOUR monopoly? Does giving away these properties help the OPPONENT complete theirs? Is the cash fair for the property values? Accept if you gain more value than you give, or if it completes your set. Decline if it would hand them a monopoly or costs too much. Counter if roughly fair but slightly off. If you counter, cashAdjustment > 0 means you want more cash from them, < 0 means you add cash to sweeten the deal. JSON only: {"action":"accept"|"decline"|"counter","reasoning":"brief","confidence":85,"counterOffer":{"cashAdjustment":0}} (counterOffer only if action is "counter")`;
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
    turnCount,
  } = context || {};
  const monopolies = getMonopolies(myProperties || []).join(", ") || "None";
  const opps = (opponents || []).map((o) => `${o.username ?? "Opp"}: $${o.balance ?? 0}`).join("; ");
  const phase = turnCount != null ? ` Turn ~${turnCount}.` : "";
  return `Monopoly pre-roll. Pick ONE: liquidate|unmortgage|build|proposeTrade|roll. Balance: $${myBalance}. Debt: ${inDebt ? "Y" : "N"}. Monopolies: ${monopolies}. Can unmortgage: ${canUnmortgage}. Can build: ${canBuild}. Trade opportunity: ${canSendTrade}. Opponents: ${opps}.${phase} Liquidate only if in debt. JSON only: {"action":"...","reasoning":"brief"}`;
}

async function runLLMDecision(anthropic, decisionType, context) {
  let prompt;
  let fallback;

  switch (decisionType) {
    case "property":
      prompt = buildPropertyPrompt(context);
      fallback = { action: "buy", reasoning: "Buy by default — properties win games.", confidence: 50 };
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
    default:
      return { action: "wait", reasoning: "Unknown type.", confidence: 0 };
  }

  const createParams = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  };

  let message;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const createPromise = anthropic.messages.create(createParams);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), REQUEST_TIMEOUT_MS)
      );
      message = await Promise.race([createPromise, timeoutPromise]);
      break;
    } catch (err) {
      const msg = (err && err.message) || "";
      const isRetryable = /timeout|rate|5\d\d|overloaded/i.test(msg);
      if (attempt < MAX_RETRIES && isRetryable) {
        console.warn(`[Agent] LLM retry ${attempt}/${MAX_RETRIES} (${decisionType}):`, msg);
        await new Promise((r) => setTimeout(r, 500 * attempt));
      } else {
        throw err;
      }
    }
  }

  const text =
    message?.content
      ?.filter((b) => b.type === "text")
      ?.map((b) => b.text)
      ?.join("\n") || "";
  const parsed = parseJsonResponse(text, fallback);

  const reasoning = parsed.reasoning ?? fallback.reasoning;
  let action = String(parsed.action || fallback.action).toLowerCase();
  const out = {
    action,
    reasoning,
    confidence: Number(parsed.confidence) ?? fallback.confidence,
  };
  if (parsed.propertyId != null) out.propertyId = Number(parsed.propertyId);
  if (parsed.counterOffer && typeof parsed.counterOffer === "object") {
    out.counterOffer = { cashAdjustment: Number(parsed.counterOffer.cashAdjustment) || 0 };
  }

  if (decisionType === "property" && out.action === "buy") {
    const price = Number((context.landedProperty || {}).price) || 0;
    const balance = Number(context.myBalance) || 0;
    const balanceAfter = balance - price;
    const completesMonopoly = !!context.landedProperty?.completesMonopoly;
    if (price > balance || price <= 0) {
      out.action = "skip";
      out.reasoning = (out.reasoning || "") + " [Corrected: insufficient balance]";
    } else if (balanceAfter < CASH_RESERVE_MIN && !completesMonopoly) {
      out.action = "skip";
      out.reasoning = (out.reasoning || "") + ` [Corrected: reserve $${CASH_RESERVE_MIN} required; would have $${balanceAfter}]`;
    }
  }

  return out;
}

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Get a decision from Claude. Returns null if no API key or on failure (caller should fall back to rules).
 */
export async function getLLMDecision(decisionType, context) {
  const anthropic = getClient();
  if (!anthropic) return null;
  try {
    const result = await runLLMDecision(anthropic, decisionType, context);
    console.log(`[Agent] LLM decision (${decisionType}):`, result.action, result.reasoning?.slice(0, 60));
    return result;
  } catch (err) {
    console.warn(`[Agent] LLM failed (${decisionType}):`, err?.message);
    return null;
  }
}
