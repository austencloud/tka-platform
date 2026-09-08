import { describe, expect, it } from "vitest";

import { ensureComposition } from "$lib/shared/foundation/services/sequence-hydrator";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  MotionType,
  RotationDirection,
  Orientation,
  HandSide,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

function makeStep(
  stepNumber: number,
  left: Partial<Parameters<typeof createMotionData>[0]>,
  right: Partial<Parameters<typeof createMotionData>[0]>
): StepData {
  return {
    id: `step-${stepNumber}`,
    stepNumber,
    duration: 1,
    leftReversal: false,
    rightReversal: false,
    isBlank: false,
    letter: null,
    startPosition: null,
    endPosition: null,
    motions: {
      left: createMotionData({ ...left, hand: HandSide.LEFT }),
      right: createMotionData({ ...right, hand: HandSide.RIGHT }),
    },
  };
}

/** A 2-step sequence with valid motions but NO startPosition (the bug's shape). */
function buildSequenceWithoutStartPosition(): SequenceData {
  return createSequenceData({
    word: "",
    name: "",
    steps: [
      makeStep(
        1,
        {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.EAST,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.IN,
          turns: 0,
          propType: PropType.STAFF,
        },
        {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.SOUTH,
          endLocation: GridLocation.WEST,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.IN,
          turns: 0,
          propType: PropType.STAFF,
        }
      ),
      makeStep(
        2,
        {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.EAST,
          endLocation: GridLocation.SOUTH,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.IN,
          turns: 0,
          propType: PropType.STAFF,
        },
        {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.WEST,
          endLocation: GridLocation.NORTH,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.IN,
          turns: 0,
          propType: PropType.STAFF,
        }
      ),
    ],
  });
}

describe("ensureComposition — start position persistence", () => {
  // Regression for the 2026-06 empty-start-cell bug: compositional/LOOP saves
  // dropped the startPosition field, so saved docs + public mirrors rendered a
  // bare grid with no start props. ensureComposition (run at save + publish) must
  // now reconstruct a renderable start position from the first step.
  it("derives a renderable startPosition when the sequence lacks one", () => {
    const seq = buildSequenceWithoutStartPosition();
    expect(seq.startPosition).toBeUndefined();

    const composed = ensureComposition(seq);

    expect(composed.startPosition).toBeTruthy();
    const motions = composed.startPosition?.motions;
    expect(motions?.left).toBeTruthy();
    expect(motions?.right).toBeTruthy();
    // Start position = both props STATIC at their first-step start locations.
    expect(motions?.left?.motionType).toBe(MotionType.STATIC);
    expect(motions?.right?.motionType).toBe(MotionType.STATIC);
    expect(motions?.left?.startLocation).toBe(GridLocation.NORTH);
    expect(motions?.left?.endLocation).toBe(GridLocation.NORTH);
    expect(motions?.right?.startLocation).toBe(GridLocation.SOUTH);
    expect(motions?.right?.endLocation).toBe(GridLocation.SOUTH);
    // The glyph must be the start POSITION (blue@north + red@south = alpha),
    // NOT the first step's letter. Only alpha/beta/gamma are valid here.
    expect(["α", "β", "γ"]).toContain(composed.startPosition?.letter);
    expect(composed.startPosition?.letter).toBe("α");
  });

  it("preserves an existing startPosition instead of overwriting it", () => {
    const seq = buildSequenceWithoutStartPosition();
    const existing = {
      isStartPosition: true as const,
      id: "start-preexisting",
      letter: null,
      endPosition: null,
      motions: {
        left: createMotionData({
          motionType: MotionType.STATIC,
          startLocation: GridLocation.EAST,
          endLocation: GridLocation.EAST,
          hand: HandSide.LEFT,
        }),
        right: createMotionData({
          motionType: MotionType.STATIC,
          startLocation: GridLocation.WEST,
          endLocation: GridLocation.WEST,
          hand: HandSide.RIGHT,
        }),
      },
    } as SequenceData["startPosition"];

    const composed = ensureComposition({ ...seq, startPosition: existing });

    expect(composed.startPosition?.id).toBe("start-preexisting");
    expect(composed.startPosition?.motions?.left?.startLocation).toBe(GridLocation.EAST);
  });
});
