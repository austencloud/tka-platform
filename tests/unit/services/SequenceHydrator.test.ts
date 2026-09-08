import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import {
  decodeSequenceFromQR,
  decodeSequenceWithCompression,
  encodeSequenceWithCompression,
} from "$lib/shared/navigation/services/sequence-encoder";
import { loopDetector } from "$lib/shared/create/services/loop-detector";
import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";

import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import {
  createMotionData,
  isVisibleMotion,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  MotionType,
  RotationDirection,
  Orientation,
  HandSide,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";

function injectRealCsvData() {
  const root = resolve(__dirname, "../../..");
  const read = (filename: string) =>
    readFileSync(resolve(root, "static/data/pictographs", filename), "utf8");
  Object.assign(window, {
    csvData: {
      diamondData: read("DiamondPictographDataframe.csv"),
      boxData: read("BoxPictographDataframe.csv"),
      skewedData: read("SkewedPictographDataframe.csv"),
    },
  });
}

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

describe("hydrateSequence — encode/decode round-trip", () => {
  it("keeps Type 6 letters in the displayed word for shortcode JM67", async () => {
    injectRealCsvData();
    const decoded = await decodeSequenceFromQR(
      "s~q1:HYPQN1Z0M/2Q 5Q:66FLGKENKLPR21DEFMLG3:JZ.SR85W.5. KGU7$77$$QECQCE5R451ID00"
    );

    const hydrated = await hydrateSequence(decoded, {
      loopDetector,
    });

    expect(hydrated.steps.map((step) => step.letter)).toEqual([
      "β",
      "β",
      "Θ",
      "γ",
      "S",
      "S",
    ]);
    expect(hydrated.word).toBe("ββΘγSS");
  });

  it("restores gridMode, word, and per-step letter/positions after decode", async () => {
    const original = buildDiamondSequence();

    const { encoded } = encodeSequenceWithCompression(original);
    const decoded = decodeSequenceWithCompression(encoded);

    expect(decoded.word).toBe("");
    expect(decoded.steps[0]?.letter).toBeNull();
    expect(decoded.steps[0]?.startPosition).toBeNull();

    const hydrated = await hydrateSequence(decoded, {
      loopDetector,
    });

    // The position deriver runs against the decoded beat geometry and
    // restores per-beat start/end grid positions (e.g. alpha5 -> alpha7).
    // This is the load-bearing enrichment that scanned-link refresh depends on.
    expect(hydrated.steps[0]?.startPosition).toBeTruthy();
    expect(hydrated.steps[0]?.endPosition).toBeTruthy();

    expect(hydrated.gridMode).toBe("diamond");

    expect(hydrated.isCircular).toBe(false);

    expect(hydrated.metadata._hydratedAt).toBeTypeOf("number");
  });

  it("replaces an encoded placeholder start with beat one's visible prop state", async () => {
    const original = createSequenceData({
      word: "",
      name: "",
      steps: buildDiamondSequence().steps,
    });

    const { encoded } = encodeSequenceWithCompression(original);
    const decoded = decodeSequenceWithCompression(encoded);

    expect(decoded.startPosition).toBeTruthy();
    expect(isVisibleMotion(decoded.startPosition?.motions.left)).toBe(false);
    expect(isVisibleMotion(decoded.startPosition?.motions.right)).toBe(false);

    const hydrated = await hydrateSequence(decoded, { loopDetector });
    const firstStep = hydrated.steps[0]!;
    const start = hydrated.startPosition!;

    expect(isVisibleMotion(start.motions.left)).toBe(true);
    expect(isVisibleMotion(start.motions.right)).toBe(true);
    expect(start.motions.left?.motionType).toBe(MotionType.STATIC);
    expect(start.motions.right?.motionType).toBe(MotionType.STATIC);
    expect(start.motions.left?.startLocation).toBe(
      firstStep.motions.left.startLocation
    );
    expect(start.motions.right?.startLocation).toBe(
      firstStep.motions.right.startLocation
    );
    expect(start.motions.left?.startOrientation).toBe(
      firstStep.motions.left.startOrientation
    );
    expect(start.motions.right?.startOrientation).toBe(
      firstStep.motions.right.startOrientation
    );
    expect(start.motions.left?.propPlacementData).toBeTruthy();
    expect(start.motions.right?.propPlacementData).toBeTruthy();
    expect(hydrated.startingPosition).toEqual(start);
  });

  it("keeps solo choreography unlettered when a stale beat carries a letter", async () => {
    const soloStep: StepData = {
      ...makeStep(
        1,
        {
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.NO_ROTATION,
          startLocation: GridLocation.NORTHEAST,
          endLocation: GridLocation.WEST,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.OUT,
          turns: 0,
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
          isVisible: false,
        }
      ),
      letter: "Λ",
    };
    const original = createSequenceData({
      word: "Λ",
      name: "Shared Sequence",
      displayName: "Shared Sequence",
      steps: [soloStep],
      startPosition: createStartPositionData({
        motions: {
          left: createMotionData({
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: GridLocation.NORTHEAST,
            endLocation: GridLocation.NORTHEAST,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.IN,
            turns: 0,
            hand: HandSide.LEFT,
            propType: PropType.STAFF,
            isVisible: true,
          }),
          right: createMotionData({
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.IN,
            turns: 0,
            hand: HandSide.RIGHT,
            propType: PropType.STAFF,
            isVisible: false,
          }),
        },
      }),
    });

    const hydrated = await hydrateSequence(original, { loopDetector: null });

    expect(hydrated.word).toBe("");
    expect(hydrated.steps[0]?.letter).toBeNull();
    expect(hydrated.name).toBe("Shared Sequence");
    expect(hydrated.displayName).toBe("Shared Sequence");
    expect(isVisibleMotion(hydrated.steps[0]?.motions.right)).toBe(false);
    expect(isVisibleMotion(hydrated.startPosition?.motions.left)).toBe(true);
    expect(isVisibleMotion(hydrated.startPosition?.motions.right)).toBe(false);
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

    expect(decoded.steps[0]?.motions.left.turns).toBe(0.5);
    expect(decoded.steps[0]?.motions.right.turns).toBe(0);
  });
});
