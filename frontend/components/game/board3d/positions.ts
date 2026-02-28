/**
 * Maps Monopoly-style board position (0–39) to 3D world coordinates.
 * Layout: top row (0–9) → left (10–19) → bottom row (20–29, right to left) → right (30–39).
 * Y is up; one unit per square; center of board at (0, 0, 0).
 * Top row is at +Z, bottom row at -Z; bottom row runs right to left (20 right, 29 left).
 */
const SIDE = 10; // 10 squares per side (including corner)
const HALF = (SIDE - 1) / 2; // 4.5, so board runs -4.5 to 4.5

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
