/**
 * Shortens AI tip text so it's direct and easy to read.
 * Keeps one short sentence, max length, no jargon.
 */
const MAX_TIP_LENGTH = 90;

export function simplifyAiTip(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

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
