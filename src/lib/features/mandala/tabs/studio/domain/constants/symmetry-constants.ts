import type { SymmetryFold } from "../enums/mandala-enums";

/**
 * Canvas dimensions matching the TKA pictograph system.
 */
export const CANVAS_SIZE = 950;
export const CANVAS_CENTER_X = 475;
export const CANVAS_CENTER_Y = 475;

export const CANVAS_CENTER = {
  x: CANVAS_CENTER_X,
  y: CANVAS_CENTER_Y,
} as const;

/**
 * Calculate rotation angles for n-fold symmetry.
 * Returns array of angles in degrees for each fold.
 */
export function getSymmetryAngles(foldCount: SymmetryFold): number[] {
  const angleStep = 360 / foldCount;
  return Array.from({ length: foldCount }, (_, i) => i * angleStep);
}

/**
 * Symmetry fold display labels.
 */
export const FOLD_LABELS: Record<SymmetryFold, string> = {
  2: "2-fold (180°)",
  3: "3-fold (120°)",
  4: "4-fold (90°)",
  6: "6-fold (60°)",
  8: "8-fold (45°)",
  12: "12-fold (30°)",
};

/**
 * Symmetry fold icons (for UI).
 */
export const FOLD_ICONS: Record<SymmetryFold, string> = {
  2: "◐", // Half circle
  3: "△", // Triangle
  4: "◇", // Diamond
  6: "⬡", // Hexagon
  8: "✳", // 8-pointed star
  12: "✴", // 12-pointed star
};

/**
 * Grid dot positions at cardinal points (N, E, S, W).
 * These match the TKA grid coordinate system.
 */
export const CARDINAL_GRID_DOTS = [
  { id: "north", x: CANVAS_CENTER_X, y: 112.5 }, // Top
  { id: "east", x: 837.5, y: CANVAS_CENTER_Y }, // Right
  { id: "south", x: CANVAS_CENTER_X, y: 837.5 }, // Bottom
  { id: "west", x: 112.5, y: CANVAS_CENTER_Y }, // Left
] as const;

/**
 * Grid dot positions at intercardinal points (NE, SE, SW, NW).
 */
export const INTERCARDINAL_GRID_DOTS = [
  { id: "northeast", x: 731.25, y: 218.75 },
  { id: "southeast", x: 731.25, y: 731.25 },
  { id: "southwest", x: 218.75, y: 731.25 },
  { id: "northwest", x: 218.75, y: 218.75 },
] as const;

/**
 * Center grid dot.
 */
export const CENTER_GRID_DOT = {
  id: "center",
  x: CANVAS_CENTER_X,
  y: CANVAS_CENTER_Y,
} as const;

/**
 * All grid dot positions combined.
 */
export function getAllGridDots(options: {
  showCardinal: boolean;
  showIntercardinal: boolean;
  showCenter: boolean;
}) {
  const dots: Array<{ id: string; x: number; y: number }> = [];

  if (options.showCardinal) {
    dots.push(...CARDINAL_GRID_DOTS);
  }
  if (options.showIntercardinal) {
    dots.push(...INTERCARDINAL_GRID_DOTS);
  }
  if (options.showCenter) {
    dots.push(CENTER_GRID_DOT);
  }

  return dots;
}

/**
 * Default working area radius (distance from center to cardinal points).
 */
export const WORKING_RADIUS = CANVAS_CENTER_Y - 112.5; // ~362.5
