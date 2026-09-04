import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  TND_BY_FAMILY,
  type TnDElement,
} from "$lib/features/choreo-card/domain/tnd-element";
import type { Flower } from "./flower-signature";
import {
  mapOrientationToAngle,
  mapPositionToAngle,
} from "$lib/shared/animation-engine/services/angle-calculator";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type PropDirectionRelationship = "same" | "opp";
export type PropTimingRelationship = "tog" | "split" | "quarter";

export type PropRelationship =
  | { kind: "float"; direction: null; timing: null; element: null }
  | {
      kind: "direction-only";
      direction: PropDirectionRelationship;
      timing: null;
      element: null;
    }
  | {
      kind: "full";
      direction: PropDirectionRelationship;
      timing: PropTimingRelationship;
      element: TnDElement;
    };

function normalizedPhaseDelta(a: number, b: number): number {
  const tau = Math.PI * 2;
  const raw = (((a - b) % tau) + tau) % tau;
  return Math.min(raw, tau - raw);
}

function timingFromPhase(delta: number): PropTimingRelationship {
  const quarter = Math.PI / 2;
  if (delta < quarter / 2) return "tog";
  if (delta > Math.PI - quarter / 2) return "split";
  return "quarter";
}

/**
 * The prop timing between two prop bearings, in radians.
 *
 * Exported because a surface with no sequence to read bearings off has to
 * classify the same three cases. The Theory ratios take their bearings from
 * the QfT knobs rather than from a step's start orientation, and that is the
 * only difference: the thresholds stay here, in one place.
 */
export function propTimingBetween(
  a: number,
  b: number
): PropTimingRelationship {
  return timingFromPhase(normalizedPhaseDelta(a, b));
}

/**
 * Classify the props separately from the hands. Direction survives unequal
 * turn rates; timing does not. Float is neither clockwise nor counter-clockwise,
 * so it deliberately returns no VTG direction/timing classification.
 */
export function derivePropRelationship(
  sequence: SequenceData,
  pair: { left: Flower; right: Flower }
): PropRelationship {
  const step = sequence.steps.find(
    (candidate) => candidate.motions.left && candidate.motions.right
  );
  const left = step?.motions.left;
  const right = step?.motions.right;
  if (!left || !right || pair.left.turns === "fl" || pair.right.turns === "fl") {
    return { kind: "float", direction: null, timing: null, element: null };
  }
  if (
    left.rotationDirection === RotationDirection.NO_ROTATION ||
    right.rotationDirection === RotationDirection.NO_ROTATION
  ) {
    return { kind: "float", direction: null, timing: null, element: null };
  }

  const direction: PropDirectionRelationship =
    left.rotationDirection === right.rotationDirection ? "same" : "opp";
  if (pair.left.turns !== pair.right.turns) {
    return { kind: "direction-only", direction, timing: null, element: null };
  }

  const leftAngle = mapOrientationToAngle(
    left.startOrientation,
    mapPositionToAngle(left.startLocation)
  );
  const rightAngle = mapOrientationToAngle(
    right.startOrientation,
    mapPositionToAngle(right.startLocation)
  );
  const timing = timingFromPhase(normalizedPhaseDelta(leftAngle, rightAngle));
  const element = TND_BY_FAMILY[`${timing}-${direction}`];
  if (!element) {
    throw new Error(`No element for prop relationship ${timing}-${direction}`);
  }
  return { kind: "full", direction, timing, element };
}
