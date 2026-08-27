/**
 * Position and Location Maps for Strict LOOP Variations
 *
 * These maps define transformations for:
 * - MIRRORED: Vertical mirroring of positions and locations
 * - SWAPPED: Color swapping position transformations
 * - INVERTED: Letter inversion mappings
 *
 * Note: ROTATED uses different maps defined in circular-position-maps.ts
 */

import {
  GridPosition,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Vertical Mirror Position Map
 * Mirrors positions vertically across the center horizontal axis
 * Used by MIRRORED LOOP type
 *
 * Examples:
 * - ALPHA2 (SW-NE) ↔ ALPHA8 (SE-NW) - diagonals flip
 * - ALPHA3 (W-E) ↔ ALPHA7 (E-W) - horizontals swap
 * - ALPHA1 (S-N) → ALPHA1 - vertical stays same
 * - GAMMA1 (W-N) ↔ GAMMA9 (E-N) - gammas cross-mirror
 */
export const VERTICAL_MIRROR_POSITION_MAP: Record<GridPosition, GridPosition> = {
  // Alpha group - vertical axis symmetry
  [GridPosition.ALPHA1]: GridPosition.ALPHA1, // S-N → S-N (on axis)
  [GridPosition.ALPHA2]: GridPosition.ALPHA8, // SW-NE → SE-NW
  [GridPosition.ALPHA3]: GridPosition.ALPHA7, // W-E → E-W
  [GridPosition.ALPHA4]: GridPosition.ALPHA6, // NW-SE → NE-SW
  [GridPosition.ALPHA5]: GridPosition.ALPHA5, // N-S → N-S (on axis)
  [GridPosition.ALPHA6]: GridPosition.ALPHA4, // NE-SW → NW-SE
  [GridPosition.ALPHA7]: GridPosition.ALPHA3, // E-W → W-E
  [GridPosition.ALPHA8]: GridPosition.ALPHA2, // SE-NW → SW-NE

  // Beta group - same sides stay same
  [GridPosition.BETA1]: GridPosition.BETA1, // N-N → N-N (on axis)
  [GridPosition.BETA2]: GridPosition.BETA8, // NE-NE → NW-NW
  [GridPosition.BETA3]: GridPosition.BETA7, // E-E → W-W
  [GridPosition.BETA4]: GridPosition.BETA6, // SE-SE → SW-SW
  [GridPosition.BETA5]: GridPosition.BETA5, // S-S → S-S (on axis)
  [GridPosition.BETA6]: GridPosition.BETA4, // SW-SW → SE-SE
  [GridPosition.BETA7]: GridPosition.BETA3, // W-W → E-E
  [GridPosition.BETA8]: GridPosition.BETA2, // NW-NW → NE-NE

  // Gamma group - cross-mirror pattern
  [GridPosition.GAMMA1]: GridPosition.GAMMA9, // W-N ↔ E-N
  [GridPosition.GAMMA2]: GridPosition.GAMMA16, // NW-NE ↔ NE-NW
  [GridPosition.GAMMA3]: GridPosition.GAMMA15, // N-E ↔ N-W
  [GridPosition.GAMMA4]: GridPosition.GAMMA14, // NE-SE ↔ NW-SW
  [GridPosition.GAMMA5]: GridPosition.GAMMA13, // E-S ↔ W-S
  [GridPosition.GAMMA6]: GridPosition.GAMMA12, // SE-SW ↔ SW-SE
  [GridPosition.GAMMA7]: GridPosition.GAMMA11, // S-W ↔ S-E
  [GridPosition.GAMMA8]: GridPosition.GAMMA10, // SW-NW ↔ SE-NE
  [GridPosition.GAMMA9]: GridPosition.GAMMA1, // E-N ↔ W-N
  [GridPosition.GAMMA10]: GridPosition.GAMMA8, // SE-NE ↔ SW-NW
  [GridPosition.GAMMA11]: GridPosition.GAMMA7, // S-E ↔ S-W
  [GridPosition.GAMMA12]: GridPosition.GAMMA6, // SW-SE ↔ SE-SW
  [GridPosition.GAMMA13]: GridPosition.GAMMA5, // W-S ↔ E-S
  [GridPosition.GAMMA14]: GridPosition.GAMMA4, // NW-SW ↔ NE-SE
  [GridPosition.GAMMA15]: GridPosition.GAMMA3, // N-W ↔ N-E
  [GridPosition.GAMMA16]: GridPosition.GAMMA2, // NE-NW ↔ NW-NE

  // Zeta 1-8 ↔ Zeta 9-16 swap (vertical mirror flips E↔W)
  [GridPosition.ZETA1]: GridPosition.ZETA9, // SW-N → SE-N
  [GridPosition.ZETA2]: GridPosition.ZETA16, // W-NE → E-NW
  [GridPosition.ZETA3]: GridPosition.ZETA15, // NW-E → NE-W
  [GridPosition.ZETA4]: GridPosition.ZETA14, // N-SE → N-SW
  [GridPosition.ZETA5]: GridPosition.ZETA13, // NE-S → NW-S
  [GridPosition.ZETA6]: GridPosition.ZETA12, // E-SW → W-SE
  [GridPosition.ZETA7]: GridPosition.ZETA11, // SE-W → SW-E
  [GridPosition.ZETA8]: GridPosition.ZETA10, // S-NW → S-NE
  [GridPosition.ZETA9]: GridPosition.ZETA1, // SE-N → SW-N
  [GridPosition.ZETA10]: GridPosition.ZETA8, // S-NE → S-NW
  [GridPosition.ZETA11]: GridPosition.ZETA7, // SW-E → SE-W
  [GridPosition.ZETA12]: GridPosition.ZETA6, // W-SE → E-SW
  [GridPosition.ZETA13]: GridPosition.ZETA5, // NW-S → NE-S
  [GridPosition.ZETA14]: GridPosition.ZETA4, // N-SW → N-SE
  [GridPosition.ZETA15]: GridPosition.ZETA3, // NE-W → NW-E
  [GridPosition.ZETA16]: GridPosition.ZETA2, // E-NW → W-NE

  // Eta 1-8 ↔ Eta 9-16 swap (vertical mirror flips E↔W)
  [GridPosition.ETA1]: GridPosition.ETA9, // NW-N → NE-N
  [GridPosition.ETA2]: GridPosition.ETA16, // N-NE → N-NW
  [GridPosition.ETA3]: GridPosition.ETA15, // NE-E → NW-W
  [GridPosition.ETA4]: GridPosition.ETA14, // E-SE → W-SW
  [GridPosition.ETA5]: GridPosition.ETA13, // SE-S → SW-S
  [GridPosition.ETA6]: GridPosition.ETA12, // S-SW → S-SE
  [GridPosition.ETA7]: GridPosition.ETA11, // SW-W → SE-E
  [GridPosition.ETA8]: GridPosition.ETA10, // W-NW → E-NE
  [GridPosition.ETA9]: GridPosition.ETA1, // NE-N → NW-N
  [GridPosition.ETA10]: GridPosition.ETA8, // E-NE → W-NW
  [GridPosition.ETA11]: GridPosition.ETA7, // SE-E → SW-W
  [GridPosition.ETA12]: GridPosition.ETA6, // S-SE → S-SW
  [GridPosition.ETA13]: GridPosition.ETA5, // SW-S → SE-S
  [GridPosition.ETA14]: GridPosition.ETA4, // W-SW → E-SE
  [GridPosition.ETA15]: GridPosition.ETA3, // NW-W → NE-E
  [GridPosition.ETA16]: GridPosition.ETA2, // N-NW → N-NE

  // Tau and Terra positions - Level 6 (centric mode)
  // TODO: Implement proper mirror logic when Level 6 is fully specified
  [GridPosition.TAU1]: GridPosition.TAU1,
  [GridPosition.TAU2]: GridPosition.TAU2,
  [GridPosition.TAU3]: GridPosition.TAU3,
  [GridPosition.TAU4]: GridPosition.TAU4,
  [GridPosition.TAU5]: GridPosition.TAU5,
  [GridPosition.TAU6]: GridPosition.TAU6,
  [GridPosition.TAU7]: GridPosition.TAU7,
  [GridPosition.TAU8]: GridPosition.TAU8,
  [GridPosition.TAU9]: GridPosition.TAU9,
  [GridPosition.TAU10]: GridPosition.TAU10,
  [GridPosition.TAU11]: GridPosition.TAU11,
  [GridPosition.TAU12]: GridPosition.TAU12,
  [GridPosition.TAU13]: GridPosition.TAU13,
  [GridPosition.TAU14]: GridPosition.TAU14,
  [GridPosition.TAU15]: GridPosition.TAU15,
  [GridPosition.TAU16]: GridPosition.TAU16,
  [GridPosition.TERRA1]: GridPosition.TERRA1,
};

/**
 * Vertical Mirror Location Map
 * Mirrors hand locations vertically (flips east/west)
 * Used by MIRRORED for transforming motion end locations
 *
 * Examples:
 * - E (east) ↔ W (west)
 * - NE (northeast) ↔ NW (northwest)
 * - N (north) → N (stays on vertical axis)
 * - S (south) → S (stays on vertical axis)
 */
export const VERTICAL_MIRROR_LOCATION_MAP: Record<GridLocation, GridLocation> =
  {
    [GridLocation.NORTH]: GridLocation.NORTH, // On axis - no change
    [GridLocation.SOUTH]: GridLocation.SOUTH, // On axis - no change
    [GridLocation.EAST]: GridLocation.WEST, // Flip east/west
    [GridLocation.WEST]: GridLocation.EAST, // Flip west/east
    [GridLocation.NORTHEAST]: GridLocation.NORTHWEST, // Flip NE/NW
    [GridLocation.NORTHWEST]: GridLocation.NORTHEAST, // Flip NW/NE
    [GridLocation.SOUTHEAST]: GridLocation.SOUTHWEST, // Flip SE/SW
    [GridLocation.SOUTHWEST]: GridLocation.SOUTHEAST, // Flip SW/SE
    [GridLocation.CENTER]: GridLocation.CENTER, // Center stays at center
  };

/**
 * Horizontal Mirror Position Map
 * Mirrors positions horizontally (flips north/south)
 * Used for the Flip transform
 *
 * Examples:
 * - ALPHA1 (S-N) ↔ ALPHA5 (N-S) - verticals flip
 * - ALPHA3 (W-E) → ALPHA3 (W-E) - horizontals stay same
 * - GAMMA1 (W-N) ↔ GAMMA13 (W-S) - north becomes south
 */
export const HORIZONTAL_MIRROR_POSITION_MAP: Record<GridPosition, GridPosition> =
  {
    // Alpha group - horizontal axis symmetry
    [GridPosition.ALPHA1]: GridPosition.ALPHA5, // S-N ↔ N-S
    [GridPosition.ALPHA2]: GridPosition.ALPHA4, // SW-NE ↔ NW-SE
    [GridPosition.ALPHA3]: GridPosition.ALPHA3, // W-E → W-E (on axis)
    [GridPosition.ALPHA4]: GridPosition.ALPHA2, // NW-SE ↔ SW-NE
    [GridPosition.ALPHA5]: GridPosition.ALPHA1, // N-S ↔ S-N
    [GridPosition.ALPHA6]: GridPosition.ALPHA8, // NE-SW ↔ SE-NW
    [GridPosition.ALPHA7]: GridPosition.ALPHA7, // E-W → E-W (on axis)
    [GridPosition.ALPHA8]: GridPosition.ALPHA6, // SE-NW ↔ NE-SW

    // Beta group - north/south pairs swap
    [GridPosition.BETA1]: GridPosition.BETA5, // N-N ↔ S-S
    [GridPosition.BETA2]: GridPosition.BETA4, // NE-NE ↔ SE-SE
    [GridPosition.BETA3]: GridPosition.BETA3, // E-E → E-E (on axis)
    [GridPosition.BETA4]: GridPosition.BETA2, // SE-SE ↔ NE-NE
    [GridPosition.BETA5]: GridPosition.BETA1, // S-S ↔ N-N
    [GridPosition.BETA6]: GridPosition.BETA8, // SW-SW ↔ NW-NW
    [GridPosition.BETA7]: GridPosition.BETA7, // W-W → W-W (on axis)
    [GridPosition.BETA8]: GridPosition.BETA6, // NW-NW ↔ SW-SW

    // Gamma group - north/south flip pattern
    [GridPosition.GAMMA1]: GridPosition.GAMMA13, // W-N ↔ W-S
    [GridPosition.GAMMA2]: GridPosition.GAMMA12, // NW-NE ↔ SW-SE
    [GridPosition.GAMMA3]: GridPosition.GAMMA11, // N-E ↔ S-E
    [GridPosition.GAMMA4]: GridPosition.GAMMA10, // NE-SE ↔ SE-NE
    [GridPosition.GAMMA5]: GridPosition.GAMMA9, // E-S ↔ E-N
    [GridPosition.GAMMA6]: GridPosition.GAMMA16, // SE-SW ↔ NE-NW
    [GridPosition.GAMMA7]: GridPosition.GAMMA15, // S-W ↔ N-W
    [GridPosition.GAMMA8]: GridPosition.GAMMA14, // SW-NW ↔ NW-SW
    [GridPosition.GAMMA9]: GridPosition.GAMMA5, // E-N ↔ E-S
    [GridPosition.GAMMA10]: GridPosition.GAMMA4, // SE-NE ↔ NE-SE
    [GridPosition.GAMMA11]: GridPosition.GAMMA3, // S-E ↔ N-E
    [GridPosition.GAMMA12]: GridPosition.GAMMA2, // SW-SE ↔ NW-NE
    [GridPosition.GAMMA13]: GridPosition.GAMMA1, // W-S ↔ W-N
    [GridPosition.GAMMA14]: GridPosition.GAMMA8, // NW-SW ↔ SW-NW
    [GridPosition.GAMMA15]: GridPosition.GAMMA7, // N-W ↔ S-W
    [GridPosition.GAMMA16]: GridPosition.GAMMA6, // NE-NW ↔ SE-SW

    // Zeta group - horizontal mirror flips N↔S
    [GridPosition.ZETA1]: GridPosition.ZETA13, // SW-N → NW-S
    [GridPosition.ZETA2]: GridPosition.ZETA12, // W-NE → W-SE
    [GridPosition.ZETA3]: GridPosition.ZETA11, // NW-E → SW-E
    [GridPosition.ZETA4]: GridPosition.ZETA10, // N-SE → S-NE
    [GridPosition.ZETA5]: GridPosition.ZETA9, // NE-S → SE-N
    [GridPosition.ZETA6]: GridPosition.ZETA16, // E-SW → E-NW
    [GridPosition.ZETA7]: GridPosition.ZETA15, // SE-W → NE-W
    [GridPosition.ZETA8]: GridPosition.ZETA14, // S-NW → N-SW
    [GridPosition.ZETA9]: GridPosition.ZETA5, // SE-N → NE-S
    [GridPosition.ZETA10]: GridPosition.ZETA4, // S-NE → N-SE
    [GridPosition.ZETA11]: GridPosition.ZETA3, // SW-E → NW-E
    [GridPosition.ZETA12]: GridPosition.ZETA2, // W-SE → W-NE
    [GridPosition.ZETA13]: GridPosition.ZETA1, // NW-S → SW-N
    [GridPosition.ZETA14]: GridPosition.ZETA8, // N-SW → S-NW
    [GridPosition.ZETA15]: GridPosition.ZETA7, // NE-W → SE-W
    [GridPosition.ZETA16]: GridPosition.ZETA6, // E-NW → E-SW

    // Eta group - horizontal mirror flips N↔S
    [GridPosition.ETA1]: GridPosition.ETA13, // NW-N → SW-S
    [GridPosition.ETA2]: GridPosition.ETA12, // N-NE → S-SE
    [GridPosition.ETA3]: GridPosition.ETA11, // NE-E → SE-E
    [GridPosition.ETA4]: GridPosition.ETA10, // E-SE → E-NE
    [GridPosition.ETA5]: GridPosition.ETA9, // SE-S → NE-N
    [GridPosition.ETA6]: GridPosition.ETA16, // S-SW → N-NW
    [GridPosition.ETA7]: GridPosition.ETA15, // SW-W → NW-W
    [GridPosition.ETA8]: GridPosition.ETA14, // W-NW → W-SW
    [GridPosition.ETA9]: GridPosition.ETA5, // NE-N → SE-S
    [GridPosition.ETA10]: GridPosition.ETA4, // E-NE → E-SE
    [GridPosition.ETA11]: GridPosition.ETA3, // SE-E → NE-E
    [GridPosition.ETA12]: GridPosition.ETA2, // S-SE → N-NE
    [GridPosition.ETA13]: GridPosition.ETA1, // SW-S → NW-N
    [GridPosition.ETA14]: GridPosition.ETA8, // W-SW → W-NW
    [GridPosition.ETA15]: GridPosition.ETA7, // NW-W → SW-W
    [GridPosition.ETA16]: GridPosition.ETA6, // N-NW → S-SW

    // Tau and Terra positions - Level 6 (centric mode)
    // TODO: Implement proper horizontal mirror logic when Level 6 is fully specified
    [GridPosition.TAU1]: GridPosition.TAU1,
    [GridPosition.TAU2]: GridPosition.TAU2,
    [GridPosition.TAU3]: GridPosition.TAU3,
    [GridPosition.TAU4]: GridPosition.TAU4,
    [GridPosition.TAU5]: GridPosition.TAU5,
    [GridPosition.TAU6]: GridPosition.TAU6,
    [GridPosition.TAU7]: GridPosition.TAU7,
    [GridPosition.TAU8]: GridPosition.TAU8,
    [GridPosition.TAU9]: GridPosition.TAU9,
    [GridPosition.TAU10]: GridPosition.TAU10,
    [GridPosition.TAU11]: GridPosition.TAU11,
    [GridPosition.TAU12]: GridPosition.TAU12,
    [GridPosition.TAU13]: GridPosition.TAU13,
    [GridPosition.TAU14]: GridPosition.TAU14,
    [GridPosition.TAU15]: GridPosition.TAU15,
    [GridPosition.TAU16]: GridPosition.TAU16,
    [GridPosition.TERRA1]: GridPosition.TERRA1,
  };

/**
 * Horizontal Mirror Location Map
 * Mirrors hand locations horizontally (flips north/south)
 * Used for the Flip transform
 *
 * Examples:
 * - N (north) ↔ S (south)
 * - NE (northeast) ↔ SE (southeast)
 * - E (east) → E (stays on horizontal axis)
 * - W (west) → W (stays on horizontal axis)
 */
export const HORIZONTAL_MIRROR_LOCATION_MAP: Record<
  GridLocation,
  GridLocation
> = {
  [GridLocation.NORTH]: GridLocation.SOUTH, // Flip north/south
  [GridLocation.SOUTH]: GridLocation.NORTH, // Flip south/north
  [GridLocation.EAST]: GridLocation.EAST, // On axis - no change
  [GridLocation.WEST]: GridLocation.WEST, // On axis - no change
  [GridLocation.NORTHEAST]: GridLocation.SOUTHEAST, // Flip NE/SE
  [GridLocation.SOUTHEAST]: GridLocation.NORTHEAST, // Flip SE/NE
  [GridLocation.NORTHWEST]: GridLocation.SOUTHWEST, // Flip NW/SW
  [GridLocation.SOUTHWEST]: GridLocation.NORTHWEST, // Flip SW/NW
  [GridLocation.CENTER]: GridLocation.CENTER, // Center stays at center
};

/**
 * Swapped Position Map
 * Maps positions to their color-swapped equivalents
 * Used by SWAPPED LOOP type
 *
 * Pattern:
 * - Alpha: 180° rotation (cross-pattern)
 * - Beta: No change (same positions stay same)
 * - Gamma: Complex cross-swap pattern
 */
export const SWAPPED_POSITION_MAP: Record<GridPosition, GridPosition> = {
  // Alpha group - 180° swap pattern
  [GridPosition.ALPHA1]: GridPosition.ALPHA5, // S-N ↔ N-S
  [GridPosition.ALPHA2]: GridPosition.ALPHA6, // SW-NE ↔ NE-SW
  [GridPosition.ALPHA3]: GridPosition.ALPHA7, // W-E ↔ E-W
  [GridPosition.ALPHA4]: GridPosition.ALPHA8, // NW-SE ↔ SE-NW
  [GridPosition.ALPHA5]: GridPosition.ALPHA1, // N-S ↔ S-N
  [GridPosition.ALPHA6]: GridPosition.ALPHA2, // NE-SW ↔ SW-NE
  [GridPosition.ALPHA7]: GridPosition.ALPHA3, // E-W ↔ W-E
  [GridPosition.ALPHA8]: GridPosition.ALPHA4, // SE-NW ↔ NW-SE

  // Beta group - no change (both hands same location)
  [GridPosition.BETA1]: GridPosition.BETA1, // N-N → N-N
  [GridPosition.BETA2]: GridPosition.BETA2, // NE-NE → NE-NE
  [GridPosition.BETA3]: GridPosition.BETA3, // E-E → E-E
  [GridPosition.BETA4]: GridPosition.BETA4, // SE-SE → SE-SE
  [GridPosition.BETA5]: GridPosition.BETA5, // S-S → S-S
  [GridPosition.BETA6]: GridPosition.BETA6, // SW-SW → SW-SW
  [GridPosition.BETA7]: GridPosition.BETA7, // W-W → W-W
  [GridPosition.BETA8]: GridPosition.BETA8, // NW-NW → NW-NW

  // Gamma group - cross-swap pattern
  [GridPosition.GAMMA1]: GridPosition.GAMMA15, // W-N ↔ N-W
  [GridPosition.GAMMA2]: GridPosition.GAMMA16, // NW-NE ↔ NE-NW
  [GridPosition.GAMMA3]: GridPosition.GAMMA9, // N-E ↔ E-N
  [GridPosition.GAMMA4]: GridPosition.GAMMA10, // NE-SE ↔ SE-NE
  [GridPosition.GAMMA5]: GridPosition.GAMMA11, // E-S ↔ S-E
  [GridPosition.GAMMA6]: GridPosition.GAMMA12, // SE-SW ↔ SW-SE
  [GridPosition.GAMMA7]: GridPosition.GAMMA13, // S-W ↔ W-S
  [GridPosition.GAMMA8]: GridPosition.GAMMA14, // SW-NW ↔ NW-SW
  [GridPosition.GAMMA9]: GridPosition.GAMMA3, // E-N ↔ N-E
  [GridPosition.GAMMA10]: GridPosition.GAMMA4, // SE-NE ↔ NE-SE
  [GridPosition.GAMMA11]: GridPosition.GAMMA5, // S-E ↔ E-S
  [GridPosition.GAMMA12]: GridPosition.GAMMA6, // SW-SE ↔ SE-SW
  [GridPosition.GAMMA13]: GridPosition.GAMMA7, // W-S ↔ S-W
  [GridPosition.GAMMA14]: GridPosition.GAMMA8, // NW-SW ↔ SW-NW
  [GridPosition.GAMMA15]: GridPosition.GAMMA1, // N-W ↔ W-N
  [GridPosition.GAMMA16]: GridPosition.GAMMA2, // NE-NW ↔ NW-NE

  // Zeta group - swap Blue↔Red locations
  // Zeta 1-8: Blue 135° CCW from Red → after swap → Red at old Blue, Blue at old Red → Zeta 9-16 pattern
  [GridPosition.ZETA1]: GridPosition.ZETA14, // (Red=N, Blue=SW) → (Red=SW, Blue=N)
  [GridPosition.ZETA2]: GridPosition.ZETA15, // (Red=NE, Blue=W) → (Red=W, Blue=NE)
  [GridPosition.ZETA3]: GridPosition.ZETA16, // (Red=E, Blue=NW) → (Red=NW, Blue=E)
  [GridPosition.ZETA4]: GridPosition.ZETA9, // (Red=SE, Blue=N) → (Red=N, Blue=SE)
  [GridPosition.ZETA5]: GridPosition.ZETA10, // (Red=S, Blue=NE) → (Red=NE, Blue=S)
  [GridPosition.ZETA6]: GridPosition.ZETA11, // (Red=SW, Blue=E) → (Red=E, Blue=SW)
  [GridPosition.ZETA7]: GridPosition.ZETA12, // (Red=W, Blue=SE) → (Red=SE, Blue=W)
  [GridPosition.ZETA8]: GridPosition.ZETA13, // (Red=NW, Blue=S) → (Red=S, Blue=NW)
  // Zeta 9-16: Blue 135° CW from Red → after swap → Zeta 1-8 pattern
  [GridPosition.ZETA9]: GridPosition.ZETA4, // (Red=N, Blue=SE) → (Red=SE, Blue=N)
  [GridPosition.ZETA10]: GridPosition.ZETA5, // (Red=NE, Blue=S) → (Red=S, Blue=NE)
  [GridPosition.ZETA11]: GridPosition.ZETA6, // (Red=E, Blue=SW) → (Red=SW, Blue=E)
  [GridPosition.ZETA12]: GridPosition.ZETA7, // (Red=SE, Blue=W) → (Red=W, Blue=SE)
  [GridPosition.ZETA13]: GridPosition.ZETA8, // (Red=S, Blue=NW) → (Red=NW, Blue=S)
  [GridPosition.ZETA14]: GridPosition.ZETA1, // (Red=SW, Blue=N) → (Red=N, Blue=SW)
  [GridPosition.ZETA15]: GridPosition.ZETA2, // (Red=W, Blue=NE) → (Red=NE, Blue=W)
  [GridPosition.ZETA16]: GridPosition.ZETA3, // (Red=NW, Blue=E) → (Red=E, Blue=NW)

  // Eta group - swap Blue↔Red locations
  // Eta 1-8: Blue 45° CCW from Red → after swap → Eta 9-16 pattern
  [GridPosition.ETA1]: GridPosition.ETA16, // (Red=N, Blue=NW) → (Red=NW, Blue=N)
  [GridPosition.ETA2]: GridPosition.ETA9, // (Red=NE, Blue=N) → (Red=N, Blue=NE)
  [GridPosition.ETA3]: GridPosition.ETA10, // (Red=E, Blue=NE) → (Red=NE, Blue=E)
  [GridPosition.ETA4]: GridPosition.ETA11, // (Red=SE, Blue=E) → (Red=E, Blue=SE)
  [GridPosition.ETA5]: GridPosition.ETA12, // (Red=S, Blue=SE) → (Red=SE, Blue=S)
  [GridPosition.ETA6]: GridPosition.ETA13, // (Red=SW, Blue=S) → (Red=S, Blue=SW)
  [GridPosition.ETA7]: GridPosition.ETA14, // (Red=W, Blue=SW) → (Red=SW, Blue=W)
  [GridPosition.ETA8]: GridPosition.ETA15, // (Red=NW, Blue=W) → (Red=W, Blue=NW)
  // Eta 9-16: Blue 45° CW from Red → after swap → Eta 1-8 pattern
  [GridPosition.ETA9]: GridPosition.ETA2, // (Red=N, Blue=NE) → (Red=NE, Blue=N)
  [GridPosition.ETA10]: GridPosition.ETA3, // (Red=NE, Blue=E) → (Red=E, Blue=NE)
  [GridPosition.ETA11]: GridPosition.ETA4, // (Red=E, Blue=SE) → (Red=SE, Blue=E)
  [GridPosition.ETA12]: GridPosition.ETA5, // (Red=SE, Blue=S) → (Red=S, Blue=SE)
  [GridPosition.ETA13]: GridPosition.ETA6, // (Red=S, Blue=SW) → (Red=SW, Blue=S)
  [GridPosition.ETA14]: GridPosition.ETA7, // (Red=SW, Blue=W) → (Red=W, Blue=SW)
  [GridPosition.ETA15]: GridPosition.ETA8, // (Red=W, Blue=NW) → (Red=NW, Blue=W)
  [GridPosition.ETA16]: GridPosition.ETA1, // (Red=NW, Blue=N) → (Red=N, Blue=NW)

  // Tau positions - swap center and perimeter hands
  // TAU1-8 (blue at center, red at perimeter) ↔ TAU9-16 (red at center, blue at perimeter)
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

  // Terra - both at center, stays the same
  [GridPosition.TERRA1]: GridPosition.TERRA1,
};

/**
 * Inverted Letter Map
 * Maps letters to their inverted pairs (opposite motion types)
 * Used by INVERTED LOOP type
 *
 * Pattern:
 * - Most letters pair with adjacent letter (A↔B, D↔E, etc.)
 * - Some letters are self-inverted (C, F, I, etc.)
 * - Greek letters follow similar pairing rules
 */
export const INVERTED_LETTER_MAP: Record<string, string> = {
  // Basic alphabet pairs
  A: "B",
  B: "A",
  C: "C", // Self-inverted
  D: "E",
  E: "D",
  F: "F", // Self-inverted
  G: "H",
  H: "G",
  I: "I", // Self-inverted
  J: "K",
  K: "J",
  L: "L", // Self-inverted
  M: "N",
  N: "M",
  O: "O", // Self-inverted
  P: "Q",
  Q: "P",
  R: "R", // Self-inverted
  S: "T",
  T: "S",
  U: "V",
  V: "U",
  W: "X",
  X: "W",
  Y: "Z",
  Z: "Y",

  // Greek letters
  Σ: "Δ",
  Δ: "Σ",
  Θ: "Ω",
  Ω: "Θ",
  Φ: "Φ", // Self-inverted
  Ψ: "Ψ", // Self-inverted
  Λ: "Λ", // Self-inverted
  α: "α", // Self-inverted
  β: "β", // Self-inverted
  γ: "γ", // Self-inverted

  // Type 2: Centric shifts (Mu ↔ Nu pair)
  μ: "ν",
  ν: "μ",

  // Type 4: Tau-dash (self-inverted)
  "τ-": "τ-",

  // Type 6: Additional static letters (all self-inverted)
  ζ: "ζ",
  η: "η",
  τ: "τ",
  "⊕": "⊕",

  // Dash variations
  "W-": "X-",
  "X-": "W-",
  "Y-": "Z-",
  "Z-": "Y-",
  "Σ-": "Δ-",
  "Δ-": "Σ-",
  "Θ-": "Ω-",
  "Ω-": "Θ-",
  "Φ-": "Φ-", // Self-inverted
  "Ψ-": "Ψ-", // Self-inverted
  "Λ-": "Λ-", // Self-inverted
};

/**
 * Get inverted letter for a given letter
 * @throws Error if letter not found in map
 */
export function getInvertedLetter(letter: string): string {
  const inverted = INVERTED_LETTER_MAP[letter];

  if (!inverted) {
    throw new Error(`No inverted letter mapping found for letter: ${letter}`);
  }

  return inverted;
}

/**
 * Alpha-Beta Counterpart Letter Map
 * Maps letters that share a common gamma endpoint but differ in the other section (α↔β).
 * Also called "Cross-Section Complementary" relationships.
 *
 * Pattern:
 * - Letters ending at gamma from different origins: Σ↔Θ (α→γ ↔ β→γ), Δ↔Ω (α→γ ↔ β→γ)
 * - Letters starting from gamma to different destinations: W↔Y (γ→α ↔ γ→β), X↔Z (γ→α ↔ γ→β)
 *
 * This differs from standard inversion (pro↔anti) - these pairs share the same rotation
 * but swap their alpha/beta relationship while both involving gamma.
 */
export const ALPHA_BETA_COUNTERPART_LETTER_MAP: Record<string, string> = {
  // Type 2 Shift letters sharing gamma endpoint
  // Origin swap (both end at gamma, start from α vs β)
  Σ: "Θ", // α→γ ↔ β→γ
  Θ: "Σ", // β→γ ↔ α→γ
  Δ: "Ω", // α→γ ↔ β→γ (anti versions)
  Ω: "Δ", // β→γ ↔ α→γ

  // Destination swap (both start at gamma, end at α vs β)
  W: "Y", // γ→α ↔ γ→β
  Y: "W", // γ→β ↔ γ→α
  X: "Z", // γ→α ↔ γ→β (anti versions)
  Z: "X", // γ→β ↔ γ→α

  // Type 3 Cross-Shift dash variants follow same pattern
  "Σ-": "Θ-",
  "Θ-": "Σ-",
  "Δ-": "Ω-",
  "Ω-": "Δ-",
  "W-": "Y-",
  "Y-": "W-",
  "X-": "Z-",
  "Z-": "X-",
};

/**
 * Compound Letter Map
 * Maps letters that form compound pairs - letters that combine to create circular motion.
 * These pairs complete each other to return to starting position.
 *
 * Two categories:
 * 1. Alpha↔Beta transitions (opposite section directions)
 * 2. Gamma internal pairs (γ→γ with complementary quarter-opp motions)
 */
export const COMPOUND_LETTER_MAP: Record<string, string> = {
  // Type 1 Dual-Shift compound pairs (β↔α transitions)
  D: "J", // β→α (Tog-Opp, isolation) ↔ α→β (Split-Opp, isolation) - "Disco Jam"
  J: "D",
  E: "K", // β→α (Tog-Opp, antispin) ↔ α→β (Split-Opp, antispin) - "Exploding Kitten"
  K: "E",
  F: "L", // β→α (Tog-Opp, hybrid) ↔ α→β (Split-Opp, hybrid) - "Fruity Loops"
  L: "F",

  // Gamma internal compound pairs (γ→γ Quarter-Opp complementary motions)
  M: "P", // γ→γ isolation ↔ γ→γ isolation - "Magic Potion"
  P: "M",
  N: "Q", // γ→γ antispin ↔ γ→γ antispin - "Never Quit"
  Q: "N",
  O: "R", // γ→γ hybrid ↔ γ→γ hybrid - "Open Road"
  R: "O",

  // Type 4 Dash compound pairs (β↔α transitions via dash)
  Φ: "Ψ", // β→α (Dash) ↔ α→β (Dash)
  Ψ: "Φ",
};

/**
 * Letter Transformation Types
 * Used for algorithmic detection and generation
 */
export enum LetterTransformationType {
  INVERSION = "inversion", // Pro ↔ Anti (A↔B, Σ↔Δ)
  COMPOUND = "compound", // Section transition pairs (D↔J, M↔P)
  ALPHA_BETA_COUNTERPART = "alpha_beta_counterpart", // Gamma endpoint sharing (Σ↔Θ, W↔Y)
}

/**
 * Get alpha-beta counterpart letter for a given letter
 * Returns the letter that shares the same gamma endpoint but swaps α↔β
 */
export function getAlphaBetaCounterpart(letter: string): string | null {
  return ALPHA_BETA_COUNTERPART_LETTER_MAP[letter] ?? null;
}

/**
 * Get compound pair letter for a given letter
 * Returns the letter that forms a compound pair (α↔β transition pair or γ internal pair)
 */
export function getCompoundLetter(letter: string): string | null {
  return COMPOUND_LETTER_MAP[letter] ?? null;
}

/**
 * Check if two letters have a specific transformation relationship
 */
export function hasTransformationRelationship(
  letter1: string,
  letter2: string,
  type: LetterTransformationType
): boolean {
  switch (type) {
    case LetterTransformationType.INVERSION:
      return INVERTED_LETTER_MAP[letter1] === letter2;
    case LetterTransformationType.COMPOUND:
      return COMPOUND_LETTER_MAP[letter1] === letter2;
    case LetterTransformationType.ALPHA_BETA_COUNTERPART:
      return ALPHA_BETA_COUNTERPART_LETTER_MAP[letter1] === letter2;
    default:
      return false;
  }
}

/**
 * Get all transformation relationships between two letters
 * Returns array of transformation types that apply to this letter pair
 */
export function getLetterRelationships(
  letter1: string,
  letter2: string
): LetterTransformationType[] {
  const relationships: LetterTransformationType[] = [];

  if (INVERTED_LETTER_MAP[letter1] === letter2) {
    relationships.push(LetterTransformationType.INVERSION);
  }
  if (COMPOUND_LETTER_MAP[letter1] === letter2) {
    relationships.push(LetterTransformationType.COMPOUND);
  }
  if (ALPHA_BETA_COUNTERPART_LETTER_MAP[letter1] === letter2) {
    relationships.push(LetterTransformationType.ALPHA_BETA_COUNTERPART);
  }

  return relationships;
}

/**
 * Get all letters that have a specific transformation relationship with the given letter
 */
export function getRelatedLetters(
  letter: string,
  type: LetterTransformationType
): string | null {
  switch (type) {
    case LetterTransformationType.INVERSION:
      return INVERTED_LETTER_MAP[letter] ?? null;
    case LetterTransformationType.COMPOUND:
      return COMPOUND_LETTER_MAP[letter] ?? null;
    case LetterTransformationType.ALPHA_BETA_COUNTERPART:
      return ALPHA_BETA_COUNTERPART_LETTER_MAP[letter] ?? null;
    default:
      return null;
  }
}

/**
 * Analyze beat pair letters and return their transformation relationships
 * Useful for polyrhythmic LOOP analysis
 */
export function analyzeStepPairTransformation(
  letter1: string,
  letter2: string
): {
  relationships: LetterTransformationType[];
  isInverted: boolean;
  isCompound: boolean;
  isAlphaBetaCounterpart: boolean;
} {
  const relationships = getLetterRelationships(letter1, letter2);
  return {
    relationships,
    isInverted: relationships.includes(LetterTransformationType.INVERSION),
    isCompound: relationships.includes(LetterTransformationType.COMPOUND),
    isAlphaBetaCounterpart: relationships.includes(
      LetterTransformationType.ALPHA_BETA_COUNTERPART
    ),
  };
}

/**
 * Validation Sets for Strict LOOP Types
 * These define which (start_position, end_position) pairs are valid for each LOOP type
 */

/**
 * Mirrored LOOP validation set
 * Valid when: vertical_mirror(start_pos) === end_pos
 */
export const MIRRORED_LOOP_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(
    ([start, end]) => `${start},${end}`
  )
);

