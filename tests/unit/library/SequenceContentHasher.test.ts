import { describe, it, expect } from "vitest";
import { computeHash } from "$lib/shared/library/services/sequence-content-hasher";
import {
  createSequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

function makeStep(overrides: Partial<StepData> = {}): StepData {
  const base: StepData = {
    id: "step-1",
    letter: null,
    startPosition: null,
    endPosition: null,
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    gridMode: GridMode.DIAMOND,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        turns: 1,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.OUT,
        gridMode: GridMode.DIAMOND,
        color: MotionColor.BLUE,
      }),
      [MotionColor.RED]: createMotionData({
        motionType: MotionType.ANTI,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        turns: 1,
        startOrientation: Orientation.OUT,
        endOrientation: Orientation.IN,
        gridMode: GridMode.DIAMOND,
        color: MotionColor.RED,
      }),
    },
    ...overrides,
  };
  return base;
}

describe("SequenceContentHasher", () => {
  it("produces a deterministic 64-character hex hash (SHA-256)", async () => {
    const sequence = createSequenceData({
      name: "TEST",
      word: "TEST",
      steps: [makeStep()],
    });

    const hash1 = await computeHash(sequence);
    const hash2 = await computeHash(sequence);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a different hash when turns change from 1 to 2", async () => {
    const step1Turn = makeStep();
    const step2Turns = makeStep({
      motions: {
        [MotionColor.BLUE]: createMotionData({
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.EAST,
          turns: 2, // changed
          startOrientation: Orientation.IN,
          endOrientation: Orientation.OUT,
          gridMode: GridMode.DIAMOND,
          color: MotionColor.BLUE,
        }),
        [MotionColor.RED]: createMotionData({
          motionType: MotionType.ANTI,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
          startLocation: GridLocation.SOUTH,
          endLocation: GridLocation.WEST,
          turns: 1,
          startOrientation: Orientation.OUT,
          endOrientation: Orientation.IN,
          gridMode: GridMode.DIAMOND,
          color: MotionColor.RED,
        }),
      },
    });

    const seq1 = createSequenceData({ word: "A", steps: [step1Turn] });
    const seq2 = createSequenceData({ word: "A", steps: [step2Turns] });

    const hash1 = await computeHash(seq1);
    const hash2 = await computeHash(seq2);

    expect(hash1).not.toBe(hash2);
  });

  it("produces the same hash regardless of name, tags, or thumbnails", async () => {
    const step = makeStep();

    const seqA = createSequenceData({
      name: "Original Name",
      word: "WORD",
      steps: [step],
      tags: ["favorite", "performance"],
      thumbnails: ["https://example.com/thumb1.jpg"],
      notes: "My favorite sequence",
    });

    const seqB = createSequenceData({
      name: "Completely Different Name",
      word: "WORD",
      steps: [step],
      tags: [],
      thumbnails: [],
      notes: undefined,
    });

    const hashA = await computeHash(seqA);
    const hashB = await computeHash(seqB);

    expect(hashA).toBe(hashB);
  });

  it("produces a different hash when step order is swapped", async () => {
    const stepA = makeStep({ stepNumber: 1 });
    const stepB = makeStep({
      stepNumber: 2,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.NO_ROTATION,
          startLocation: GridLocation.EAST,
          endLocation: GridLocation.WEST,
          turns: 0,
          startOrientation: Orientation.CLOCK,
          endOrientation: Orientation.COUNTER,
          gridMode: GridMode.DIAMOND,
          color: MotionColor.BLUE,
        }),
        [MotionColor.RED]: createMotionData({
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.NORTH,
          turns: 0,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.IN,
          gridMode: GridMode.DIAMOND,
          color: MotionColor.RED,
        }),
      },
    });

    const seqAB = createSequenceData({ word: "AB", steps: [stepA, stepB] });
    const seqBA = createSequenceData({ word: "AB", steps: [stepB, stepA] });

    const hashAB = await computeHash(seqAB);
    const hashBA = await computeHash(seqBA);

    expect(hashAB).not.toBe(hashBA);
  });

  it("produces a different hash for DIAMOND vs BOX grid mode", async () => {
    const diamondStep = makeStep({ gridMode: GridMode.DIAMOND });
    const boxStep = makeStep({
      gridMode: GridMode.BOX,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          ...((makeStep().motions[MotionColor.BLUE]) as ReturnType<typeof createMotionData>),
          gridMode: GridMode.BOX,
        }),
        [MotionColor.RED]: createMotionData({
          ...((makeStep().motions[MotionColor.RED]) as ReturnType<typeof createMotionData>),
          gridMode: GridMode.BOX,
        }),
      },
    });

    const seqDiamond = createSequenceData({
      word: "TEST",
      gridMode: GridMode.DIAMOND,
      steps: [diamondStep],
    });

    const seqBox = createSequenceData({
      word: "TEST",
      gridMode: GridMode.BOX,
      steps: [boxStep],
    });

    const hashDiamond = await computeHash(seqDiamond);
    const hashBox = await computeHash(seqBox);

    expect(hashDiamond).not.toBe(hashBox);
  });
});
