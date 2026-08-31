/**
 * Direction Map Configurations
 *
 * Lookup tables encoding choreography domain knowledge for prop direction calculation.
 * These maps provide O(1) lookups for direction based on:
 * - Grid location (N/S/E/W for diamond, NE/SE/SW/NW for box)
 * - Motion color (RED vs BLUE)
 * - Orientation (RADIAL: IN/OUT vs NON-RADIAL: CLOCK/COUNTER)
 *
 * @see Legacy: legacy_web/BetaPropDirectionCalculator.ts
 */

import { GridLocation } from "../../../grid/domain/enums/grid-enums";
import {
  HandSide,
  VectorDirection,
} from "../../../shared/domain/enums/pictograph-enums";

// Location type aliases
type Loc = GridLocation;
type DiamondLoc = "n" | "s" | "e" | "w";
type BoxLoc = "ne" | "se" | "sw" | "nw";

/**
 * Letter I direction maps (radial orientation)
 */
export const LETTER_I_RADIAL_MAP: Record<
  Loc,
  Record<HandSide, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [HandSide.RIGHT]: VectorDirection.RIGHT,
    [HandSide.LEFT]: VectorDirection.LEFT,
  },
  [GridLocation.EAST]: {
    [HandSide.RIGHT]: VectorDirection.DOWN,
    [HandSide.LEFT]: VectorDirection.UP,
  },
  [GridLocation.SOUTH]: {
    [HandSide.RIGHT]: VectorDirection.LEFT,
    [HandSide.LEFT]: VectorDirection.RIGHT,
  },
  [GridLocation.WEST]: {
    [HandSide.RIGHT]: VectorDirection.DOWN,
    [HandSide.LEFT]: VectorDirection.UP,
  },
  [GridLocation.NORTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNRIGHT,
    [HandSide.LEFT]: VectorDirection.UPLEFT,
  },
  [GridLocation.SOUTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.UPRIGHT,
    [HandSide.LEFT]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNRIGHT,
    [HandSide.LEFT]: VectorDirection.UPLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.UPRIGHT,
    [HandSide.LEFT]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.CENTER]: {
    [HandSide.RIGHT]: VectorDirection.UP,
    [HandSide.LEFT]: VectorDirection.DOWN,
  },
};

/**
 * Letter I direction maps (non-radial orientation)
 */
export const LETTER_I_NON_RADIAL_MAP: Record<
  Loc,
  Record<HandSide, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [HandSide.RIGHT]: VectorDirection.UP,
    [HandSide.LEFT]: VectorDirection.DOWN,
  },
  [GridLocation.EAST]: {
    [HandSide.RIGHT]: VectorDirection.RIGHT,
    [HandSide.LEFT]: VectorDirection.LEFT,
  },
  [GridLocation.SOUTH]: {
    [HandSide.RIGHT]: VectorDirection.DOWN,
    [HandSide.LEFT]: VectorDirection.UP,
  },
  [GridLocation.WEST]: {
    [HandSide.RIGHT]: VectorDirection.RIGHT,
    [HandSide.LEFT]: VectorDirection.LEFT,
  },
  [GridLocation.NORTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.UPRIGHT,
    [HandSide.LEFT]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNRIGHT,
    [HandSide.LEFT]: VectorDirection.UPLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.UPRIGHT,
    [HandSide.LEFT]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNRIGHT,
    [HandSide.LEFT]: VectorDirection.UPLEFT,
  },
  [GridLocation.CENTER]: {
    [HandSide.RIGHT]: VectorDirection.UP,
    [HandSide.LEFT]: VectorDirection.DOWN,
  },
};

/**
 * Diamond grid (N/S/E/W) - radial orientation
 */
export const DIAMOND_RADIAL_MAP: Record<
  DiamondLoc,
  Record<HandSide, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [HandSide.RIGHT]: VectorDirection.RIGHT,
    [HandSide.LEFT]: VectorDirection.LEFT,
  },
  [GridLocation.EAST]: {
    [HandSide.RIGHT]: VectorDirection.DOWN,
    [HandSide.LEFT]: VectorDirection.UP,
  },
  [GridLocation.SOUTH]: {
    [HandSide.RIGHT]: VectorDirection.LEFT,
    [HandSide.LEFT]: VectorDirection.RIGHT,
  },
  [GridLocation.WEST]: {
    [HandSide.RIGHT]: VectorDirection.UP,
    [HandSide.LEFT]: VectorDirection.DOWN,
  },
};

/**
 * Diamond grid (N/S/E/W) - non-radial orientation
 */
export const DIAMOND_NON_RADIAL_MAP: Record<
  DiamondLoc,
  Record<HandSide, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [HandSide.RIGHT]: VectorDirection.UP,
    [HandSide.LEFT]: VectorDirection.DOWN,
  },
  [GridLocation.EAST]: {
    [HandSide.RIGHT]: VectorDirection.RIGHT,
    [HandSide.LEFT]: VectorDirection.LEFT,
  },
  [GridLocation.SOUTH]: {
    [HandSide.RIGHT]: VectorDirection.DOWN,
    [HandSide.LEFT]: VectorDirection.UP,
  },
  [GridLocation.WEST]: {
    [HandSide.RIGHT]: VectorDirection.LEFT,
    [HandSide.LEFT]: VectorDirection.RIGHT,
  },
};

