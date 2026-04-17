/**
 * UTC calendar month helpers for monthly leaderboards (games.updated_at, users.referred_at).
 */

export function parseYearMonth(input) {
  const now = new Date();
  const def = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (input == null || String(input).trim() === "") return def;
  const s = String(input).trim();
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return def;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || y < 2000 || y > 2100 || mo < 1 || mo > 12) return def;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** @returns {{ ym: string, start: Date, end: Date }} */
export function monthUtcBounds(yyyyMm) {
  const ym = parseYearMonth(yyyyMm);
  const [y, mo] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  return { ym, start, end };
}
