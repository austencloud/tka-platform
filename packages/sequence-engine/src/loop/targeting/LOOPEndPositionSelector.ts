/**
 * LOOP End Position Selector
 *
 * Determines the required end position for a partial sequence based on
 * the LOOP type being generated. Each LOOP type imposes a specific
 * positional constraint on where the partial sequence must end so that
 * the LOOP executor can transform it into a full circular sequence.
 *
 * Precedence order when combined:
 * 1. ROTATED (rotation takes precedence)
 * 2. MIRRORED (mirror takes precedence over inverted/swapped)
 * 3. INVERTED (return to start takes precedence over swapped)
 * 4. SWAPPED (only for strict swapped)
 *
 * Ported from app's LOOPEndPositionSelector.ts.
 */

import {
  SWAPPED_POSITION_MAP,
  VERTICAL_MIRROR_POSITION_MAP,
  VERTICAL_MIRROR_LOCATION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
} from "../position-maps/strict-loop-position-maps.js";
import {
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CW,
} from "../position-maps/circular-position-maps.js";
import { LOOPType, Period } from "../loop-types.js";
import { RotatedEndPositionSelector, rotatedEndPositionSelector } from "./RotatedEndPositionSelector.js";
import {
  LOOPComponent as CanonicalLOOPComponent,
  type LOOPSpec,
  type PropLOOPSpec,
} from "../loop-spec.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";

export class LOOPEndPositionSelector {
  constructor(private readonly rotatedSelector: RotatedEndPositionSelector) {}

  /**
   * Determine the required end position based on LOOP type.
   * @param loopType - The LOOP type being generated
   * @param startPosition - The sequence's starting position
   * @param period - Halved or quartered
   * @returns The required end position, or null if no constraint (e.g., Rewound)
   * @deprecated Use determineEndPositionForSpec instead.
   */
  determineEndPosition(
    loopType: LOOPType,
    startPosition: string,
    period: Period
  ): string | null {
    switch (loopType) {
      // Strict LOOP types
      case LOOPType.ROTATED:
        return this.rotatedSelector.determineRotatedEndPosition(period, startPosition);

      case LOOPType.MIRRORED:
        return VERTICAL_MIRROR_POSITION_MAP[startPosition] ?? null;

      case LOOPType.FLIPPED:
        return HORIZONTAL_MIRROR_POSITION_MAP[startPosition] ?? null;

      case LOOPType.SWAPPED:
        return SWAPPED_POSITION_MAP[startPosition] ?? null;

      case LOOPType.INVERTED:
        // Inverted LOOP returns to start position (same position)
        return startPosition;

      // Rotated + Swapped (± Inverted): rotation and swap cancel per-hand from
      // alpha starts (hands already sit at each other's 180° image), and the
      // rotate-only seam mistargets gamma starts (correct target is
      // swap(rotate(start))). Beta starts are the proven non-degenerate set —
      // both hands share a point, so swap is positionally invisible and the
      // rotation survives intact. Empirical: 25-run audits, 2026-07-13.
      case LOOPType.ROTATED_SWAPPED:
      case LOOPType.ROTATED_SWAPPED_INVERTED:
        if (!startPosition.startsWith("beta")) return null;
        return this.rotatedSelector.determineRotatedEndPosition(period, startPosition);

      // All Four: mirror+swap need a start fixed under both — beta1/beta5 only
      // (elsewhere the mirror degrades to a flip and detection finds
      // flipped+inverted+rotated+swapped, an unimplemented combo).
      case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
        if (startPosition !== "beta1" && startPosition !== "beta5") return null;
        return this.rotatedSelector.determineRotatedEndPosition(period, startPosition);

      // Combined LOOP types with ROTATED (rotation takes precedence)
      case LOOPType.ROTATED_INVERTED:
      case LOOPType.MIRRORED_ROTATED:
      case LOOPType.MIRRORED_INVERTED_ROTATED:
        return this.rotatedSelector.determineRotatedEndPosition(period, startPosition);

      // Combined LOOP types with MIRRORED
      case LOOPType.MIRRORED_INVERTED:
        return VERTICAL_MIRROR_POSITION_MAP[startPosition] ?? null;

      case LOOPType.MIRRORED_SWAPPED: {
        // First mirror, then swap
        const mirroredPosition = VERTICAL_MIRROR_POSITION_MAP[startPosition];
        if (!mirroredPosition) return null;
        return SWAPPED_POSITION_MAP[mirroredPosition] ?? null;
      }

      // Swapped + Inverted: the seed ends at the swapped position. The executor
      // then re-swaps in createStep, so the full extended sequence's final end
      // position lands back at start (swap is its own inverse). This matches
      // SWAPPED_LOOP_VALIDATION_SET used by the spec-executor pipeline.
      case LOOPType.SWAPPED_INVERTED:
        return SWAPPED_POSITION_MAP[startPosition] ?? null;

      // Mirrored + Swapped + Inverted: inverted takes precedence — return to
      // start. Start must be a fixed point of both mirror and swap
      // (beta1/beta5); elsewhere the mirror degrades to a flip.
      case LOOPType.MIRRORED_SWAPPED_INVERTED:
        if (startPosition !== "beta1" && startPosition !== "beta5") return null;
        return startPosition;

      // Rewound has no position constraint — reversed steps return to start naturally
      case LOOPType.REWOUND:
        return null;

      default:
        throw new Error(
          `LOOP type "${loopType}" is not yet implemented for end position selection.`
        );
    }
  }
}

export const loopEndPositionSelector = new LOOPEndPositionSelector(rotatedEndPositionSelector);

export function determineEndPositionForSpec(
  spec: LOOPSpec,
  startPosition: string,
): string | null {
  const [blueStart, redStart] =
    gridPositionDeriver.getGridLocationsFromPosition(startPosition);

  const blueEnd = determinePropEndLocation(spec.blue, blueStart);
  const redEnd = determinePropEndLocation(spec.red, redStart);

  if (blueEnd === null && redEnd === null) return null;

  return gridPositionDeriver.getGridPositionFromLocations(
    blueEnd ?? blueStart,
    redEnd ?? redStart,
  );
}

function determinePropEndLocation(
  spec: PropLOOPSpec | undefined,
  startLoc: string,
): string | null {
  if (!spec || spec.components.size === 0) return startLoc;

  if (spec.components.has(CanonicalLOOPComponent.REWOUND)) return null;

  if (spec.components.has(CanonicalLOOPComponent.ROTATED)) {
    const period = spec.components.get(CanonicalLOOPComponent.ROTATED)!.period;
    return rotateLocation(startLoc, period);
  }
  if (spec.components.has(CanonicalLOOPComponent.MIRRORED))
    return VERTICAL_MIRROR_LOCATION_MAP[startLoc] ?? null;
  if (spec.components.has(CanonicalLOOPComponent.FLIPPED))
    return HORIZONTAL_MIRROR_LOCATION_MAP[startLoc] ?? null;
  if (spec.components.has(CanonicalLOOPComponent.INVERTED)) return startLoc;
  if (spec.components.has(CanonicalLOOPComponent.SWAPPED)) return startLoc;

  return startLoc;
}

function rotateLocation(loc: string, period: number): string | null {
  if (period === 2) return HALF_POSITION_MAP[loc] ?? null;
  if (period === 4) return QUARTER_POSITION_MAP_CW[loc] ?? null;
  return null;
}
