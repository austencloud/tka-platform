/**
 * Circular Position Maps for LOOP (Linked Orbital Offset Pattern) Generation
 *
 * These maps define the valid end positions for circular sequences based on rotation angles.
 * - Halved LOOPs: 180° rotation (position +4 or -4)
 * - Quartered LOOPs: 90° rotation (position +2 or -2 for clockwise/counter-clockwise)
 */

import {
  GridPosition,
  GridPositionGroup,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Position Zone Types
 * Alpha and Beta have 8 positions each.
 * Gamma has 16 positions split into two structural halves.
 */
export type PositionZone = "alpha" | "beta" | "gamma1-8" | "gamma9-16";

/**
 * Extract the zone from a GridPosition
 */
export function getPositionZone(position: GridPosition): PositionZone {
  if (position.startsWith("alpha")) return "alpha";
  if (position.startsWith("beta")) return "beta";
  if (position.startsWith("gamma")) {
    const num = parseInt(position.replace("gamma", ""), 10);
    return num <= 8 ? "gamma1-8" : "gamma9-16";
  }
  throw new Error(`Unknown position: ${position}`);
}

/**
 * Get the position group (ALPHA, BETA, GAMMA) from a GridPosition
 */
export function getPositionGroup(position: GridPosition): GridPositionGroup {
  if (position.startsWith("alpha")) return GridPositionGroup.ALPHA;
  if (position.startsWith("beta")) return GridPositionGroup.BETA;
  if (position.startsWith("gamma")) return GridPositionGroup.GAMMA;
  throw new Error(`Unknown position: ${position}`);
}

/**
 * Zone coverage analysis result
 */
export interface ZoneCoverageAnalysis {
  alpha: GridPosition[];
  beta: GridPosition[];
  gamma1to8: GridPosition[];
  gamma9to16: GridPosition[];
  summary: {
    alphaCount: number;
    betaCount: number;
    gamma1to8Count: number;
    gamma9to16Count: number;
    totalZonesCovered: number; // 0-4
    isComplete: boolean; // All 4 zones represented
  };
}

/**
 * Analyze zone coverage for a list of end positions
 */
export function analyzeZoneCoverage(
  positions: (GridPosition | null | undefined)[]
): ZoneCoverageAnalysis {
  const alpha: GridPosition[] = [];
  const beta: GridPosition[] = [];
  const gamma1to8: GridPosition[] = [];
  const gamma9to16: GridPosition[] = [];

  for (const pos of positions) {
    if (!pos) continue;
    const zone = getPositionZone(pos);
    switch (zone) {
      case "alpha":
        alpha.push(pos);
        break;
      case "beta":
        beta.push(pos);
        break;
      case "gamma1-8":
        gamma1to8.push(pos);
        break;
      case "gamma9-16":
        gamma9to16.push(pos);
        break;
    }
  }

  const zonesCovered = [alpha, beta, gamma1to8, gamma9to16].filter(
    (arr) => arr.length > 0
  ).length;

  return {
    alpha,
    beta,
    gamma1to8,
    gamma9to16,
    summary: {
      alphaCount: alpha.length,
      betaCount: beta.length,
      gamma1to8Count: gamma1to8.length,
      gamma9to16Count: gamma9to16.length,
      totalZonesCovered: zonesCovered,
      isComplete: zonesCovered === 4,
    },
  };
}

/**
 * Half position map - 180° rotation
 * Maps each position to its opposite position (4 positions away within each 8-position group)
 */
export const HALF_POSITION_MAP: Record<GridPosition, GridPosition> = {
  // Alpha positions
  [GridPosition.ALPHA1]: GridPosition.ALPHA5,
  [GridPosition.ALPHA2]: GridPosition.ALPHA6,
  [GridPosition.ALPHA3]: GridPosition.ALPHA7,
  [GridPosition.ALPHA4]: GridPosition.ALPHA8,
  [GridPosition.ALPHA5]: GridPosition.ALPHA1,
  [GridPosition.ALPHA6]: GridPosition.ALPHA2,
  [GridPosition.ALPHA7]: GridPosition.ALPHA3,
  [GridPosition.ALPHA8]: GridPosition.ALPHA4,

  // Beta positions
  [GridPosition.BETA1]: GridPosition.BETA5,
  [GridPosition.BETA2]: GridPosition.BETA6,
  [GridPosition.BETA3]: GridPosition.BETA7,
  [GridPosition.BETA4]: GridPosition.BETA8,
  [GridPosition.BETA5]: GridPosition.BETA1,
  [GridPosition.BETA6]: GridPosition.BETA2,
  [GridPosition.BETA7]: GridPosition.BETA3,
  [GridPosition.BETA8]: GridPosition.BETA4,

  // Gamma 1-8 positions
  [GridPosition.GAMMA1]: GridPosition.GAMMA5,
  [GridPosition.GAMMA2]: GridPosition.GAMMA6,
  [GridPosition.GAMMA3]: GridPosition.GAMMA7,
  [GridPosition.GAMMA4]: GridPosition.GAMMA8,
  [GridPosition.GAMMA5]: GridPosition.GAMMA1,
  [GridPosition.GAMMA6]: GridPosition.GAMMA2,
  [GridPosition.GAMMA7]: GridPosition.GAMMA3,
  [GridPosition.GAMMA8]: GridPosition.GAMMA4,

  // Gamma 9-16 positions
  [GridPosition.GAMMA9]: GridPosition.GAMMA13,
  [GridPosition.GAMMA10]: GridPosition.GAMMA14,
  [GridPosition.GAMMA11]: GridPosition.GAMMA15,
  [GridPosition.GAMMA12]: GridPosition.GAMMA16,
  [GridPosition.GAMMA13]: GridPosition.GAMMA9,
  [GridPosition.GAMMA14]: GridPosition.GAMMA10,
  [GridPosition.GAMMA15]: GridPosition.GAMMA11,
  [GridPosition.GAMMA16]: GridPosition.GAMMA12,

  // Zeta 1-8 positions (135° obtuse angle)
  [GridPosition.ZETA1]: GridPosition.ZETA5,
  [GridPosition.ZETA2]: GridPosition.ZETA6,
  [GridPosition.ZETA3]: GridPosition.ZETA7,
  [GridPosition.ZETA4]: GridPosition.ZETA8,
  [GridPosition.ZETA5]: GridPosition.ZETA1,
  [GridPosition.ZETA6]: GridPosition.ZETA2,
  [GridPosition.ZETA7]: GridPosition.ZETA3,
  [GridPosition.ZETA8]: GridPosition.ZETA4,

  // Zeta 9-16 positions
  [GridPosition.ZETA9]: GridPosition.ZETA13,
  [GridPosition.ZETA10]: GridPosition.ZETA14,
  [GridPosition.ZETA11]: GridPosition.ZETA15,
  [GridPosition.ZETA12]: GridPosition.ZETA16,
  [GridPosition.ZETA13]: GridPosition.ZETA9,
  [GridPosition.ZETA14]: GridPosition.ZETA10,
  [GridPosition.ZETA15]: GridPosition.ZETA11,
  [GridPosition.ZETA16]: GridPosition.ZETA12,

  // Eta 1-8 positions (45° acute angle)
  [GridPosition.ETA1]: GridPosition.ETA5,
  [GridPosition.ETA2]: GridPosition.ETA6,
  [GridPosition.ETA3]: GridPosition.ETA7,
  [GridPosition.ETA4]: GridPosition.ETA8,
  [GridPosition.ETA5]: GridPosition.ETA1,
  [GridPosition.ETA6]: GridPosition.ETA2,
  [GridPosition.ETA7]: GridPosition.ETA3,
  [GridPosition.ETA8]: GridPosition.ETA4,

  // Eta 9-16 positions
  [GridPosition.ETA9]: GridPosition.ETA13,
  [GridPosition.ETA10]: GridPosition.ETA14,
  [GridPosition.ETA11]: GridPosition.ETA15,
  [GridPosition.ETA12]: GridPosition.ETA16,
  [GridPosition.ETA13]: GridPosition.ETA9,
  [GridPosition.ETA14]: GridPosition.ETA10,
  [GridPosition.ETA15]: GridPosition.ETA11,
  [GridPosition.ETA16]: GridPosition.ETA12,

  // Tau positions - 180° rotation switches which hand is at center
  [GridPosition.TAU1]: GridPosition.TAU9,
  [GridPosition.TAU2]: GridPosition.TAU10,
  [GridPosition.TAU3]: GridPosition.TAU11,
  [GridPosition.TAU4]: GridPosition.TAU12,
  [GridPosition.TAU5]: GridPosition.TAU13,
  [GridPosition.TAU6]: GridPosition.TAU14,
  [GridPosition.TAU7]: GridPosition.TAU15,
  [GridPosition.TAU8]: GridPosition.TAU16,
  [GridPosition.TAU9]: GridPosition.TAU1,
  [GridPosition.TAU10]: GridPosition.TAU2,
  [GridPosition.TAU11]: GridPosition.TAU3,
  [GridPosition.TAU12]: GridPosition.TAU4,
  [GridPosition.TAU13]: GridPosition.TAU5,
  [GridPosition.TAU14]: GridPosition.TAU6,
  [GridPosition.TAU15]: GridPosition.TAU7,
  [GridPosition.TAU16]: GridPosition.TAU8,

  // Terra - both hands at center, stays the same
  [GridPosition.TERRA1]: GridPosition.TERRA1,
};

/**
 * Quarter position map - Clockwise 90° rotation
 * Maps each position to 2 positions clockwise (for box grid)
 */
export const QUARTER_POSITION_MAP_CW: Record<GridPosition, GridPosition> = {
  // Alpha positions
  [GridPosition.ALPHA1]: GridPosition.ALPHA3,
  [GridPosition.ALPHA2]: GridPosition.ALPHA4,
  [GridPosition.ALPHA3]: GridPosition.ALPHA5,
  [GridPosition.ALPHA4]: GridPosition.ALPHA6,
  [GridPosition.ALPHA5]: GridPosition.ALPHA7,
  [GridPosition.ALPHA6]: GridPosition.ALPHA8,
  [GridPosition.ALPHA7]: GridPosition.ALPHA1,
  [GridPosition.ALPHA8]: GridPosition.ALPHA2,

  // Beta positions
  [GridPosition.BETA1]: GridPosition.BETA3,
  [GridPosition.BETA2]: GridPosition.BETA4,
  [GridPosition.BETA3]: GridPosition.BETA5,
  [GridPosition.BETA4]: GridPosition.BETA6,
  [GridPosition.BETA5]: GridPosition.BETA7,
  [GridPosition.BETA6]: GridPosition.BETA8,
  [GridPosition.BETA7]: GridPosition.BETA1,
  [GridPosition.BETA8]: GridPosition.BETA2,

  // Gamma 1-8 positions
  [GridPosition.GAMMA1]: GridPosition.GAMMA3,
  [GridPosition.GAMMA2]: GridPosition.GAMMA4,
  [GridPosition.GAMMA3]: GridPosition.GAMMA5,
  [GridPosition.GAMMA4]: GridPosition.GAMMA6,
  [GridPosition.GAMMA5]: GridPosition.GAMMA7,
  [GridPosition.GAMMA6]: GridPosition.GAMMA8,
  [GridPosition.GAMMA7]: GridPosition.GAMMA1,
  [GridPosition.GAMMA8]: GridPosition.GAMMA2,

  // Gamma 9-16 positions
  [GridPosition.GAMMA9]: GridPosition.GAMMA11,
  [GridPosition.GAMMA10]: GridPosition.GAMMA12,
  [GridPosition.GAMMA11]: GridPosition.GAMMA13,
  [GridPosition.GAMMA12]: GridPosition.GAMMA14,
  [GridPosition.GAMMA13]: GridPosition.GAMMA15,
  [GridPosition.GAMMA14]: GridPosition.GAMMA16,
  [GridPosition.GAMMA15]: GridPosition.GAMMA9,
  [GridPosition.GAMMA16]: GridPosition.GAMMA10,

  // Zeta 1-8 positions (90° CW = +2 positions)
  [GridPosition.ZETA1]: GridPosition.ZETA3,
  [GridPosition.ZETA2]: GridPosition.ZETA4,
  [GridPosition.ZETA3]: GridPosition.ZETA5,
  [GridPosition.ZETA4]: GridPosition.ZETA6,
  [GridPosition.ZETA5]: GridPosition.ZETA7,
  [GridPosition.ZETA6]: GridPosition.ZETA8,
  [GridPosition.ZETA7]: GridPosition.ZETA1,
  [GridPosition.ZETA8]: GridPosition.ZETA2,

  // Zeta 9-16 positions
  [GridPosition.ZETA9]: GridPosition.ZETA11,
  [GridPosition.ZETA10]: GridPosition.ZETA12,
  [GridPosition.ZETA11]: GridPosition.ZETA13,
  [GridPosition.ZETA12]: GridPosition.ZETA14,
  [GridPosition.ZETA13]: GridPosition.ZETA15,
  [GridPosition.ZETA14]: GridPosition.ZETA16,
  [GridPosition.ZETA15]: GridPosition.ZETA9,
  [GridPosition.ZETA16]: GridPosition.ZETA10,

  // Eta 1-8 positions (90° CW = +2 positions)
  [GridPosition.ETA1]: GridPosition.ETA3,
  [GridPosition.ETA2]: GridPosition.ETA4,
  [GridPosition.ETA3]: GridPosition.ETA5,
  [GridPosition.ETA4]: GridPosition.ETA6,
  [GridPosition.ETA5]: GridPosition.ETA7,
  [GridPosition.ETA6]: GridPosition.ETA8,
  [GridPosition.ETA7]: GridPosition.ETA1,
  [GridPosition.ETA8]: GridPosition.ETA2,

  // Eta 9-16 positions
  [GridPosition.ETA9]: GridPosition.ETA11,
  [GridPosition.ETA10]: GridPosition.ETA12,
  [GridPosition.ETA11]: GridPosition.ETA13,
  [GridPosition.ETA12]: GridPosition.ETA14,
  [GridPosition.ETA13]: GridPosition.ETA15,
  [GridPosition.ETA14]: GridPosition.ETA16,
  [GridPosition.ETA15]: GridPosition.ETA9,
  [GridPosition.ETA16]: GridPosition.ETA10,

  // Tau 1-8 positions (90° CW = +2 positions within group)
  [GridPosition.TAU1]: GridPosition.TAU3,
  [GridPosition.TAU2]: GridPosition.TAU4,
  [GridPosition.TAU3]: GridPosition.TAU5,
  [GridPosition.TAU4]: GridPosition.TAU6,
  [GridPosition.TAU5]: GridPosition.TAU7,
  [GridPosition.TAU6]: GridPosition.TAU8,
  [GridPosition.TAU7]: GridPosition.TAU1,
  [GridPosition.TAU8]: GridPosition.TAU2,

  // Tau 9-16 positions
  [GridPosition.TAU9]: GridPosition.TAU11,
  [GridPosition.TAU10]: GridPosition.TAU12,
  [GridPosition.TAU11]: GridPosition.TAU13,
  [GridPosition.TAU12]: GridPosition.TAU14,
  [GridPosition.TAU13]: GridPosition.TAU15,
  [GridPosition.TAU14]: GridPosition.TAU16,
  [GridPosition.TAU15]: GridPosition.TAU9,
  [GridPosition.TAU16]: GridPosition.TAU10,

  // Terra - both hands at center, stays the same
  [GridPosition.TERRA1]: GridPosition.TERRA1,
};

/**
 * Quarter position map - Counter-clockwise 90° rotation
 * Maps each position to 2 positions counter-clockwise (for box grid)
 */
export const QUARTER_POSITION_MAP_CCW: Record<GridPosition, GridPosition> = {
  // Alpha positions
  [GridPosition.ALPHA1]: GridPosition.ALPHA7,
  [GridPosition.ALPHA2]: GridPosition.ALPHA8,
  [GridPosition.ALPHA3]: GridPosition.ALPHA1,
  [GridPosition.ALPHA4]: GridPosition.ALPHA2,
  [GridPosition.ALPHA5]: GridPosition.ALPHA3,
  [GridPosition.ALPHA6]: GridPosition.ALPHA4,
  [GridPosition.ALPHA7]: GridPosition.ALPHA5,
  [GridPosition.ALPHA8]: GridPosition.ALPHA6,

  // Beta positions
  [GridPosition.BETA1]: GridPosition.BETA7,
  [GridPosition.BETA2]: GridPosition.BETA8,
  [GridPosition.BETA3]: GridPosition.BETA1,
  [GridPosition.BETA4]: GridPosition.BETA2,
  [GridPosition.BETA5]: GridPosition.BETA3,
  [GridPosition.BETA6]: GridPosition.BETA4,
  [GridPosition.BETA7]: GridPosition.BETA5,
  [GridPosition.BETA8]: GridPosition.BETA6,

  // Gamma 1-8 positions
  [GridPosition.GAMMA1]: GridPosition.GAMMA7,
  [GridPosition.GAMMA2]: GridPosition.GAMMA8,
  [GridPosition.GAMMA3]: GridPosition.GAMMA1,
  [GridPosition.GAMMA4]: GridPosition.GAMMA2,
  [GridPosition.GAMMA5]: GridPosition.GAMMA3,
  [GridPosition.GAMMA6]: GridPosition.GAMMA4,
  [GridPosition.GAMMA7]: GridPosition.GAMMA5,
  [GridPosition.GAMMA8]: GridPosition.GAMMA6,

  // Gamma 9-16 positions
  [GridPosition.GAMMA9]: GridPosition.GAMMA15,
  [GridPosition.GAMMA10]: GridPosition.GAMMA16,
  [GridPosition.GAMMA11]: GridPosition.GAMMA9,
  [GridPosition.GAMMA12]: GridPosition.GAMMA10,
  [GridPosition.GAMMA13]: GridPosition.GAMMA11,
  [GridPosition.GAMMA14]: GridPosition.GAMMA12,
  [GridPosition.GAMMA15]: GridPosition.GAMMA13,
  [GridPosition.GAMMA16]: GridPosition.GAMMA14,

  // Zeta 1-8 positions (90° CCW = -2 positions = +6 mod 8)
  [GridPosition.ZETA1]: GridPosition.ZETA7,
  [GridPosition.ZETA2]: GridPosition.ZETA8,
  [GridPosition.ZETA3]: GridPosition.ZETA1,
  [GridPosition.ZETA4]: GridPosition.ZETA2,
  [GridPosition.ZETA5]: GridPosition.ZETA3,
  [GridPosition.ZETA6]: GridPosition.ZETA4,
  [GridPosition.ZETA7]: GridPosition.ZETA5,
  [GridPosition.ZETA8]: GridPosition.ZETA6,

  // Zeta 9-16 positions
  [GridPosition.ZETA9]: GridPosition.ZETA15,
  [GridPosition.ZETA10]: GridPosition.ZETA16,
  [GridPosition.ZETA11]: GridPosition.ZETA9,
  [GridPosition.ZETA12]: GridPosition.ZETA10,
  [GridPosition.ZETA13]: GridPosition.ZETA11,
  [GridPosition.ZETA14]: GridPosition.ZETA12,
  [GridPosition.ZETA15]: GridPosition.ZETA13,
  [GridPosition.ZETA16]: GridPosition.ZETA14,

  // Eta 1-8 positions (90° CCW = -2 positions = +6 mod 8)
  [GridPosition.ETA1]: GridPosition.ETA7,
  [GridPosition.ETA2]: GridPosition.ETA8,
  [GridPosition.ETA3]: GridPosition.ETA1,
  [GridPosition.ETA4]: GridPosition.ETA2,
  [GridPosition.ETA5]: GridPosition.ETA3,
  [GridPosition.ETA6]: GridPosition.ETA4,
  [GridPosition.ETA7]: GridPosition.ETA5,
  [GridPosition.ETA8]: GridPosition.ETA6,

  // Eta 9-16 positions
  [GridPosition.ETA9]: GridPosition.ETA15,
  [GridPosition.ETA10]: GridPosition.ETA16,
  [GridPosition.ETA11]: GridPosition.ETA9,
  [GridPosition.ETA12]: GridPosition.ETA10,
  [GridPosition.ETA13]: GridPosition.ETA11,
  [GridPosition.ETA14]: GridPosition.ETA12,
  [GridPosition.ETA15]: GridPosition.ETA13,
  [GridPosition.ETA16]: GridPosition.ETA14,

  // Tau 1-8 positions (90° CCW = -2 positions = +6 mod 8)
  [GridPosition.TAU1]: GridPosition.TAU7,
  [GridPosition.TAU2]: GridPosition.TAU8,
  [GridPosition.TAU3]: GridPosition.TAU1,
  [GridPosition.TAU4]: GridPosition.TAU2,
  [GridPosition.TAU5]: GridPosition.TAU3,
  [GridPosition.TAU6]: GridPosition.TAU4,
  [GridPosition.TAU7]: GridPosition.TAU5,
  [GridPosition.TAU8]: GridPosition.TAU6,

  // Tau 9-16 positions
  [GridPosition.TAU9]: GridPosition.TAU15,
  [GridPosition.TAU10]: GridPosition.TAU16,
  [GridPosition.TAU11]: GridPosition.TAU9,
  [GridPosition.TAU12]: GridPosition.TAU10,
  [GridPosition.TAU13]: GridPosition.TAU11,
  [GridPosition.TAU14]: GridPosition.TAU12,
  [GridPosition.TAU15]: GridPosition.TAU13,
  [GridPosition.TAU16]: GridPosition.TAU14,

  // Terra - both hands at center, stays the same
  [GridPosition.TERRA1]: GridPosition.TERRA1,
};

/**
 * Halved LOOP validation set
 * Set of (start_position, end_position) tuples that are valid for halved LOOPs
 */
export const HALVED_LOOPS = new Set<string>([
  `${GridPosition.ALPHA1},${GridPosition.ALPHA5}`,
  `${GridPosition.ALPHA2},${GridPosition.ALPHA6}`,
  `${GridPosition.ALPHA3},${GridPosition.ALPHA7}`,
  `${GridPosition.ALPHA4},${GridPosition.ALPHA8}`,
  `${GridPosition.ALPHA5},${GridPosition.ALPHA1}`,
  `${GridPosition.ALPHA6},${GridPosition.ALPHA2}`,
  `${GridPosition.ALPHA7},${GridPosition.ALPHA3}`,
  `${GridPosition.ALPHA8},${GridPosition.ALPHA4}`,

  `${GridPosition.BETA1},${GridPosition.BETA5}`,
  `${GridPosition.BETA2},${GridPosition.BETA6}`,
  `${GridPosition.BETA3},${GridPosition.BETA7}`,
  `${GridPosition.BETA4},${GridPosition.BETA8}`,
  `${GridPosition.BETA5},${GridPosition.BETA1}`,
  `${GridPosition.BETA6},${GridPosition.BETA2}`,
  `${GridPosition.BETA7},${GridPosition.BETA3}`,
  `${GridPosition.BETA8},${GridPosition.BETA4}`,

  `${GridPosition.GAMMA1},${GridPosition.GAMMA5}`,
  `${GridPosition.GAMMA2},${GridPosition.GAMMA6}`,
  `${GridPosition.GAMMA3},${GridPosition.GAMMA7}`,
  `${GridPosition.GAMMA4},${GridPosition.GAMMA8}`,
  `${GridPosition.GAMMA5},${GridPosition.GAMMA1}`,
  `${GridPosition.GAMMA6},${GridPosition.GAMMA2}`,
  `${GridPosition.GAMMA7},${GridPosition.GAMMA3}`,
  `${GridPosition.GAMMA8},${GridPosition.GAMMA4}`,

  `${GridPosition.GAMMA9},${GridPosition.GAMMA13}`,
  `${GridPosition.GAMMA10},${GridPosition.GAMMA14}`,
  `${GridPosition.GAMMA11},${GridPosition.GAMMA15}`,
  `${GridPosition.GAMMA12},${GridPosition.GAMMA16}`,
  `${GridPosition.GAMMA13},${GridPosition.GAMMA9}`,
  `${GridPosition.GAMMA14},${GridPosition.GAMMA10}`,
  `${GridPosition.GAMMA15},${GridPosition.GAMMA11}`,
  `${GridPosition.GAMMA16},${GridPosition.GAMMA12}`,
]);

/**
 * Quartered LOOP validation set
 * Set of (start_position, end_position) tuples that are valid for quartered LOOPs
 */
export const QUARTERED_LOOPS = new Set<string>([
  // Clockwise quarter rotations
  `${GridPosition.ALPHA1},${GridPosition.ALPHA3}`,
  `${GridPosition.ALPHA2},${GridPosition.ALPHA4}`,
  `${GridPosition.ALPHA3},${GridPosition.ALPHA5}`,
  `${GridPosition.ALPHA4},${GridPosition.ALPHA6}`,
  `${GridPosition.ALPHA5},${GridPosition.ALPHA7}`,
  `${GridPosition.ALPHA6},${GridPosition.ALPHA8}`,
  `${GridPosition.ALPHA7},${GridPosition.ALPHA1}`,
  `${GridPosition.ALPHA8},${GridPosition.ALPHA2}`,

  // Counter-clockwise quarter rotations
  `${GridPosition.ALPHA1},${GridPosition.ALPHA7}`,
  `${GridPosition.ALPHA2},${GridPosition.ALPHA8}`,
  `${GridPosition.ALPHA3},${GridPosition.ALPHA1}`,
  `${GridPosition.ALPHA4},${GridPosition.ALPHA2}`,
  `${GridPosition.ALPHA5},${GridPosition.ALPHA3}`,
  `${GridPosition.ALPHA6},${GridPosition.ALPHA4}`,
  `${GridPosition.ALPHA7},${GridPosition.ALPHA5}`,
  `${GridPosition.ALPHA8},${GridPosition.ALPHA6}`,

  // Beta clockwise
  `${GridPosition.BETA1},${GridPosition.BETA3}`,
  `${GridPosition.BETA2},${GridPosition.BETA4}`,
  `${GridPosition.BETA3},${GridPosition.BETA5}`,
  `${GridPosition.BETA4},${GridPosition.BETA6}`,
  `${GridPosition.BETA5},${GridPosition.BETA7}`,
  `${GridPosition.BETA6},${GridPosition.BETA8}`,
  `${GridPosition.BETA7},${GridPosition.BETA1}`,
  `${GridPosition.BETA8},${GridPosition.BETA2}`,

  // Beta counter-clockwise
  `${GridPosition.BETA1},${GridPosition.BETA7}`,
  `${GridPosition.BETA2},${GridPosition.BETA8}`,
  `${GridPosition.BETA3},${GridPosition.BETA1}`,
  `${GridPosition.BETA4},${GridPosition.BETA2}`,
  `${GridPosition.BETA5},${GridPosition.BETA3}`,
  `${GridPosition.BETA6},${GridPosition.BETA4}`,
  `${GridPosition.BETA7},${GridPosition.BETA5}`,
  `${GridPosition.BETA8},${GridPosition.BETA6}`,

  // Gamma 1-8 clockwise
  `${GridPosition.GAMMA1},${GridPosition.GAMMA3}`,
  `${GridPosition.GAMMA2},${GridPosition.GAMMA4}`,
  `${GridPosition.GAMMA3},${GridPosition.GAMMA5}`,
  `${GridPosition.GAMMA4},${GridPosition.GAMMA6}`,
  `${GridPosition.GAMMA5},${GridPosition.GAMMA7}`,
  `${GridPosition.GAMMA6},${GridPosition.GAMMA8}`,
  `${GridPosition.GAMMA7},${GridPosition.GAMMA1}`,
  `${GridPosition.GAMMA8},${GridPosition.GAMMA2}`,

  // Gamma 1-8 counter-clockwise
  `${GridPosition.GAMMA1},${GridPosition.GAMMA7}`,
  `${GridPosition.GAMMA2},${GridPosition.GAMMA8}`,
  `${GridPosition.GAMMA3},${GridPosition.GAMMA1}`,
  `${GridPosition.GAMMA4},${GridPosition.GAMMA2}`,
  `${GridPosition.GAMMA5},${GridPosition.GAMMA3}`,
  `${GridPosition.GAMMA6},${GridPosition.GAMMA4}`,
  `${GridPosition.GAMMA7},${GridPosition.GAMMA5}`,
  `${GridPosition.GAMMA8},${GridPosition.GAMMA6}`,

  // Gamma 9-16 clockwise
  `${GridPosition.GAMMA9},${GridPosition.GAMMA11}`,
  `${GridPosition.GAMMA10},${GridPosition.GAMMA12}`,
  `${GridPosition.GAMMA11},${GridPosition.GAMMA13}`,
  `${GridPosition.GAMMA12},${GridPosition.GAMMA14}`,
  `${GridPosition.GAMMA13},${GridPosition.GAMMA15}`,
  `${GridPosition.GAMMA14},${GridPosition.GAMMA16}`,
  `${GridPosition.GAMMA15},${GridPosition.GAMMA9}`,
  `${GridPosition.GAMMA16},${GridPosition.GAMMA10}`,

  // Gamma 9-16 counter-clockwise
  `${GridPosition.GAMMA9},${GridPosition.GAMMA15}`,
  `${GridPosition.GAMMA10},${GridPosition.GAMMA16}`,
  `${GridPosition.GAMMA11},${GridPosition.GAMMA9}`,
  `${GridPosition.GAMMA12},${GridPosition.GAMMA10}`,
  `${GridPosition.GAMMA13},${GridPosition.GAMMA11}`,
  `${GridPosition.GAMMA14},${GridPosition.GAMMA12}`,
  `${GridPosition.GAMMA15},${GridPosition.GAMMA13}`,
  `${GridPosition.GAMMA16},${GridPosition.GAMMA14}`,
]);

/**
 * Location Rotation Maps
 */

import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Eighth location rotation map - 45° clockwise rotation
 * Rotates locations by one position: N → NE → E → SE → S → SW → W → NW → N
 * This is the correct rotation for sequence transformation (toggles DIAMOND ↔ BOX)
 */
export const LOCATION_MAP_EIGHTH_CW: Record<GridLocation, GridLocation> = {
  [GridLocation.NORTH]: GridLocation.NORTHEAST,
  [GridLocation.NORTHEAST]: GridLocation.EAST,
  [GridLocation.EAST]: GridLocation.SOUTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.SOUTH,
  [GridLocation.SOUTH]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.WEST,
  [GridLocation.WEST]: GridLocation.NORTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.NORTH,
  [GridLocation.CENTER]: GridLocation.CENTER,
};

/**
 * Clockwise location rotation map
 * Rotates locations 90° clockwise: S → W → N → E → S
 */
export const LOCATION_MAP_CLOCKWISE: Record<GridLocation, GridLocation> = {
  [GridLocation.SOUTH]: GridLocation.WEST,
  [GridLocation.WEST]: GridLocation.NORTH,
  [GridLocation.NORTH]: GridLocation.EAST,
  [GridLocation.EAST]: GridLocation.SOUTH,

  [GridLocation.NORTHEAST]: GridLocation.SOUTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.NORTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.NORTHEAST,
  [GridLocation.CENTER]: GridLocation.CENTER,
};

/**
 * Counter-clockwise location rotation map
 * Rotates locations 90° counter-clockwise: S → E → N → W → S
 */
export const LOCATION_MAP_COUNTER_CLOCKWISE: Record<
  GridLocation,
  GridLocation
> = {
  [GridLocation.SOUTH]: GridLocation.EAST,
  [GridLocation.EAST]: GridLocation.NORTH,
  [GridLocation.NORTH]: GridLocation.WEST,
  [GridLocation.WEST]: GridLocation.SOUTH,

  [GridLocation.NORTHEAST]: GridLocation.NORTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.SOUTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.NORTHEAST,
  [GridLocation.CENTER]: GridLocation.CENTER,
};

/**
 * Dash location rotation map
 * Flips locations to opposite: S ↔ N, E ↔ W
 */
export const LOCATION_MAP_DASH: Record<GridLocation, GridLocation> = {
  [GridLocation.SOUTH]: GridLocation.NORTH,
  [GridLocation.NORTH]: GridLocation.SOUTH,
  [GridLocation.WEST]: GridLocation.EAST,
  [GridLocation.EAST]: GridLocation.WEST,

  [GridLocation.NORTHEAST]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHEAST]: GridLocation.NORTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.NORTHEAST,
  [GridLocation.NORTHWEST]: GridLocation.SOUTHEAST,
  [GridLocation.CENTER]: GridLocation.CENTER,
};

