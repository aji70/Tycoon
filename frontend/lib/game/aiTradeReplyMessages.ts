/**
 * Short player-facing lines when the AI accepts / declines / counters a trade.
 */

export const DECLINE_LINES = [
  "Offer more cash.",
  "Not enough for those properties.",
  "Won't complete your set.",
  "Properties worth more than that.",
  "Too one-sided.",
  "Keeping that color group.",
  "Swap isn't worth it.",
  "Try a different property.",
  "Bump the cash.",
  "I'd rather keep mine.",
];

export const ACCEPT_LINES = [
  "Deal.",
  "Fair trade — accepted.",
  "I'll take it.",
  "Yes.",
];

export const COUNTER_LINES = [
  "Here's my counter.",
  "Close — adjust cash.",
  "Meet me in the middle.",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

/** Drop technical LLM junk (e.g. "property #3 value unknown…"). */
function isJunkTradeReasoning(text: string): boolean {
  return /#\d+|property\s*#|unknown|full board|without (full )?board|missing (data|price|value)|property_id|n\/a/i.test(
    text
  );
}

/** Clean agent reasoning for a toast (keep short). Returns null if unusable. */
export function formatAgentTradeReasoning(reasoning: unknown, maxLen = 48): string | null {
  if (typeof reasoning !== "string") return null;
  const cleaned = reasoning
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (cleaned.length < 4) return null;
  if (isJunkTradeReasoning(cleaned)) return null;
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

export function aiTradeDeclineMessage(opts?: {
  reasoning?: unknown;
  isYourAgent?: boolean;
}): string {
  const why = formatAgentTradeReasoning(opts?.reasoning);
  const prefix = opts?.isYourAgent ? "Agent declined" : "AI declined";
  if (why) return `${prefix}: ${why}`;
  return `${prefix}: ${pick(DECLINE_LINES)}`;
}

export function aiTradeAcceptMessage(opts?: {
  reasoning?: unknown;
  isYourAgent?: boolean;
}): string {
  const why = formatAgentTradeReasoning(opts?.reasoning);
  const prefix = opts?.isYourAgent ? "Agent accepted" : "AI accepted";
  if (why) return `${prefix}: ${why}`;
  return `${prefix}: ${pick(ACCEPT_LINES)}`;
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
        ? `+$${adj} from you`
        : `AI adds $${Math.abs(adj)}`
      : null;
  const why = formatAgentTradeReasoning(opts?.reasoning, 40);
  const prefix = opts?.isYourAgent ? "Agent countered" : "AI countered";
  if (cashHint) return `${prefix}: ${cashHint}`;
  if (why) return `${prefix}: ${why}`;
  return `${prefix}: ${pick(COUNTER_LINES)}`;
}

export function aiTradeHeuristicDeclineMessage(favorability: number): string {
  if (favorability >= 10) return "AI declined: add a bit more cash.";
  if (favorability >= 0) return "AI declined: offer more cash.";
  if (favorability >= -15) return "AI declined: too lopsided.";
  return "AI declined: terrible deal.";
}

export function aiTradeHeuristicAcceptMessage(favorability: number): string {
  if (favorability >= 30) return "AI accepted: great deal.";
  if (favorability >= 10) return "AI accepted: fair enough.";
  return "AI accepted: deal.";
}
