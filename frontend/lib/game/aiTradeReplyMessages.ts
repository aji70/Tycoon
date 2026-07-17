/**
 * Clear, player-facing lines when the AI accepts / declines / counters a trade.
 * Prefer the agent's `reasoning` when present; otherwise pick from these pools.
 */

/** Decline — tell the player *why* so they can adjust the offer. */
export const DECLINE_LINES = [
  "That deal favors you more than me — offer more cash.",
  "Not enough cash for the properties you're asking for.",
  "I won't give up a property that completes your color set.",
  "Those properties are worth more than you're offering.",
  "Too one-sided. Add cash or swap in a better property for me.",
  "I'm hanging onto that color group — come back with a fairer offer.",
  "Cash helps, but the property swap still isn't worth it for me.",
  "That would hurt my monopoly chances — try a different property.",
  "Offer is too low relative to board value — bump the cash.",
  "I'd rather keep what I have than take that trade.",
];

export const ACCEPT_LINES = [
  "Deal — that trade works for me.",
  "Accepted — fair value on both sides.",
  "I'll take it. Good trade.",
  "Yes. The cash and properties line up.",
];

export const COUNTER_LINES = [
  "Close, but not quite — here's my counter.",
  "Almost. Adjust the cash and we might have a deal.",
  "I'll counter — meet me in the middle on cash.",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

/** Clean agent reasoning for a toast (short, no JSON junk). */
export function formatAgentTradeReasoning(reasoning: unknown, maxLen = 140): string | null {
  if (typeof reasoning !== "string") return null;
  const cleaned = reasoning
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (cleaned.length < 8) return null;
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

export function aiTradeDeclineMessage(opts?: {
  reasoning?: unknown;
  isYourAgent?: boolean;
}): string {
  const why = formatAgentTradeReasoning(opts?.reasoning);
  const prefix = opts?.isYourAgent ? "Your agent declined" : "AI declined";
  if (why) return `${prefix}: ${why}`;
  return `${prefix}: ${pick(DECLINE_LINES)}`;
}

export function aiTradeAcceptMessage(opts?: {
  reasoning?: unknown;
  isYourAgent?: boolean;
}): string {
  const why = formatAgentTradeReasoning(opts?.reasoning);
  const prefix = opts?.isYourAgent ? "Your agent accepted" : "AI accepted";
  if (why) return `${prefix}: ${why}`;
  return `${prefix}. ${pick(ACCEPT_LINES)}`;
}

export function aiTradeCounterMessage(opts?: {
  reasoning?: unknown;
  cashAdjustment?: number | null;
  isYourAgent?: boolean;
}): string {
  const adj = opts?.cashAdjustment;
  const cashHint =
    adj != null && adj !== 0
      ? adj > 0
        ? `Wants +$${adj} from you.`
        : `Will add $${Math.abs(adj)}.`
      : null;
  const why = formatAgentTradeReasoning(opts?.reasoning);
  const prefix = opts?.isYourAgent ? "Your agent countered" : "AI countered";
  if (why && cashHint) return `${prefix}: ${why} (${cashHint})`;
  if (why) return `${prefix}: ${why}`;
  if (cashHint) return `${prefix}: ${cashHint}`;
  return `${prefix}. ${pick(COUNTER_LINES)}`;
}

/** Favorability-based fallbacks (old heuristic path). */
export function aiTradeHeuristicDeclineMessage(favorability: number): string {
  if (favorability >= 10) return "AI declined: close, but still not good enough — add a bit more cash.";
  if (favorability >= 0) return "AI declined: too weak — offer more cash or a better property.";
  if (favorability >= -15) return "AI declined: that trade is lopsided against me.";
  return "AI declined: this deal is terrible for me.";
}

export function aiTradeHeuristicAcceptMessage(favorability: number): string {
  if (favorability >= 30) return "AI accepted: fantastic deal for me!";
  if (favorability >= 10) return "AI accepted: fair enough, I'll take it.";
  return "AI accepted: okay, deal.";
}
