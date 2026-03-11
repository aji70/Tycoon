/**
 * Shortens AI tip text so it's direct and easy to read.
 * Keeps one short sentence, max length, no jargon.
 */
const MAX_TIP_LENGTH = 90;

export function simplifyAiTip(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Reject non-tip content (e.g. API returning "AI" or a label)
  if (/^\s*AI\s*$/i.test(trimmed) || trimmed.length < 4) return null;

  const firstSentence = trimmed
    .split(/[.!?]+/)[0]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  const use = (firstSentence && firstSentence.length > 0 ? firstSentence : trimmed).trim();
  if (use.length <= MAX_TIP_LENGTH) return use;

  const at = use.lastIndexOf(" ", MAX_TIP_LENGTH);
  const cut = at > 40 ? use.slice(0, at) : use.slice(0, MAX_TIP_LENGTH);
  return cut.trim() + (cut.length < use.length ? "…" : "");
}

/** Fallback when API returns no tip or invalid content (e.g. "AI"). */
export const AI_TIP_FALLBACK = "Buy if it completes a set; otherwise save cash.";

/** Returns tip to display: simplified, or raw if valid, or null (e.g. rejects "AI"). */
export function normalizeAiTip(raw: string | null | undefined): string | null {
  const simplified = simplifyAiTip(raw);
  if (simplified != null) return simplified;
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 4 || /^\s*AI\s*$/i.test(trimmed)) return null;
  return trimmed;
}
