import { describe, expect, it } from "vitest";

import { encodeSequenceWithCompression, decodeSequenceWithCompression } from "$lib/shared/navigation/services/sequence-encoder";
import { PositionDeriver } from "$lib/shared/navigation/services/position-deriver";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
import { hydrateSequence } from "$lib/shared/navigation/services/implementations/SequenceHydrator";

import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

function makeStep(
  stepNumber: number,
  blue: Partial<Parameters<typeof createMotionData>[0]>,
  red: Partial<Parameters<typeof createMotionData>[0]>
): StepData {
  return {
    id: `step-${stepNumber}`,
    stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter: null,
    startPosition: null,
    endPosition: null,
    motions: {
      blue: createMotionData({ ...blue, color: MotionColor.BLUE }),
      red: createMotionData({ ...red, color: MotionColor.RED }),
    },
  };
}

function buildDiamondSequence(): SequenceData {
  const start = makeStep(
    0,
    {
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.NORTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      propType: PropType.STAFF,
    },
    {
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.SOUTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      propType: PropType.STAFF,
    }
  );

  const step1 = makeStep(
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
  );

  return createSequenceData({
    word: "",
    name: "",
    steps: [step1],
    startPosition: {
      id: start.id,
      letter: start.letter,
      gridPosition: start.startPosition,
      startPosition: start.startPosition,
      endPosition: start.endPosition,
      motions: start.motions,
    },
    startingPosition: {
      id: start.id,
      letter: start.letter,
      gridPosition: start.startPosition,
      startPosition: start.startPosition,
      endPosition: start.endPosition,
      motions: start.motions,
    },
  });
}

const stubLetterDeriver: ILetterDeriver = {
  async deriveLettersForSequence(sequence: SequenceData): Promise<SequenceData> {
    const steps = sequence.steps.map((step, i) => ({
      ...step,
      letter: String.fromCharCode(65 + i),
    }));
    return {
      ...sequence,
      steps,
      word: steps.map((s) => s.letter).join(""),
    };
  },
};

describe("hydrateSequence — encode/decode round-trip", () => {
  it("restores gridMode, word, and per-step letter/positions after decode", async () => {
    const positionDeriver = new PositionDeriver(gridPositionDeriver);

    const original = buildDiamondSequence();

    const { encoded } = encodeSequenceWithCompression(original);
    const decoded = decodeSequenceWithCompression(encoded);

    expect(decoded.word).toBe("");
    expect(decoded.steps[0]?.letter).toBeNull();
    expect(decoded.steps[0]?.startPosition).toBeNull();

    const hydrated = await hydrateSequence(decoded, {
      letterDeriver: stubLetterDeriver,
      positionDeriver,
      loopDetector,
      gridModeDeriver,
    });

    expect(hydrated.word).toBe("A");
    expect(hydrated.steps[0]?.letter).toBe("A");

    expect(hydrated.steps[0]?.startPosition).toBeTruthy();
    expect(hydrated.steps[0]?.endPosition).toBeTruthy();

    expect(hydrated.gridMode).toBe("diamond");

    expect(hydrated.isCircular).toBe(false);

    expect(hydrated.metadata._hydratedAt).toBeTypeOf("number");
  });

  it("preserves fractional turns (0.5) through encode → decode", () => {

    const original = createSequenceData({
      word: "",
      name: "",
      steps: [
        makeStep(
          1,
          {
            motionType: MotionType.ANTI,
            rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.WEST,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.COUNTER,
            turns: 0.5,
            propType: PropType.STAFF,
          },
          {
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.IN,
            turns: 0,
            propType: PropType.STAFF,
          }
        ),
      ],
    });

    const { encoded } = encodeSequenceWithCompression(original);
    const decoded = decodeSequenceWithCompression(encoded);

    expect(decoded.steps[0]?.motions.blue.turns).toBe(0.5);
    expect(decoded.steps[0]?.motions.red.turns).toBe(0);
  });
});