/**
 * Flipped LOOP validation set
 * Valid when: horizontal_mirror(start_pos) === end_pos
 */
export const FLIPPED_LOOP_VALIDATION_SET = new Set<string>(
  Object.entries(HORIZONTAL_MIRROR_POSITION_MAP).map(
    ([start, end]) => `${start},${end}`
  )
);

/**
 * Swapped LOOP validation set
 * Valid when: swapped(start_pos) === end_pos
 */
export const SWAPPED_LOOP_VALIDATION_SET = new Set<string>(
  Object.entries(SWAPPED_POSITION_MAP).map(([start, end]) => `${start},${end}`)
);

/**
 * Mirrored-Swapped LOOP validation set
 * Valid when: swapped(vertical_mirror(start_pos)) === end_pos
 * The end position must reflect BOTH transformations:
 * 1. First mirror (east↔west)
 * 2. Then swap (blue↔red positions)
 */
export const MIRRORED_SWAPPED_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(([start, mirroredEnd]) => {
    // Compose: first mirror, then swap
    const swappedMirroredEnd =
      SWAPPED_POSITION_MAP[mirroredEnd as GridPosition];
    return `${start},${swappedMirroredEnd}`;
  })
);

/**
 * Inverted LOOP validation set
 * Valid when: start_pos === end_pos (returns to starting position)
 */
