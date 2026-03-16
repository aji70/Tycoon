/**
 * Internal AI Agent — LLM-based decisions for human vs AI games.
 * When a human starts an AI game, decisions (property buy, trade, building) are
 * made by this agent: it assesses game state and returns actions instead of
 * fixed rule-based logic. One logical "agent" per game (no separate process).
 */

import Anthropic from "@anthropic-ai/sdk";
import logger from "../config/logger.js";

const MODEL = process.env.INTERNAL_AGENT_MODEL || "claude-sonnet-4-20250514";
const MAX_TOKENS = Number(process.env.INTERNAL_AGENT_MAX_TOKENS) || 256;
const REQUEST_TIMEOUT_MS = Number(process.env.INTERNAL_AGENT_TIMEOUT_MS) || 15000;
const MAX_RETRIES = 2;
const CASH_RESERVE_MIN = 500;

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
  const opps = (opponents || []).map((o) => {
    const mono = o.monopolies != null ? ` (${o.monopolies} monos)` : "";
    return `${o.username ?? "Opp"}: $${o.balance ?? 0}${mono}`;
  }).join("; ");
  const phase = turnCount != null ? ` Turn ~${turnCount}.` : "";
  const oppMonos = opponentMonopolies != null ? ` Opponent monopolies: ${opponentMonopolies}.` : "";
  const price = Number(landedProperty.price) || 0;
  const balanceAfter = myBalance - price;
  return `Monopoly: buy or skip? Be SELECTIVE — default to skip unless clearly good value or completing a monopoly. Property: ${landedProperty.name ?? "?"} $${price} ${landedProperty.color ?? ""}. Rank #${landedProperty.landingRank ?? "?"} (lower=better). Completes monopoly: ${landedProperty.completesMonopoly ? "Y" : "N"}. Your balance: $${myBalance} (after buy: $${balanceAfter}). Own ${(myProperties || []).length} props, ${monopolies.length} monopolies. Opponents: ${opps}.${phase}${oppMonos} HARD RULES: (1) MUST skip if balance after buy would be under $${CASH_RESERVE_MIN} unless this completes a monopoly. (2) Prefer skip for weak sets (brown, dark blue), high rank (>15), or when you already have many properties. (3) Buy mainly when: completes monopoly, or strong set (orange/red/yellow) with rank <10 and balance after stays >= $${CASH_RESERVE_MIN}. JSON only: {"action":"buy"|"skip","reasoning":"brief reason","confidence":85}`;
}

