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

export function getPosition3D(positionIndex: number): [number, number, number] {
  const i = ((positionIndex % 40) + 40) % 40;
  let px = 0;
  let pz = 0;

  if (i <= 9) {
    // Top row: 0 = GO (right), 9 = corner (left), right to left
    px = HALF - i;
    pz = HALF;
  } else if (i <= 19) {
    // Left side: top to bottom. 10 next to 9, 19 next to 20
    px = -HALF;
    pz = HALF - (i - 10);
  } else if (i <= 29) {
    // Bottom row: right to left. 20 = right, 29 = left
    px = HALF - (i - 20);
    pz = -HALF;
  } else {
    // Right side: bottom to top. 30 next to 29, 39 next to 0
    px = HALF;
    pz = -HALF + (i - 30);
  }

  return [px, 0, pz];
}

/** Token offset so multiple players on same square are slightly spread (e.g. in a line). */
export function getTokenOffset(playerIndex: number, totalOnSquare: number): [number, number, number] {
  if (totalOnSquare <= 1) return [0, 0, 0];
  const step = 0.25;
  const offset = (playerIndex - (totalOnSquare - 1) / 2) * step;
  return [offset, 0, 0]; // spread along X
}
