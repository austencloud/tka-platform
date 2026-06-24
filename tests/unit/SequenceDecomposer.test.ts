import { describe, it, expect } from "vitest";
import {
  extractBlueSoloProp,
  extractRedSoloProp,
  extractStepPairings,
} from "$lib/shared/foundation/services/sequence-decomposer";
import { deriveSteps } from "$lib/shared/foundation/services/step-deriver";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  Orientation,
  MotionType,
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";

function makeMotion(
  startLocation: GridLocation,
  endLocation: GridLocation,
  color: MotionColor,
  overrides: Parameters<typeof createMotionData>[0] = {}
) {
  return createMotionData({
    startLocation,
    endLocation,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.OUT,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 1,
    color,
    propType: PropType.STAFF,
    isVisible: true,
    arrowLocation: startLocation,
    ...overrides,
  });
}

function makeStep(
  blueStart: GridLocation,
  blueEnd: GridLocation,
  redStart: GridLocation,
  redEnd: GridLocation,
  overrides: Partial<StepData> = {}
): StepData {
  return {
    id: crypto.randomUUID(),
    letter: Letter.A,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.BETA1,
    motions: {
      blue: makeMotion(blueStart, blueEnd, MotionColor.BLUE),
      red: makeMotion(redStart, redEnd, MotionColor.RED),
    },
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    isStep: true,
    ...overrides,
  };
}

function makeStartPosition(
  blueLocation: GridLocation,
  redLocation: GridLocation,
  blueOrientation: Orientation = Orientation.IN,
  redOrientation: Orientation = Orientation.OUT
): StartPositionData {
  return {
    id: crypto.randomUUID(),
    isStartPosition: true,
    gridPosition: GridPosition.ALPHA1,
    motions: {
      blue: createMotionData({
        startLocation: blueLocation,
        endLocation: blueLocation,
        startOrientation: blueOrientation,
        endOrientation: blueOrientation,
        motionType: MotionType.STATIC,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.BLUE,
        propType: PropType.STAFF,
        isVisible: true,
        arrowLocation: blueLocation,
      }),
      red: createMotionData({
        startLocation: redLocation,
        endLocation: redLocation,
        startOrientation: redOrientation,
        endOrientation: redOrientation,
        motionType: MotionType.STATIC,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.RED,
        propType: PropType.STAFF,
        isVisible: true,
        arrowLocation: redLocation,
      }),
    },
  };
}

/**
 * Builds a two-step SequenceData with both a start position and two beats.
 *
 * Beat 1: blue N→E (PRO, CW, 1 turn), red S→W (PRO, CW, 1 turn)
 * Beat 2: blue E→S (ANTI, CCW, 1 turn), red W→N (ANTI, CCW, 1 turn)
 */
function createTestSequence() {
  const step1 = makeStep(
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
    { stepNumber: 1, letter: Letter.A }
  );

  const step2 = makeStep(
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
    GridLocation.NORTH,
    {
      stepNumber: 2,
      letter: Letter.B,
      blueReversal: true,
      redReversal: false,
      startPosition: GridPosition.BETA1,
      endPosition: GridPosition.GAMMA1,
      motions: {
        blue: makeMotion(GridLocation.EAST, GridLocation.SOUTH, MotionColor.BLUE, {
          motionType: MotionType.ANTI,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        }),
        red: makeMotion(GridLocation.WEST, GridLocation.NORTH, MotionColor.RED, {
          motionType: MotionType.ANTI,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        }),
      },
    }
  );

  const startPos = makeStartPosition(
    GridLocation.NORTH,
    GridLocation.SOUTH,
    Orientation.IN,
    Orientation.OUT
  );

  return createSequenceData({
    steps: [step1, step2],
    startPosition: startPos,
    word: "AB",
  });
}

