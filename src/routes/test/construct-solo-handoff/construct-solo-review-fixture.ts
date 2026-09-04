import type { AuthoredHand } from "$lib/shared/foundation/domain/models/authored-hand";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/solo-prop-step-data";
import { createSoloProp } from "$lib/shared/foundation/services/solo-prop-factory";
import { soloPropToSequence } from "$lib/shared/foundation/services/solo-prop-sequence-adapter";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

const BOX_ORBIT = [
  GridLocation.NORTHWEST,
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
] as const;

const SMOOTH_BOX_STEPS: SoloPropStepData[] = BOX_ORBIT.slice(0, -1).map(
  (startLocation, index) => ({
    startLocation,
    endLocation: BOX_ORBIT[index + 1]!,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 0,
    duration: 1,
  })
);

export function createConstructSoloReviewSequence(
  authoredHand: AuthoredHand
): SequenceData {
  const soloProp = createSoloProp(
    SMOOTH_BOX_STEPS,
    GridLocation.NORTHWEST,
    Orientation.IN,
    {
      name: "Smooth box orbit",
      notes: "Production-shaped solo fixture for the Construct handoff review.",
    }
  );

  return soloPropToSequence(soloProp, authoredHand);
}
