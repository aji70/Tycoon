/** Split vacant lot labels onto one line per word (e.g. "Starknet Lane" → two lines). */
export function vacantPropertyNameLines(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [name];
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 1 ? words : [trimmed];
}

export function vacantPropertyNameMultiline(name: string): string {
  return vacantPropertyNameLines(name).join("\n");
}

/** Heuristic px font size for small square labels (2D fit hook + 3D Html). */
export function vacantLotLabelFontSizePx(lines: string[], boxWidthPx = 46, boxHeightPx = 40): number {
  if (!lines.length) return 8;
  const lineCount = lines.length;
  const maxLen = Math.max(...lines.map((l) => l.length), 1);
  const byWidth = (boxWidthPx * 0.92) / (maxLen * 0.62);
  const byHeight = (boxHeightPx * 0.9) / (lineCount * 1.3);
  return Math.max(4, Math.min(11, Math.min(byWidth, byHeight)));
}