describe("SequenceDecomposer — extractBlueSoloProp", () => {
  it("returns a SoloPropData with one step per sequence step", () => {
    const sequence = createTestSequence();
    const blue = extractBlueSoloProp(sequence);
    expect(blue.steps).toHaveLength(sequence.steps.length);
  });

  it("preserves blue startLocation from startPosition", () => {
    const sequence = createTestSequence();
    const blue = extractBlueSoloProp(sequence);
    expect(blue.startLocation).toBe(GridLocation.NORTH);
  });

  it("preserves blue startOrientation from startPosition", () => {
    const sequence = createTestSequence();
    const blue = extractBlueSoloProp(sequence);
    expect(blue.startOrientation).toBe(Orientation.IN);
  });

  it("captures step motionType correctly", () => {
    const sequence = createTestSequence();
    const blue = extractBlueSoloProp(sequence);
    expect(blue.steps[0]?.motionType).toBe(MotionType.PRO);
    expect(blue.steps[1]?.motionType).toBe(MotionType.ANTI);
  });

  it("captures step locations correctly", () => {
    const sequence = createTestSequence();
    const blue = extractBlueSoloProp(sequence);
    expect(blue.steps[0]?.startLocation).toBe(GridLocation.NORTH);
    expect(blue.steps[0]?.endLocation).toBe(GridLocation.EAST);
    expect(blue.steps[1]?.startLocation).toBe(GridLocation.EAST);
    expect(blue.steps[1]?.endLocation).toBe(GridLocation.SOUTH);
  });

  it("captures step duration from the original StepData", () => {
    const step = makeStep(
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
      { duration: 3 }
    );
    const sequence = createSequenceData({ steps: [step], word: "A" });
    const blue = extractBlueSoloProp(sequence);
    expect(blue.steps[0]?.duration).toBe(3);
  });

  it("falls back to first step motion when startPosition is absent", () => {
    const step = makeStep(
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.NORTH
    );
    const sequence = createSequenceData({ steps: [step], word: "A" });
    const blue = extractBlueSoloProp(sequence);
    // Falls back to step[0].motions.blue.startLocation
    expect(blue.startLocation).toBe(GridLocation.EAST);
  });
});

describe("SequenceDecomposer — extractRedSoloProp", () => {
  it("returns a SoloPropData with one step per sequence step", () => {
    const sequence = createTestSequence();
    const red = extractRedSoloProp(sequence);
    expect(red.steps).toHaveLength(sequence.steps.length);
  });

  it("preserves red startLocation from startPosition", () => {
    const sequence = createTestSequence();
    const red = extractRedSoloProp(sequence);
    expect(red.startLocation).toBe(GridLocation.SOUTH);
  });

  it("preserves red startOrientation from startPosition", () => {
    const sequence = createTestSequence();
    const red = extractRedSoloProp(sequence);
    expect(red.startOrientation).toBe(Orientation.OUT);
  });

  it("captures correct step locations for red", () => {
    const sequence = createTestSequence();
    const red = extractRedSoloProp(sequence);
    expect(red.steps[0]?.startLocation).toBe(GridLocation.SOUTH);
    expect(red.steps[0]?.endLocation).toBe(GridLocation.WEST);
    expect(red.steps[1]?.startLocation).toBe(GridLocation.WEST);
    expect(red.steps[1]?.endLocation).toBe(GridLocation.NORTH);
  });
});

describe("SequenceDecomposer — extractStepPairings", () => {
  it("returns one pairing per step", () => {
    const sequence = createTestSequence();
    const pairings = extractStepPairings(sequence);
    expect(pairings).toHaveLength(sequence.steps.length);
  });

  it("preserves letter from each step", () => {
    const sequence = createTestSequence();
    const pairings = extractStepPairings(sequence);
    expect(pairings[0]?.letter).toBe(Letter.A);
    expect(pairings[1]?.letter).toBe(Letter.B);
  });

  it("preserves blueReversal and redReversal", () => {
    const sequence = createTestSequence();
    const pairings = extractStepPairings(sequence);
    // Step 2 has blueReversal: true, redReversal: false
    expect(pairings[1]?.blueReversal).toBe(true);
    expect(pairings[1]?.redReversal).toBe(false);
  });

  it("preserves startPosition and endPosition", () => {
    const sequence = createTestSequence();
    const pairings = extractStepPairings(sequence);
    expect(pairings[1]?.startPosition).toBe(GridPosition.BETA1);
    expect(pairings[1]?.endPosition).toBe(GridPosition.GAMMA1);
  });

  it("converts undefined letter to null", () => {
    const step = makeStep(
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
      { letter: undefined }
    );
    const sequence = createSequenceData({ steps: [step], word: "" });
    const pairings = extractStepPairings(sequence);
    expect(pairings[0]?.letter).toBeNull();
  });
});

