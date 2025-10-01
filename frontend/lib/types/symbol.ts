export interface PlayerSymbol {
  name: string;
  emoji: string;
  value: string;
}

export const symbols: PlayerSymbol[] = [
  { name: "Hat", emoji: "🎩", value: "hat" },
  { name: "Car", emoji: "🚗", value: "car" },
  { name: "Dog", emoji: "🐕", value: "dog" },
  { name: "Thimble", emoji: "🧵", value: "thimble" },
  { name: "Iron", emoji: "🧼", value: "iron" },
  { name: "Battleship", emoji: "🚢", value: "battleship" },
  { name: "Boot", emoji: "👞", value: "boot" },
  { name: "Wheelbarrow", emoji: "🛒", value: "wheelbarrow" },
];

export const getPlayerSymbolData = (value: string) => {
  return symbols.find((s) => s.value === value);
};

export const getPlayerSymbol = (value: string) => {
  const symbol = symbols.find((s) => s.value === value);
  return symbol?.emoji;
};