export const INVERTED_LOOP_VALIDATION_SET = new Set<string>(
  Object.values(GridPosition).map((pos) => `${pos},${pos}`)
);

/**
 * Mirrored-Inverted LOOP validation set
 * Valid when: vertical_mirror(start_pos) === end_pos (same as mirrored)
 * The inverted transformation happens with motion types and letters, but position requirement is same as mirrored
 */
export const MIRRORED_INVERTED_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(
    ([start, end]) => `${start},${end}`
  )
);

/**
 * Import rotation maps for composed validation sets
 */
import {
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
  HALF_POSITION_MAP,
} from "$lib/shared/foundation/domain/models/generation/circular-position-maps";

/**
 * Rotated-Swapped LOOP validation set (Quartered - 90° rotations)
 * Valid when: end_pos === SWAPPED(ROTATED(start_pos))
 * The end position must reflect BOTH transformations:
 * 1. First rotate 90° (CW or CCW)
 * 2. Then swap (blue↔red positions)
 *
 * Example: gamma11 (Red@E, Blue@S)
 * - Pure rotation 90° CW → gamma13 (Red@S, Blue@W)
 * - Rotated + Swapped → gamma7 (Red@W, Blue@S) - the swap of gamma13
 */
export const ROTATED_SWAPPED_QUARTERED_VALIDATION_SET = new Set<string>([
  // Clockwise rotation then swap
  ...Object.entries(QUARTER_POSITION_MAP_CW).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd as GridPosition];
    return `${start},${swappedRotatedEnd}`;
  }),
  // Counter-clockwise rotation then swap
  ...Object.entries(QUARTER_POSITION_MAP_CCW).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd as GridPosition];
    return `${start},${swappedRotatedEnd}`;
  }),
]);

