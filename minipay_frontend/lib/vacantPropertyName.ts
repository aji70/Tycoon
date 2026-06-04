/** Max characters per line before ellipsis (after aliases). */
export const SQUARE_NAME_MAX_LEN = 12;

/** Minimum label font size (px) for square name rendering. */
export const SQUARE_NAME_MIN_FONT_PX = 10;

const PHRASE_ALIASES: ReadonlyArray<[string, string]> = [
  ["Market Row", "Mkt Row"],
  ["Harbour Way", "Hbr Way"],
];

const WORD_ALIASES: ReadonlyArray<[RegExp, string]> = [
  [/Boulevard/gi, "Blvd"],
  [/Station/gi, "Stn"],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Shorten long property names for small board squares. */
export function formatSquarePropertyName(name: string): string {
  let s = name.trim();
  if (!s) return name;

  for (const [from, to] of PHRASE_ALIASES) {
    s = s.replace(new RegExp(escapeRegExp(from), "gi"), to);
  }
  for (const [pattern, to] of WORD_ALIASES) {
    s = s.replace(pattern, to);
  }

  return truncateWithEllipsis(s, SQUARE_NAME_MAX_LEN);
}

function truncateWithEllipsis(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return "…";
  return `${text.slice(0, maxLen - 1)}…`;
}

/** Split square labels onto one line per word (e.g. "Mkt Row" → two lines). */
export function vacantPropertyNameLines(name: string): string[] {
  const display = formatSquarePropertyName(name);
  if (!display) return [name];
  const words = display.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map((w) => truncateWithEllipsis(w, SQUARE_NAME_MAX_LEN));
  }
  return [display];
}

export function vacantPropertyNameMultiline(name: string): string {
  return vacantPropertyNameLines(name).join("\n");
}

/** Heuristic px font size for small square labels (2D fit hook + 3D Html). */
export function vacantLotLabelFontSizePx(
  lines: string[],
  boxWidthPx = 46,
  boxHeightPx = 40
): number {
  if (!lines.length) return SQUARE_NAME_MIN_FONT_PX;
  const lineCount = lines.length;
  const maxLen = Math.max(...lines.map((l) => l.length), 1);
  const byWidth = (boxWidthPx * 0.92) / (maxLen * 0.62);
  const byHeight = (boxHeightPx * 0.9) / (lineCount * 1.3);
  return Math.max(
    SQUARE_NAME_MIN_FONT_PX,
    Math.min(14, Math.min(byWidth, byHeight))
  );
}
