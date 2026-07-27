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
  HORIZONTAL_MIRROR_POSITION_MAP,
  reflectLocation,
} from "../position-maps/strict-loop-position-maps.js";
import {
  QUARTER_POSITION_MAP_CW,
  LOCATION_MAP_CLOCKWISE,
} from "../position-maps/circular-position-maps.js";
import { LOOPType, Period } from "../loop-types.js";
import {
  RotatedEndPositionSelector,
  rotatedEndPositionSelector,
} from "./RotatedEndPositionSelector.js";
import {
  LOOPComponent as CanonicalLOOPComponent,
  type LOOPSpec,
  type PropLOOPSpec,
  getReflectionAxis,
  specsAreEqual,
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
        return this.rotatedSelector.determineRotatedEndPosition(
          period,
          startPosition
        );

      case LOOPType.MIRRORED:
        return VERTICAL_MIRROR_POSITION_MAP[startPosition] ?? null;

      case LOOPType.FLIPPED:
        return HORIZONTAL_MIRROR_POSITION_MAP[startPosition] ?? null;

      case LOOPType.SWAPPED:
        return SWAPPED_POSITION_MAP[startPosition] ?? null;

      case LOOPType.INVERTED:
        // Inverted LOOP returns to start position (same position)
        return startPosition;

      // Rotated + Swapped (± Inverted): seed must end at swap(rotate(start)).
      // Alpha starts are degenerate — the hands already sit at each other's
      // 180° image, so rotate-then-swap is the per-hand identity and the
      // rotation vanishes. Beta (swap positionally invisible: same point) and
      // gamma (right angle) are genuine. Empirical: forced-start audits
      // 2026-07-13 — gamma 16/16, beta 25/25 exact-type detection.
      case LOOPType.ROTATED_SWAPPED:
      case LOOPType.ROTATED_SWAPPED_INVERTED: {
        if (startPosition.startsWith("alpha")) return null;
        const rotatedEnd = this.rotatedSelector.determineRotatedEndPosition(
          period,
          startPosition
        );
        if (!rotatedEnd) return null;
        return SWAPPED_POSITION_MAP[rotatedEnd] ?? null;
      }

      // Rotation is the inner expansion stage. Once it closes, the outer
      // mirror/swap stage expands that circular result from the same seam, so
      // it does not require a vertical-axis fixed point.
      case LOOPType.MIRRORED_ROTATED_SWAPPED:
      case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
        return this.rotatedSelector.determineRotatedEndPosition(
          period,
          startPosition
        );

      // Combined LOOP types with ROTATED (rotation takes precedence)
      case LOOPType.ROTATED_INVERTED:
      case LOOPType.MIRRORED_ROTATED:
      case LOOPType.MIRRORED_INVERTED_ROTATED:
        return this.rotatedSelector.determineRotatedEndPosition(
          period,
          startPosition
        );

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

      // Inversion does not move either hand, so MSI has the same positional
      // seam as mirror+swap: end = swap(verticalMirror(start)). Requiring the
      // start itself to be fixed under both transforms incorrectly excludes
      // every Box position.
      case LOOPType.MIRRORED_SWAPPED_INVERTED: {
        const mirroredPosition = VERTICAL_MIRROR_POSITION_MAP[startPosition];
        if (!mirroredPosition) return null;
        return SWAPPED_POSITION_MAP[mirroredPosition] ?? null;
      }

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

export const loopEndPositionSelector = new LOOPEndPositionSelector(
  rotatedEndPositionSelector
);

export function determineEndPositionForSpec(
  spec: LOOPSpec,
  startPosition: string
): string | null {
  if (!specsAreEqual(spec.blue, spec.red)) return null;

  const [blueStart, redStart] =
    gridPositionDeriver.getGridLocationsFromPosition(startPosition);
  const propSpec = spec.blue ?? spec.red;
  if (!propSpec || propSpec.components.size === 0) return startPosition;
  if (propSpec.components.has(CanonicalLOOPComponent.REWOUND)) return null;

  const rotation = propSpec.components.get(CanonicalLOOPComponent.ROTATED);
  const fuseableAtRotationPeriod = rotation
    ? hasFuseableAtPeriod(propSpec, rotation.period)
    : false;
  const reflectionAtRotationPeriod = rotation
    ? hasReflectionAtPeriod(propSpec, rotation.period)
    : false;

  // ROTATED executes as its own inner expansion unless a same-period
  // swap/inversion group absorbs it. Later reflection stages receive the
  // already-closed inner sequence, so they do not constrain the original
  // seed seam.
  if (
    rotation &&
    (!fuseableAtRotationPeriod || reflectionAtRotationPeriod)
  ) {
    return derivePosition(
      rotateLocation(blueStart, rotation.period),
      rotateLocation(redStart, rotation.period)
    );
  }

  const firstPeriod = firstFuseablePeriod(propSpec);
  if (firstPeriod === null) return startPosition;

  let blueEnd: string | null = blueStart;
  let redEnd: string | null = redStart;

  if (rotation?.period === firstPeriod) {
    blueEnd = rotateLocation(blueEnd, rotation.period);
    redEnd = rotateLocation(redEnd, rotation.period);
  }

  for (const component of [
    CanonicalLOOPComponent.MIRRORED,
    CanonicalLOOPComponent.FLIPPED,
  ]) {
    const componentSpec = propSpec.components.get(component);
    if (!componentSpec || componentSpec.period !== firstPeriod) continue;
    const axis = getReflectionAxis(component, componentSpec);
    if (!axis) continue;
    blueEnd = blueEnd === null ? null : reflectLocation(blueEnd, axis);
    redEnd = redEnd === null ? null : reflectLocation(redEnd, axis);
  }

  const swap = propSpec.components.get(CanonicalLOOPComponent.SWAPPED);
  if (swap?.period === firstPeriod) {
    [blueEnd, redEnd] = [redEnd, blueEnd];
  }

  return derivePosition(blueEnd, redEnd);
}

function derivePosition(
  blueLocation: string | null,
  redLocation: string | null
): string | null {
  if (blueLocation === null || redLocation === null) return null;
  return gridPositionDeriver.getGridPositionFromLocations(
    blueLocation,
    redLocation
  );
}

function hasFuseableAtPeriod(
  spec: PropLOOPSpec,
  period: number
): boolean {
  for (const [component, componentSpec] of spec.components) {
    if (componentSpec.mode === "overlay") continue;
    if (
      componentSpec.period === period &&
      (component === CanonicalLOOPComponent.MIRRORED ||
        component === CanonicalLOOPComponent.FLIPPED ||
        component === CanonicalLOOPComponent.SWAPPED ||
        component === CanonicalLOOPComponent.INVERTED)
    ) {
      return true;
    }
  }
  return false;
}

function hasReflectionAtPeriod(
  spec: PropLOOPSpec,
  period: number
): boolean {
  for (const component of [
    CanonicalLOOPComponent.MIRRORED,
    CanonicalLOOPComponent.FLIPPED,
  ]) {
    const componentSpec = spec.components.get(component);
    if (
      componentSpec?.mode !== "overlay" &&
      componentSpec?.period === period
    ) {
      return true;
    }
  }
  return false;
}

function firstFuseablePeriod(spec: PropLOOPSpec): number | null {
  const groups = new Map<
    number,
    { hasSpatialTransform: boolean; invertOnly: boolean }
  >();

  for (const [component, componentSpec] of spec.components) {
    if (componentSpec.mode === "overlay") continue;
    const fuseable =
      component === CanonicalLOOPComponent.MIRRORED ||
      component === CanonicalLOOPComponent.FLIPPED ||
      component === CanonicalLOOPComponent.SWAPPED ||
      component === CanonicalLOOPComponent.INVERTED;
    if (!fuseable) continue;

    const current = groups.get(componentSpec.period) ?? {
      hasSpatialTransform: false,
      invertOnly: true,
    };
    if (component !== CanonicalLOOPComponent.INVERTED) {
      current.hasSpatialTransform = true;
      current.invertOnly = false;
    }
    groups.set(componentSpec.period, current);
  }

  const ordered = [...groups.entries()].sort(([periodA, groupA], [periodB, groupB]) => {
    const inversionRankA = groupA.invertOnly ? 1 : 0;
    const inversionRankB = groupB.invertOnly ? 1 : 0;
    if (inversionRankA !== inversionRankB) return inversionRankA - inversionRankB;
    return periodA - periodB;
  });
  return ordered[0]?.[0] ?? null;
}

function rotateLocation(loc: string, period: number): string | null {
  if (period === 2) {
    const quarterTurn = LOCATION_MAP_CLOCKWISE[loc];
    return quarterTurn ? LOCATION_MAP_CLOCKWISE[quarterTurn] ?? null : null;
  }
  if (period === 4) return LOCATION_MAP_CLOCKWISE[loc] ?? null;
  return null;
}
