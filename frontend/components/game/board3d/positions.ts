/**
 * Maps Monopoly-style board position (0–39) to 3D world coordinates.
 * Board is a loop: bottom (0–9) → left (10–19) → top (20–29) → right (30–39).
 * Y is up; one unit per square; center of board at (0, 0, 0).
 */
const SIDE = 10; // 10 squares per side (including corner)
const HALF = (SIDE - 1) / 2; // 4.5, so board runs -4.5 to 4.5

export function getPosition3D(positionIndex: number): [number, number, number] {
  const i = ((positionIndex % 40) + 40) % 40;
  let px = 0;
  let pz = 0;

  if (i <= 9) {
    // Bottom row: right to left. 0 = GO (right), 9 = corner (left)
    px = HALF - i;
    pz = -HALF;
  } else if (i <= 19) {
    // Left side: bottom to top. 10 = same corner as 9, 20 = top-left
    px = -HALF;
    pz = -HALF + (i - 10);
  } else if (i <= 29) {
    // Top row: left to right. 20 = corner, 29 = near top-right
    px = -HALF + (i - 20);
    pz = HALF;
  } else {
    // Right side: top to bottom. 30 = top-right, 39 = near GO
    px = HALF;
    pz = HALF - (i - 30);
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
