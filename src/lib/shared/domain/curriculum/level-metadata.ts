export type LevelNumber = 1 | 2 | 3;

export interface LevelMetadata {
  readonly name: string;
  readonly blurb: string;
  readonly image: string;
  readonly accent: string;
}

export const LEVEL_METADATA: Readonly<Record<LevelNumber, LevelMetadata>> = {
  1: {
    name: "Base Motions",
    blurb: "The grid, all 6 letter types, basic words. No turns.",
    image: "/images/level_images/level_1.png",
    accent: "#4CAF50",
  },
  2: {
    name: "Whole Turns",
    blurb: "Whole turns. Shifts get rotation, combos get harder.",
    image: "/images/level_images/level_2.png",
    accent: "#2196F3",
  },
  3: {
    name: "Half Turns, Floats",
    blurb: "Half turns, floats. The full vocabulary.",
    image: "/images/level_images/level_3.png",
    accent: "#9C27B0",
  },
} as const;
