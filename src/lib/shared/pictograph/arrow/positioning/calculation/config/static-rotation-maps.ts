import { GridLocation } from "../../../../grid/domain/enums/grid-enums.ts";
import {
  STATIC_RADIAL_CLOCKWISE_MAP,
  STATIC_RADIAL_COUNTER_CLOCKWISE_MAP,
  STATIC_NON_RADIAL_CLOCKWISE_MAP,
  STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP,
} from "@tka/render-core";

/**
 * Static arrow rotation maps for different orientation modes.
 *
 * RADIAL orientations (IN/OUT) = Diamond Mode
 * NON-RADIAL orientations (CLOCK/COUNTER) = Box Mode
 */

// Static arrow rotation for RADIAL orientations (IN/OUT) - Diamond Mode
export const staticRadialClockwiseMap: Record<GridLocation, number> =
  STATIC_RADIAL_CLOCKWISE_MAP;

export const staticRadialCounterClockwiseMap: Record<GridLocation, number> =
  STATIC_RADIAL_COUNTER_CLOCKWISE_MAP;

// Static arrow rotation for NON-RADIAL orientations (CLOCK/COUNTER) - Box Mode
export const staticNonRadialClockwiseMap: Record<GridLocation, number> =
  STATIC_NON_RADIAL_CLOCKWISE_MAP;

export const staticNonRadialCounterClockwiseMap: Record<GridLocation, number> =
  STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP;

/**
 * ROTATION OVERRIDE MAPS
 * Used when rotation_override flag is set for specific pictograph configurations.
 * Values are calibrated against the web's normal maps (where cw and ccw are
 * intentionally aliased) - SVG mirroring handles the visual direction difference.
 * Selection uses START orientation, matching the legacy desktop calculator.
 */

// Static from RADIAL (IN/OUT) override angles
export const staticRadialOverrideMap: Record<
  GridLocation,
  Record<string, number>
> = {
  [GridLocation.NORTH]: { cw: 180, ccw: 180 },
  [GridLocation.EAST]: { cw: 270, ccw: 270 },
  [GridLocation.SOUTH]: { cw: 0, ccw: 0 },
  [GridLocation.WEST]: { cw: 90, ccw: 90 },
  // Intercardinals corrected to normal+180, matching the cardinal entries' rule.
  // Prior values put the static-radial-override arrow 90 degrees off at every
  // intercardinal: NE 135 to 225, SE 45 to 315, SW 315 to 45, NW 225 to 135.
  [GridLocation.NORTHEAST]: { cw: 225, ccw: 225 },
  [GridLocation.SOUTHEAST]: { cw: 315, ccw: 315 },
  [GridLocation.SOUTHWEST]: { cw: 45, ccw: 45 },
  [GridLocation.NORTHWEST]: { cw: 135, ccw: 135 },
  [GridLocation.CENTER]: { cw: 0, ccw: 0 },
};

// Static from NON-RADIAL (CLOCK/COUNTER) override angles
export const staticNonRadialOverrideMap: Record<
  GridLocation,
  Record<string, number>
> = {
  [GridLocation.NORTH]: { cw: 0, ccw: 0 },
  [GridLocation.EAST]: { cw: 90, ccw: 90 },
  [GridLocation.SOUTH]: { cw: 180, ccw: 180 },
  [GridLocation.WEST]: { cw: 270, ccw: 270 },
  [GridLocation.NORTHEAST]: { cw: 45, ccw: 315 },
  [GridLocation.SOUTHEAST]: { cw: 135, ccw: 225 },
  [GridLocation.SOUTHWEST]: { cw: 225, ccw: 135 },
  [GridLocation.NORTHWEST]: { cw: 315, ccw: 45 },
  [GridLocation.CENTER]: { cw: 0, ccw: 0 },
};