/**
 * Box grid (NE/SE/SW/NW) - radial orientation
 */
export const BOX_RADIAL_MAP: Record<
  BoxLoc,
  Record<HandSide, VectorDirection>
> = {
  [GridLocation.NORTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNRIGHT,
    [HandSide.LEFT]: VectorDirection.UPLEFT,
  },
  [GridLocation.SOUTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.UPRIGHT,
    [HandSide.LEFT]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNRIGHT,
    [HandSide.LEFT]: VectorDirection.UPLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.UPRIGHT,
    [HandSide.LEFT]: VectorDirection.DOWNLEFT,
  },
};

/**
 * Box grid (NE/SE/SW/NW) - non-radial orientation
 */
export const BOX_NON_RADIAL_MAP: Record<
  BoxLoc,
  Record<HandSide, VectorDirection>
> = {
  [GridLocation.NORTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.UPRIGHT,
    [HandSide.LEFT]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHEAST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNRIGHT,
    [HandSide.LEFT]: VectorDirection.UPLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.DOWNLEFT,
    [HandSide.LEFT]: VectorDirection.UPRIGHT,
  },
  [GridLocation.NORTHWEST]: {
    [HandSide.RIGHT]: VectorDirection.UPLEFT,
    [HandSide.LEFT]: VectorDirection.DOWNRIGHT,
  },
};

/**
 * Shift motion transitions (start → end location) - radial orientation
 */
export const SHIFT_RADIAL_MAP: Record<
  Loc,
  Partial<Record<Loc, VectorDirection>>
> = {
  [GridLocation.EAST]: {
    [GridLocation.NORTH]: VectorDirection.RIGHT,
    [GridLocation.SOUTH]: VectorDirection.RIGHT,
  },
  [GridLocation.WEST]: {
    [GridLocation.NORTH]: VectorDirection.LEFT,
    [GridLocation.SOUTH]: VectorDirection.LEFT,
  },
  [GridLocation.NORTH]: {
    [GridLocation.EAST]: VectorDirection.UP,
    [GridLocation.WEST]: VectorDirection.UP,
  },
  [GridLocation.SOUTH]: {
    [GridLocation.EAST]: VectorDirection.DOWN,
    [GridLocation.WEST]: VectorDirection.DOWN,
  },
  [GridLocation.NORTHEAST]: {
    [GridLocation.NORTHWEST]: VectorDirection.UPRIGHT,
    [GridLocation.SOUTHEAST]: VectorDirection.UPRIGHT,
  },
  [GridLocation.SOUTHEAST]: {
    [GridLocation.NORTHEAST]: VectorDirection.DOWNRIGHT,
    [GridLocation.SOUTHWEST]: VectorDirection.DOWNRIGHT,
  },
  [GridLocation.SOUTHWEST]: {
    [GridLocation.NORTHWEST]: VectorDirection.DOWNLEFT,
    [GridLocation.SOUTHEAST]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [GridLocation.NORTHEAST]: VectorDirection.UPLEFT,
    [GridLocation.SOUTHWEST]: VectorDirection.UPLEFT,
  },
  [GridLocation.CENTER]: {},
};

/**
 * Shift motion transitions (start → end location) - non-radial orientation
 */
export const SHIFT_NON_RADIAL_MAP: Record<
  Loc,
  Partial<Record<Loc, VectorDirection>>
> = {
  [GridLocation.EAST]: {
    [GridLocation.NORTH]: VectorDirection.UP,
    [GridLocation.SOUTH]: VectorDirection.UP,
  },
  [GridLocation.WEST]: {
    [GridLocation.NORTH]: VectorDirection.DOWN,
    [GridLocation.SOUTH]: VectorDirection.DOWN,
  },
  [GridLocation.NORTH]: {
    [GridLocation.EAST]: VectorDirection.RIGHT,
    [GridLocation.WEST]: VectorDirection.RIGHT,
  },
  [GridLocation.SOUTH]: {
    [GridLocation.EAST]: VectorDirection.LEFT,
    [GridLocation.WEST]: VectorDirection.LEFT,
  },
  [GridLocation.NORTHEAST]: {
    [GridLocation.SOUTHEAST]: VectorDirection.UPLEFT,
    [GridLocation.NORTHWEST]: VectorDirection.DOWNRIGHT,
  },
  [GridLocation.SOUTHEAST]: {
    [GridLocation.NORTHEAST]: VectorDirection.DOWNLEFT,
    [GridLocation.SOUTHWEST]: VectorDirection.UPRIGHT,
  },
  [GridLocation.SOUTHWEST]: {
    [GridLocation.NORTHWEST]: VectorDirection.UPRIGHT,
    [GridLocation.SOUTHEAST]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.CENTER]: {},
  [GridLocation.NORTHWEST]: {
    [GridLocation.NORTHEAST]: VectorDirection.DOWNRIGHT,
    [GridLocation.SOUTHWEST]: VectorDirection.UPLEFT,
  },
};

// Re-export types for consumers
export type { Loc, DiamondLoc, BoxLoc };
