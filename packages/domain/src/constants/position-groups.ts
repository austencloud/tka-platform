import type { PositionName, PositionDefinition } from "../types/position.js";

/** All 7 TKA positions with their definitions */
export const POSITION_DEFINITIONS: Record<PositionName, PositionDefinition> = {
  alpha: {
    name: "Alpha (α)",
    symbol: "α",
    angle: "180°",
    description: "Hands are at opposite grid points, forming a straight line through the center.",
    gridDescription: "Examples: N/S, E/W, NE/SW, NW/SE. The hands are as far apart as possible.",
    examples: [
      "alpha1: Hands at N and S (diamond mode, vertical axis)",
      "alpha3: Hands at E and W (diamond mode, horizontal axis)",
      "alpha5: Hands at NE and SW (box mode, diagonal)",
    ],
    level: 1,
    keyFact: "The most 'open' position. Hands are diametrically opposite.",
  },
  beta: {
    name: "Beta (β)",
    symbol: "β",
    angle: "0°",
    description: "Both hands are at the same grid point, stacked on top of each other.",
    gridDescription: "Both props share a single location. This is the 'together' position.",
    examples: [
      "beta1: Both hands at N (diamond mode)",
      "beta5: Both hands at NE (box mode)",
      "beta3: Both hands at E (diamond mode)",
    ],
    level: 1,
    keyFact: "The 'together' position. VTG calls this 'tog'.",
  },
  gamma: {
    name: "Gamma (γ)",
    symbol: "γ",
    angle: "90°",
    description: "Hands form a right angle, positioned on adjacent grid points.",
    gridDescription: "One hand is 90° away from the other, creating an 'L' shape.",
    examples: [
      "gamma1: Hands at N and E (diamond mode)",
      "gamma5: Hands at NE and NW (box mode, 90° apart)",
      "gamma9: Hands at NE and SE (box mode)",
    ],
    level: 1,
    keyFact: "The 90° position. Hands are adjacent, not opposite.",
  },
  zeta: {
    name: "Zeta (ζ)",
    symbol: "ζ",
    angle: "~135°",
    description: "Hands form an obtuse angle. Introduced in Level 4 with skewed grid mode.",
    gridDescription: "One hand is on a cardinal point, the other on an intercardinal point, forming an angle greater than 90°.",
    examples: [
      "Hands at N and SE (skewed mode, ~135°)",
      "Hands at E and NW (skewed mode)",
    ],
    level: 4,
    keyFact: "Requires the 8-point grid. An 'almost-alpha' position.",
  },
  eta: {
    name: "Eta (η)",
    symbol: "η",
    angle: "~45°",
    description: "Hands form an acute angle. Introduced in Level 4 with skewed grid mode.",
    gridDescription: "One hand is on a cardinal point, the other on an intercardinal point, forming an angle less than 90°.",
    examples: [
      "Hands at N and NE (skewed mode, ~45°)",
      "Hands at E and SE (skewed mode)",
    ],
    level: 4,
    keyFact: "Requires the 8-point grid. An 'almost-beta' position.",
  },
  tau: {
    name: "Tau (τ)",
    symbol: "τ",
    angle: "variable",
    description: "One hand is at the center grid point, the other at a non-center point. Introduced in Level 5 with centric grid mode. Not yet implemented in TKA Scribe.",
    gridDescription: "The center point is the 9th grid location. Tau positions have one hand there and one at any of the 8 outer points.",
    examples: [
      "One hand at center, one at N",
      "One hand at center, one at NE",
    ],
    level: 5,
    keyFact: "Introduces the center grid point. One hand anchored at center.",
  },
  terra: {
    name: "Terra",
    symbol: "⊕",
    angle: "0° (both at center)",
    description: "Both hands are at the center grid point. Introduced in Level 5 with centric grid mode. Not yet implemented in TKA Scribe.",
    gridDescription: "Both props stacked at the center of the grid. Similar to beta (both at same point) but at the unique center location.",
    examples: [
      "Both hands at center",
    ],
    level: 5,
    keyFact: "Like beta, but at center. Both hands at the unique center point.",
  },
} as const;

/** Positions available at Level 1-3 (diamond/box grid) */
export const FOUNDATION_POSITIONS: PositionName[] = ["alpha", "beta", "gamma"];

/** Positions introduced at Level 4 (skewed grid) */
export const SKEWED_POSITIONS: PositionName[] = ["zeta", "eta"];

/** Positions introduced at Level 5 (centric grid) */
export const CENTRIC_POSITIONS: PositionName[] = ["tau", "terra"];

/** All position names */
export const ALL_POSITIONS: PositionName[] = [
  ...FOUNDATION_POSITIONS,
  ...SKEWED_POSITIONS,
  ...CENTRIC_POSITIONS,
];

/** Get positions available at a given level */
export function getPositionsAtLevel(level: number): PositionName[] {
  const positions: PositionName[] = [...FOUNDATION_POSITIONS];
  if (level >= 4) positions.push(...SKEWED_POSITIONS);
  if (level >= 5) positions.push(...CENTRIC_POSITIONS);
  return positions;
}