function buildTradePrompt(context) {
  const trade = context.tradeOffer || {};
  const { myBalance = 0, myProperties = [], opponents = [], opponentMonopolies } = context;
  const monopolies = getMonopolies(myProperties || []).join(", ") || "None";
  const oppMonos = opponentMonopolies != null ? ` Opponent monopolies: ${opponentMonopolies}.` : "";
  return `Monopoly trade. Receive: $${trade.offer_amount ?? 0}, props ${(trade.offer_properties || []).join(",") || "none"}. Give: $${trade.requested_amount ?? 0}, props ${(trade.requested_properties || []).join(",") || "none"}. Balance: $${myBalance}. My monopolies: ${monopolies}.${oppMonos} Does it complete my monopoly? Theirs? Fair? Avoid giving them a monopoly. If you counter, suggest cashAdjustment: positive = I want more from them, negative = I add cash. JSON only: {"action":"accept"|"decline"|"counter","reasoning":"brief","confidence":85,"counterOffer":{"cashAdjustment":0}} (cashAdjustment only if action is "counter")`;
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

function buildTipPrompt(context) {
  const { myBalance = 0, myProperties = [], opponents = [], situation = "buy_property", property: landedProperty = {} } = context;
  const monopolies = getMonopolies(myProperties || []);
  if (situation === "buy_property" && landedProperty && Object.keys(landedProperty).length > 0) {
    const price = Number(landedProperty.price) || 0;
    const balanceAfter = myBalance - price;
    const opps = (opponents || []).map((o) => `${o.username ?? "Opp"}: $${o.balance ?? 0}`).join("; ");
    const rank = landedProperty.landingRank != null ? landedProperty.landingRank : 99;
    const color = landedProperty.color ?? "";
    const rentSite = landedProperty.rent_site_only ?? landedProperty.rent_site ?? 0;
    const setProgress = (landedProperty.ownedInGroup != null && landedProperty.groupSize != null)
      ? `They have ${landedProperty.ownedInGroup} of ${landedProperty.groupSize} in this set.`
      : landedProperty.completesMonopoly ? "Buying this COMPLETES their set." : "";
    const strategyNote = [
      "Best sets: orange, red, yellow (high traffic). Brown/darkblue weaker.",
      "Rank 1-10 = strong property, 20+ = weaker.",
      "Keep $500+ cash if possible; avoid buying if balance after would be under $300.",
      "Railroads/utilities: lower priority unless completing set.",
    ].join(" ");
    return `Monopoly: human landed on ${landedProperty.name ?? "?"}. Price: $${price}. Color/set: ${color}. Quality rank: ${rank} (lower=better, 1-10 strong). Rent (site only): $${rentSite}. Completes set: ${landedProperty.completesMonopoly ? "YES" : "NO"}. ${setProgress} Their balance: $${myBalance}; after buying: $${balanceAfter}. Opponents: ${opps}. Their monopolies: ${(monopolies || []).join(", ") || "none"}. Rules: ${strategyNote} Recommend either buy or skip. Give ONE short tip in plain language. Be specific: e.g. "Buy — completes set" or "Skip — save cash". One sentence, max 12 words. No jargon. Put the actual tip text in reasoning. JSON only: {"action":"buy"|"skip","reasoning":"your one-sentence tip"}`;
  }
  return `Monopoly turn. Balance: $${myBalance}. Recommend buy or skip. One short tip, one sentence. Put the actual tip in reasoning. JSON only: {"action":"buy"|"skip","reasoning":"tip"}`;
}

/**
 * Run Claude with the given client and return a decision. Shared by getDecision and getDecisionWithKey.
 * @param {object} [opts] - Optional { systemPrompt } (user's skill / behavior instructions).
 */
async function runDecisionWithClient(anthropic, decisionType, context, opts = {}) {
  const { systemPrompt } = opts;
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
      fallback = { action: "skip", reasoning: "Buy if it completes a set; otherwise save cash." };
      break;
    default:
      return { action: "wait", reasoning: "Unknown type.", confidence: 0 };
  }

  const createParams = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  };
  if (systemPrompt && String(systemPrompt).trim()) {
    createParams.system = String(systemPrompt).trim();
  }

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
        logger.warn({ attempt, decisionType, err: msg }, "Internal agent retry");
        await new Promise((r) => setTimeout(r, 500 * attempt));
      } else {
        throw err;
      }
    }
  }

  const text =
    message &&
    message.content &&
    message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  const parsed = parseJsonResponse(text, fallback);

  let reasoning = parsed.reasoning ?? fallback.reasoning;
  // Tip: reject non-tip content (e.g. model returning "AI" or a label)
  if (decisionType === "tip") {
    const r = (reasoning && String(reasoning).trim()) || "";
    if (r.length < 4 || /^\s*AI\s*$/i.test(r)) reasoning = fallback.reasoning;
  }

  let action = String(parsed.action || fallback.action).toLowerCase();
  // Tip: normalize to buy or skip only
  if (decisionType === "tip" && action !== "buy") action = "skip";
  const out = {
    action,
    reasoning,
    confidence: Number(parsed.confidence) ?? fallback.confidence,
  };
  if (parsed.propertyId != null) out.propertyId = Number(parsed.propertyId);
  if (parsed.counterOffer && typeof parsed.counterOffer === "object") {
    out.counterOffer = { cashAdjustment: Number(parsed.counterOffer.cashAdjustment) || 0 };
  }

  // Validate action is legal and enforce cash reserve
  if (decisionType === "property" && out.action === "buy") {
    const price = Number((context.landedProperty || {}).price) || 0;
    const balance = Number(context.myBalance) || 0;
    const balanceAfter = balance - price;
    const completesMonopoly = !!context.landedProperty?.completesMonopoly;
    if (price > balance || price <= 0) {
      out.action = "skip";
      out.reasoning = (out.reasoning || "") + " [Corrected: insufficient balance]";
      logger.debug({ decisionType, price, balance }, "Internal agent: forced skip (can't afford)");
    } else if (balanceAfter < CASH_RESERVE_MIN && !completesMonopoly) {
      out.action = "skip";
      out.reasoning = (out.reasoning || "") + ` [Corrected: reserve $${CASH_RESERVE_MIN} required; would have $${balanceAfter}]`;
      logger.debug({ decisionType, balanceAfter, CASH_RESERVE_MIN }, "Internal agent: forced skip (reserve)");
    }
  }

  return out;
}

/**
 * Get a decision from the internal LLM agent (uses env ANTHROPIC_API_KEY).
 * @param {object} [opts] - Optional { systemPrompt } from agent config (user's skill).
 */
async function getDecision(gameId, slot, decisionType, context, opts = {}) {
  const anthropic = getClient();
  if (!anthropic) {
    logger.debug({ gameId, slot, decisionType }, "Internal agent disabled (no API key)");
    return null;
  }
  try {
    const result = await runDecisionWithClient(anthropic, decisionType, context, opts);
    logger.info({ gameId, slot, decisionType, action: result?.action, source: "internal" }, "AI decision");
    return result;
  } catch (err) {
    logger.warn({ gameId, slot, decisionType, err: err?.message }, "Internal agent LLM failed");
    return null;
  }
}

/**
 * Get a decision using the caller's API key (Option B: no key storage). Key is not stored.
 * @param {string} apiKey - User's Anthropic API key (sent in request, used only for this call).
 * @param {number} gameId
 * @param {number} slot
 * @param {string} decisionType
 * @param {object} context
 * @param {object} [opts] - Optional { systemPrompt } from agent config (user's skill).
 * @returns {Promise<{ action: string, propertyId?: number, reasoning?: string, confidence?: number } | null>}
 */
async function getDecisionWithKey(apiKey, gameId, slot, decisionType, context, opts = {}) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) return null;
  try {
    const client = new Anthropic({ apiKey: apiKey.trim() });
    return await runDecisionWithClient(client, decisionType, context, opts);
  } catch (err) {
    logger.warn({ gameId, slot, decisionType, err: err?.message }, "Internal agent (user key) failed");
    return null;
  }
}

export default {
  getDecision,
  getDecisionWithKey,
};
