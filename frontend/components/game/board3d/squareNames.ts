/**
 * Classic Monopoly-style names for the 40 board positions.
 * Matches what the game API returns from /properties; use as fallback for demo or when name is missing.
 */
export const BOARD_SQUARE_NAMES: Record<number, string> = {
  0: "GO",
  1: "Mediterranean Ave",
  2: "Community Chest",
  3: "Baltic Ave",
  4: "Income Tax",
  5: "Reading Railroad",
  6: "Oriental Ave",
  7: "Chance",
  8: "Vermont Ave",
  9: "Connecticut Ave",
  10: "Jail",
  11: "St. Charles Pl",
  12: "Electric Company",
  13: "States Ave",
  14: "Virginia Ave",
  15: "Pennsylvania Railroad",
  16: "St. James Pl",
  17: "Community Chest",
  18: "Tennessee Ave",
  19: "New York Ave",
  20: "Free Parking",
  21: "Kentucky Ave",
  22: "Chance",
  23: "Indiana Ave",
  24: "Illinois Ave",
  25: "B. & O. Railroad",
  26: "Atlantic Ave",
  27: "Ventnor Ave",
  28: "Water Works",
  29: "Marvin Gardens",
  30: "Go to Jail",
  31: "Pacific Ave",
  32: "North Carolina Ave",
  33: "Community Chest",
  34: "Pennsylvania Ave",
  35: "Short Line",
  36: "Chance",
  37: "Park Place",
  38: "Luxury Tax",
  39: "Boardwalk",
};

export function getSquareName(id: number, fallback?: string): string {
  return BOARD_SQUARE_NAMES[id] ?? fallback ?? `Square ${id}`;
}
