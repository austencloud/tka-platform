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
 * Classify the props separately from the hands. Direction survives unequal
 * turn rates; timing does not. Float is neither clockwise nor counter-clockwise,
 * so it deliberately returns no VTG direction/timing classification.
 */
export function derivePropRelationship(
  sequence: SequenceData,
  pair: { blue: Flower; red: Flower }
): PropRelationship {
  const step = sequence.steps.find(
    (candidate) => candidate.motions.blue && candidate.motions.red
  );
  const blue = step?.motions.blue;
  const red = step?.motions.red;
  if (!blue || !red || pair.blue.turns === "fl" || pair.red.turns === "fl") {
    return { kind: "float", direction: null, timing: null, element: null };
  }
  if (
    blue.rotationDirection === RotationDirection.NO_ROTATION ||
    red.rotationDirection === RotationDirection.NO_ROTATION
  ) {
    return { kind: "float", direction: null, timing: null, element: null };
  }

  const direction: PropDirectionRelationship =
    blue.rotationDirection === red.rotationDirection ? "same" : "opp";
  if (pair.blue.turns !== pair.red.turns) {
    return { kind: "direction-only", direction, timing: null, element: null };
  }

  const blueAngle = mapOrientationToAngle(
    blue.startOrientation,
    mapPositionToAngle(blue.startLocation)
  );
  const redAngle = mapOrientationToAngle(
    red.startOrientation,
    mapPositionToAngle(red.startLocation)
  );
  const timing = timingFromPhase(normalizedPhaseDelta(blueAngle, redAngle));
  const element = TND_BY_FAMILY[`${timing}-${direction}`];
  if (!element) {
    throw new Error(`No element for prop relationship ${timing}-${direction}`);
  }
  return { kind: "full", direction, timing, element };
}