describe("SequenceDecomposer — round-trip", () => {
  it("decompose then deriveSteps produces domain-equivalent steps", () => {
    const original = createTestSequence();

    const blue = extractBlueSoloProp(original);
    const red = extractRedSoloProp(original);
    const pairings = extractStepPairings(original);

    const derived = deriveSteps(blue, red, pairings);

    expect(derived).toHaveLength(original.steps.length);

    for (let i = 0; i < original.steps.length; i++) {
      const orig = original.steps[i]!;
      const deriv = derived[i]!;

      // Pairing fields
      expect(deriv.letter).toBe(orig.letter);
      expect(deriv.blueReversal).toBe(orig.blueReversal);
      expect(deriv.redReversal).toBe(orig.redReversal);

      // Blue motion geometry
      expect(deriv.motions.blue?.startLocation).toBe(orig.motions.blue?.startLocation);
      expect(deriv.motions.blue?.endLocation).toBe(orig.motions.blue?.endLocation);
      expect(deriv.motions.blue?.motionType).toBe(orig.motions.blue?.motionType);
      expect(deriv.motions.blue?.rotationDirection).toBe(orig.motions.blue?.rotationDirection);
      expect(deriv.motions.blue?.turns).toBe(orig.motions.blue?.turns);
      expect(deriv.motions.blue?.startOrientation).toBe(orig.motions.blue?.startOrientation);
      expect(deriv.motions.blue?.endOrientation).toBe(orig.motions.blue?.endOrientation);

      // Red motion geometry
      expect(deriv.motions.red?.startLocation).toBe(orig.motions.red?.startLocation);
      expect(deriv.motions.red?.endLocation).toBe(orig.motions.red?.endLocation);
      expect(deriv.motions.red?.motionType).toBe(orig.motions.red?.motionType);
      expect(deriv.motions.red?.rotationDirection).toBe(orig.motions.red?.rotationDirection);
      expect(deriv.motions.red?.turns).toBe(orig.motions.red?.turns);
      expect(deriv.motions.red?.startOrientation).toBe(orig.motions.red?.startOrientation);
      expect(deriv.motions.red?.endOrientation).toBe(orig.motions.red?.endOrientation);
    }
  });

  it("duration is preserved through the round-trip (blue is authoritative)", () => {
    const step1 = makeStep(
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
      { duration: 2 }
    );
    const step2 = makeStep(
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.NORTH,
      { duration: 4 }
    );

    const sequence = createSequenceData({ steps: [step1, step2], word: "AB" });

    const blue = extractBlueSoloProp(sequence);
    const red = extractRedSoloProp(sequence);
    const pairings = extractStepPairings(sequence);
    const derived = deriveSteps(blue, red, pairings);

    expect(derived[0]?.duration).toBe(2);
    expect(derived[1]?.duration).toBe(4);
  });

  it("handles sequences with turns=0 (static motion)", () => {
    const step = makeStep(
      GridLocation.NORTH,
      GridLocation.NORTH,
      GridLocation.SOUTH,
      GridLocation.SOUTH,
      {
        motions: {
          blue: makeMotion(GridLocation.NORTH, GridLocation.NORTH, MotionColor.BLUE, {
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            turns: 0,
          }),
          red: makeMotion(GridLocation.SOUTH, GridLocation.SOUTH, MotionColor.RED, {
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            turns: 0,
          }),
        },
      }
    );

    const sequence = createSequenceData({ steps: [step], word: "S" });

    const blue = extractBlueSoloProp(sequence);
    const red = extractRedSoloProp(sequence);
    const pairings = extractStepPairings(sequence);
    const derived = deriveSteps(blue, red, pairings);

    expect(derived[0]?.motions.blue?.motionType).toBe(MotionType.STATIC);
    expect(derived[0]?.motions.blue?.turns).toBe(0);
    expect(derived[0]?.motions.red?.motionType).toBe(MotionType.STATIC);
    expect(derived[0]?.motions.red?.turns).toBe(0);
  });
});
