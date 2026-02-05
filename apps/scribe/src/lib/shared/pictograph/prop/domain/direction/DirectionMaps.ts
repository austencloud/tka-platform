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
  MotionColor,
  VectorDirection,
} from "../../../shared/domain/enums/pictograph-enums";

// Location type aliases
type Loc = `${GridLocation}`;
type DiamondLoc =
  | GridLocation.NORTH
  | GridLocation.SOUTH
  | GridLocation.EAST
  | GridLocation.WEST;
type BoxLoc =
  | GridLocation.NORTHEAST
  | GridLocation.SOUTHEAST
  | GridLocation.SOUTHWEST
  | GridLocation.NORTHWEST;

/**
 * Letter I direction maps (radial orientation)
 */
export const LETTER_I_RADIAL_MAP: Record<
  Loc,
  Record<MotionColor, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [MotionColor.RED]: VectorDirection.RIGHT,
    [MotionColor.BLUE]: VectorDirection.LEFT,
  },
  [GridLocation.EAST]: {
    [MotionColor.RED]: VectorDirection.DOWN,
    [MotionColor.BLUE]: VectorDirection.UP,
  },
  [GridLocation.SOUTH]: {
    [MotionColor.RED]: VectorDirection.LEFT,
    [MotionColor.BLUE]: VectorDirection.RIGHT,
  },
  [GridLocation.WEST]: {
    [MotionColor.RED]: VectorDirection.DOWN,
    [MotionColor.BLUE]: VectorDirection.UP,
  },
  [GridLocation.NORTHEAST]: {
    [MotionColor.RED]: VectorDirection.DOWNRIGHT,
    [MotionColor.BLUE]: VectorDirection.UPLEFT,
  },
  [GridLocation.SOUTHEAST]: {
    [MotionColor.RED]: VectorDirection.UPRIGHT,
    [MotionColor.BLUE]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [MotionColor.RED]: VectorDirection.DOWNRIGHT,
    [MotionColor.BLUE]: VectorDirection.UPLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [MotionColor.RED]: VectorDirection.UPRIGHT,
    [MotionColor.BLUE]: VectorDirection.DOWNLEFT,
  },
};

/**
 * Letter I direction maps (non-radial orientation)
 */
export const LETTER_I_NON_RADIAL_MAP: Record<
  Loc,
  Record<MotionColor, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [MotionColor.RED]: VectorDirection.UP,
    [MotionColor.BLUE]: VectorDirection.DOWN,
  },
  [GridLocation.EAST]: {
    [MotionColor.RED]: VectorDirection.RIGHT,
    [MotionColor.BLUE]: VectorDirection.LEFT,
  },
  [GridLocation.SOUTH]: {
    [MotionColor.RED]: VectorDirection.DOWN,
    [MotionColor.BLUE]: VectorDirection.UP,
  },
  [GridLocation.WEST]: {
    [MotionColor.RED]: VectorDirection.RIGHT,
    [MotionColor.BLUE]: VectorDirection.LEFT,
  },
  [GridLocation.NORTHEAST]: {
    [MotionColor.RED]: VectorDirection.UPRIGHT,
    [MotionColor.BLUE]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHEAST]: {
    [MotionColor.RED]: VectorDirection.DOWNRIGHT,
    [MotionColor.BLUE]: VectorDirection.UPLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [MotionColor.RED]: VectorDirection.UPRIGHT,
    [MotionColor.BLUE]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [MotionColor.RED]: VectorDirection.DOWNRIGHT,
    [MotionColor.BLUE]: VectorDirection.UPLEFT,
  },
};

/**
 * Diamond grid (N/S/E/W) - radial orientation
 */
export const DIAMOND_RADIAL_MAP: Record<
  DiamondLoc,
  Record<MotionColor, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [MotionColor.RED]: VectorDirection.RIGHT,
    [MotionColor.BLUE]: VectorDirection.LEFT,
  },
  [GridLocation.EAST]: {
    [MotionColor.RED]: VectorDirection.DOWN,
    [MotionColor.BLUE]: VectorDirection.UP,
  },
  [GridLocation.SOUTH]: {
    [MotionColor.RED]: VectorDirection.LEFT,
    [MotionColor.BLUE]: VectorDirection.RIGHT,
  },
  [GridLocation.WEST]: {
    [MotionColor.RED]: VectorDirection.UP,
    [MotionColor.BLUE]: VectorDirection.DOWN,
  },
};

/**
 * Diamond grid (N/S/E/W) - non-radial orientation
 */
export const DIAMOND_NON_RADIAL_MAP: Record<
  DiamondLoc,
  Record<MotionColor, VectorDirection>
> = {
  [GridLocation.NORTH]: {
    [MotionColor.RED]: VectorDirection.UP,
    [MotionColor.BLUE]: VectorDirection.DOWN,
  },
  [GridLocation.EAST]: {
    [MotionColor.RED]: VectorDirection.RIGHT,
    [MotionColor.BLUE]: VectorDirection.LEFT,
  },
  [GridLocation.SOUTH]: {
    [MotionColor.RED]: VectorDirection.DOWN,
    [MotionColor.BLUE]: VectorDirection.UP,
  },
  [GridLocation.WEST]: {
    [MotionColor.RED]: VectorDirection.LEFT,
    [MotionColor.BLUE]: VectorDirection.RIGHT,
  },
};

/**
 * Box grid (NE/SE/SW/NW) - radial orientation
 */
export const BOX_RADIAL_MAP: Record<
  BoxLoc,
  Record<MotionColor, VectorDirection>
> = {
  [GridLocation.NORTHEAST]: {
    [MotionColor.RED]: VectorDirection.DOWNRIGHT,
    [MotionColor.BLUE]: VectorDirection.UPLEFT,
  },
  [GridLocation.SOUTHEAST]: {
    [MotionColor.RED]: VectorDirection.UPRIGHT,
    [MotionColor.BLUE]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [MotionColor.RED]: VectorDirection.DOWNRIGHT,
    [MotionColor.BLUE]: VectorDirection.UPLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [MotionColor.RED]: VectorDirection.UPRIGHT,
    [MotionColor.BLUE]: VectorDirection.DOWNLEFT,
  },
};

/**
 * Box grid (NE/SE/SW/NW) - non-radial orientation
 */
export const BOX_NON_RADIAL_MAP: Record<
  BoxLoc,
  Record<MotionColor, VectorDirection>
> = {
  [GridLocation.NORTHEAST]: {
    [MotionColor.RED]: VectorDirection.UPLEFT,
    [MotionColor.BLUE]: VectorDirection.DOWNRIGHT,
  },
  [GridLocation.SOUTHEAST]: {
    [MotionColor.RED]: VectorDirection.UPRIGHT,
    [MotionColor.BLUE]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.SOUTHWEST]: {
    [MotionColor.RED]: VectorDirection.UPLEFT,
    [MotionColor.BLUE]: VectorDirection.DOWNRIGHT,
  },
  [GridLocation.NORTHWEST]: {
    [MotionColor.RED]: VectorDirection.DOWNLEFT,
    [MotionColor.BLUE]: VectorDirection.UPRIGHT,
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
  [GridLocation.NORTHWEST]: {
    [GridLocation.NORTHEAST]: VectorDirection.DOWNRIGHT,
    [GridLocation.SOUTHWEST]: VectorDirection.UPLEFT,
  },
};

// Re-export types for consumers
export type { Loc, DiamondLoc, BoxLoc };