/**
 * Static location rotation map
 * Locations stay in place (no rotation)
 */
export const LOCATION_MAP_STATIC: Record<GridLocation, GridLocation> = {
  [GridLocation.SOUTH]: GridLocation.SOUTH,
  [GridLocation.NORTH]: GridLocation.NORTH,
  [GridLocation.WEST]: GridLocation.WEST,
  [GridLocation.EAST]: GridLocation.EAST,

  [GridLocation.NORTHEAST]: GridLocation.NORTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.SOUTHEAST,
  [GridLocation.SOUTHWEST]: GridLocation.SOUTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.NORTHWEST,
  [GridLocation.CENTER]: GridLocation.CENTER,
};

/**
 * Hand rotation direction map
 * Maps (startLocation, endLocation) tuples to rotation direction
 */
export const HAND_ROTATION_DIRECTION_MAP = new Map<
  string,
  RotationDirection | "dash" | "static"
>([
  // Clockwise cardinal rotations
  [`${GridLocation.SOUTH},${GridLocation.WEST}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.WEST},${GridLocation.NORTH}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.NORTH},${GridLocation.EAST}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.EAST},${GridLocation.SOUTH}`, RotationDirection.CLOCKWISE],

  // Counter-clockwise cardinal rotations
  [
    `${GridLocation.WEST},${GridLocation.SOUTH}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],
  [
    `${GridLocation.NORTH},${GridLocation.WEST}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],
  [
    `${GridLocation.EAST},${GridLocation.NORTH}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],
  [
    `${GridLocation.SOUTH},${GridLocation.EAST}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],

  // Dash (opposite) movements
  [`${GridLocation.SOUTH},${GridLocation.NORTH}`, "dash"],
  [`${GridLocation.WEST},${GridLocation.EAST}`, "dash"],
  [`${GridLocation.NORTH},${GridLocation.SOUTH}`, "dash"],
  [`${GridLocation.EAST},${GridLocation.WEST}`, "dash"],

  // Static (no movement)
  [`${GridLocation.NORTH},${GridLocation.NORTH}`, "static"],
  [`${GridLocation.EAST},${GridLocation.EAST}`, "static"],
  [`${GridLocation.SOUTH},${GridLocation.SOUTH}`, "static"],
  [`${GridLocation.WEST},${GridLocation.WEST}`, "static"],

  // Clockwise diagonal rotations
  [
    `${GridLocation.NORTHEAST},${GridLocation.SOUTHEAST}`,
    RotationDirection.CLOCKWISE,
  ],
  [
    `${GridLocation.SOUTHEAST},${GridLocation.SOUTHWEST}`,
    RotationDirection.CLOCKWISE,
  ],
  [
    `${GridLocation.SOUTHWEST},${GridLocation.NORTHWEST}`,
    RotationDirection.CLOCKWISE,
  ],
  [
    `${GridLocation.NORTHWEST},${GridLocation.NORTHEAST}`,
    RotationDirection.CLOCKWISE,
  ],

  // Counter-clockwise diagonal rotations
  [
    `${GridLocation.NORTHEAST},${GridLocation.NORTHWEST}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],
  [
    `${GridLocation.NORTHWEST},${GridLocation.SOUTHWEST}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],
  [
    `${GridLocation.SOUTHWEST},${GridLocation.SOUTHEAST}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],
  [
    `${GridLocation.SOUTHEAST},${GridLocation.NORTHEAST}`,
    RotationDirection.COUNTER_CLOCKWISE,
  ],

  // Dash diagonal movements
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`, "dash"],
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`, "dash"],
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`, "dash"],
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`, "dash"],

  // Static diagonal (no movement)
  [`${GridLocation.NORTHEAST},${GridLocation.NORTHEAST}`, "static"],
  [`${GridLocation.SOUTHEAST},${GridLocation.SOUTHEAST}`, "static"],
  [`${GridLocation.SOUTHWEST},${GridLocation.SOUTHWEST}`, "static"],
  [`${GridLocation.NORTHWEST},${GridLocation.NORTHWEST}`, "static"],
]);

/**
 * Determine hand rotation direction based on start and end locations
 */
export function getHandRotationDirection(
  startLocation: GridLocation,
  endLocation: GridLocation
): RotationDirection | "dash" | "static" {
  const key = `${startLocation},${endLocation}`;
  const direction = HAND_ROTATION_DIRECTION_MAP.get(key);

  if (!direction) {
    throw new Error(
      `No hand rotation direction found for movement from ${startLocation} to ${endLocation}`
    );
  }

  return direction;
}

/**
 * Get location map for hand rotation
 */
export function getLocationMapForHandRotation(
  handRotationDir: RotationDirection | "dash" | "static"
): Record<GridLocation, GridLocation> {
  switch (handRotationDir) {
    case RotationDirection.CLOCKWISE:
      return LOCATION_MAP_CLOCKWISE;
    case RotationDirection.COUNTER_CLOCKWISE:
      return LOCATION_MAP_COUNTER_CLOCKWISE;
    case "dash":
      return LOCATION_MAP_DASH;
    case "static":
      return LOCATION_MAP_STATIC;
    default:
      throw new Error(`Unknown hand rotation direction: ${handRotationDir}`);
  }
}