/**
 * Rotated-Swapped LOOP validation set (Halved - 180° rotations)
 * Valid when: end_pos === SWAPPED(ROTATED_180(start_pos))
 */
export const ROTATED_SWAPPED_HALVED_VALIDATION_SET = new Set<string>(
  Object.entries(HALF_POSITION_MAP).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd as GridPosition];
    return `${start},${swappedRotatedEnd}`;
  })
);

/**
 * Non-degenerate variants of the rotated-swapped sets (alpha starts removed).
 *
 * Swap+rotate combos (ROTATED_SWAPPED, ROTATED_SWAPPED_INVERTED) degenerate
 * from alpha starts: the hands already sit at each other's 180° image, so
 * rotate-then-swap is the per-hand identity and the "rotation" vanishes.
 * Beta (both hands share a point — swap positionally invisible) and gamma
 * (right angle) are genuine. Mirrors the engine-side composed
 * swap(rotate(start)) seam gate in LOOPEndPositionSelector. Empirical basis:
 * forced-start generation audits, 2026-07-13.
 */
function excludeAlphaStarts(pairs: Set<string>): Set<string> {
  return new Set([...pairs].filter((pair) => !pair.startsWith("alpha")));
}

export const ROTATED_SWAPPED_NONDEGENERATE_QUARTERED_VALIDATION_SET = excludeAlphaStarts(
  ROTATED_SWAPPED_QUARTERED_VALIDATION_SET
);

export const ROTATED_SWAPPED_NONDEGENERATE_HALVED_VALIDATION_SET = excludeAlphaStarts(
  ROTATED_SWAPPED_HALVED_VALIDATION_SET
);
