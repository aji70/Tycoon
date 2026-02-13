export function generateReference(length = 12) {
  const t = Date.now().toString(36);
  const r = Math.random()
    .toString(36)
    .slice(2, 2 + length);
  const s = (t + r).slice(0, length).toUpperCase();
  return s;
}
