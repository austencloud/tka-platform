import { GridLocation } from "../../../../grid/domain/enums/grid-enums.ts";

/**
 * Static arrow rotation maps for different orientation modes.
 *
 * RADIAL orientations (IN/OUT) = Diamond Mode
 * NON-RADIAL orientations (CLOCK/COUNTER) = Box Mode
 */

// Static arrow rotation for RADIAL orientations (IN/OUT) - Diamond Mode
export const staticRadialClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 0,
  [GridLocation.EAST]: 90,
  [GridLocation.SOUTH]: 180,
  [GridLocation.WEST]: 270,
  [GridLocation.NORTHEAST]: 45,
  [GridLocation.SOUTHEAST]: 135,
  [GridLocation.SOUTHWEST]: 225,
  [GridLocation.NORTHWEST]: 315,
};

export const staticRadialCounterClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 0,
  [GridLocation.EAST]: 90,
  [GridLocation.SOUTH]: 180,
  [GridLocation.WEST]: 270,
  [GridLocation.NORTHEAST]: 45,
  [GridLocation.SOUTHEAST]: 135,
  [GridLocation.SOUTHWEST]: 225,
  [GridLocation.NORTHWEST]: 315,
};

// Static arrow rotation for NON-RADIAL orientations (CLOCK/COUNTER) - Box Mode
export const staticNonRadialClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 180,
  [GridLocation.EAST]: 270,
  [GridLocation.SOUTH]: 0,
  [GridLocation.WEST]: 90,
  [GridLocation.NORTHEAST]: 225,
  [GridLocation.SOUTHEAST]: 315,
  [GridLocation.SOUTHWEST]: 45,
  [GridLocation.NORTHWEST]: 135,
};

export const staticNonRadialCounterClockwiseMap: Record<GridLocation, number> =
  {
    [GridLocation.NORTH]: 180,
    [GridLocation.EAST]: 270,
    [GridLocation.SOUTH]: 0,
    [GridLocation.WEST]: 90,
    [GridLocation.NORTHEAST]: 225,
    [GridLocation.SOUTHEAST]: 315,
    [GridLocation.SOUTHWEST]: 45,
    [GridLocation.NORTHWEST]: 135,
  };

/**
 * ROTATION OVERRIDE MAPS
 * Used when rotation_override flag is set for specific pictograph configurations.
 * These provide DIFFERENT angles than the standard maps above.
 */

// Static from RADIAL (IN/OUT) override angles
// NOTE: cw and ccw should have the SAME angle because SVG mirroring
// handles the visual difference when pictographs are transformed.
export const staticRadialOverrideMap: Record<
  GridLocation,
  Record<string, number>
> = {
  [GridLocation.NORTH]: { cw: 180, ccw: 180 },
  [GridLocation.EAST]: { cw: 270, ccw: 270 },
  [GridLocation.SOUTH]: { cw: 0, ccw: 0 },
  [GridLocation.WEST]: { cw: 90, ccw: 90 },
  [GridLocation.NORTHEAST]: { cw: 135, ccw: 135 },
  [GridLocation.SOUTHEAST]: { cw: 45, ccw: 45 },
  [GridLocation.SOUTHWEST]: { cw: 315, ccw: 315 },
  [GridLocation.NORTHWEST]: { cw: 225, ccw: 225 },
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
};
