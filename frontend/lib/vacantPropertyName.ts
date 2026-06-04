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
