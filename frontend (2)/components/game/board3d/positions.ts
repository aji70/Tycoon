/**
 * Maps Monopoly-style board position (0–39) to 3D world coordinates.
 * Layout: top row (0–9) → left (10–19) → bottom row (20–29, right to left) → right (30–39).
 * Y is up; one unit per square; center of board at (0, 0, 0).
 * Top row is at +Z, bottom row at -Z; bottom row runs right to left (20 right, 29 left).
 */
const SIDE = 10; // 10 squares per side (including corner)
const HALF = (SIDE - 1) / 2; // 4.5, so board runs -4.5 to 4.5

/** 2D board uses 11×11 grid: grid_row 1 = top, 11 = bottom; grid_col 1 = left, 11 = right. */
const GRID_SIZE = 11;
const CELL = (2 * HALF) / (GRID_SIZE - 1); // ~0.9

/**
 * Position from backend grid. Vertically flipped: 2D top row (grid_row 1) is 3D bottom, 2D bottom row (grid_row 11) is 3D top.
 * So "Go to Jail" (top row) appears at the bottom; GO row appears at the top.
 */
export function getPosition3DFromGrid(grid_row: number, grid_col: number): [number, number, number] {
  const px = (grid_col - 1) * CELL - HALF;
  const pz = (grid_row - 1) * CELL - HALF; // flipped: row 1 → bottom (-HALF), row 11 → top (+HALF)
  return [px, 0, pz];
}

/**
 * Map board position index (0–39) to grid row/col used by tiles.
 * Matches buildMockProperties / backend so tokens align with tile centers.
 */
export function positionToGrid(positionIndex: number): { grid_row: number; grid_col: number } {
  const i = ((positionIndex % 40) + 40) % 40;
  if (i <= 9) return { grid_row: 11, grid_col: 11 - i };
  if (i <= 19) return { grid_row: 11 - (i - 10), grid_col: 1 };
  if (i <= 29) return { grid_row: 1, grid_col: (i - 20) + 1 };
  return { grid_row: (i - 30) + 1, grid_col: 11 };
}

export function getPosition3D(positionIndex: number): [number, number, number] {
  const { grid_row, grid_col } = positionToGrid(positionIndex);
  return getPosition3DFromGrid(grid_row, grid_col);
}

/** Token offset so multiple players on same square are slightly spread (e.g. in a line). */
export function getTokenOffset(playerIndex: number, totalOnSquare: number): [number, number, number] {
  if (totalOnSquare <= 1) return [0, 0, 0];
  const step = 0.25;
  const offset = (playerIndex - (totalOnSquare - 1) / 2) * step;
  return [offset, 0, 0]; // spread along X
}

/** Corners (0, 10, 20, 30) passed when moving forward from `from` to `to`. Used to spin the 3D camera. */
export function getCornersPassed(from: number, to: number): number[] {
  const f = ((from % 40) + 40) % 40;
  const t = ((to % 40) + 40) % 40;
  const passed: number[] = [];
  if (f > t) {
    passed.push(0);
    if (t >= 10) passed.push(10);
    if (t >= 20) passed.push(20);
    if (t >= 30) passed.push(30);
  } else {
    if (f < 10 && t >= 10) passed.push(10);
    if (f < 20 && t >= 20) passed.push(20);
    if (f < 30 && t >= 30) passed.push(30);
  }
  return passed;
}
