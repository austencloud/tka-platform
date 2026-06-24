import { describe, it, expect } from "vitest";
import { deriveSteps, deriveStartPosition } from "$lib/shared/foundation/services/step-deriver";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  Orientation,
  MotionType,
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/solo-prop-data";
import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/solo-prop-step-data";
import type { StepPairingData } from "$lib/shared/foundation/domain/models/step-pairing-data";

function makeStep(
  startLocation: GridLocation,
  endLocation: GridLocation,
  overrides: Partial<SoloPropStepData> = {}
): SoloPropStepData {
  return {
    startLocation,
    endLocation,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.OUT,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 1,
    duration: 1,
    ...overrides,
  };
}

function makeSoloProp(
  steps: SoloPropStepData[],
  startLocation: GridLocation = GridLocation.NORTH,
  startOrientation: Orientation = Orientation.IN
): SoloPropData {
  return {
    id: crypto.randomUUID(),
    steps,
    startLocation,
    startOrientation,
    contentHash: "stub",
    handPath: {
      id: crypto.randomUUID(),
      locations: [startLocation, ...steps.map((s) => s.endLocation)],
      contentHash: "stub",
      startLocation,
      endLocation: steps[steps.length - 1]?.endLocation ?? startLocation,
      length: steps.length + 1,
      bigrams: [],
      uniqueLocations: [startLocation],
      impliedGridMode: GridMode.DIAMOND,
      isClosed: false,
    },
    length: steps.length,
    bigrams: [],
    impliedGridMode: GridMode.DIAMOND,
  };
}

function makePairing(overrides: Partial<StepPairingData> = {}): StepPairingData {
  return {
    letter: Letter.A,
    blueReversal: false,
    redReversal: false,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.BETA1,
    ...overrides,
  };
}

describe("StepDeriver", () => {

  describe("deriveSteps — basic structure", () => {
    it("returns one StepData per pairing", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep, blueStep]);
      const red = makeSoloProp([redStep, redStep]);
      const pairings = [makePairing(), makePairing({ letter: Letter.B })];

      const steps = deriveSteps(blue, red, pairings);

      expect(steps).toHaveLength(2);
    });

    it("assigns 1-indexed stepNumbers", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep, blueStep, blueStep]);
      const red = makeSoloProp([redStep, redStep, redStep]);
      const pairings = [makePairing(), makePairing(), makePairing()];

      const steps = deriveSteps(blue, red, pairings);

      expect(steps[0]!.stepNumber).toBe(1);
      expect(steps[1]!.stepNumber).toBe(2);
      expect(steps[2]!.stepNumber).toBe(3);
    });

    it("transfers letter, startPosition, endPosition from pairing", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);
      const pairings = [
        makePairing({
          letter: Letter.C,
          startPosition: GridPosition.GAMMA1,
          endPosition: GridPosition.GAMMA5,
        }),
      ];

      const [step] = deriveSteps(blue, red, pairings);

      expect(step!.letter).toBe(Letter.C);
      expect(step!.startPosition).toBe(GridPosition.GAMMA1);
      expect(step!.endPosition).toBe(GridPosition.GAMMA5);
    });

    it("transfers blueReversal and redReversal from pairing", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);
      const pairings = [makePairing({ blueReversal: true, redReversal: false })];

      const [step] = deriveSteps(blue, red, pairings);

      expect(step!.blueReversal).toBe(true);
      expect(step!.redReversal).toBe(false);
    });

    it("sets isBlank to false and isStep to true", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.isBlank).toBe(false);
      expect(step!.isStep).toBe(true);
    });

    it("assigns a unique id per step", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep, blueStep]);
      const red = makeSoloProp([redStep, redStep]);
      const pairings = [makePairing(), makePairing()];

      const steps = deriveSteps(blue, red, pairings);

      expect(steps[0]!.id).not.toBe(steps[1]!.id);
    });
  });

  describe("deriveSteps — duration", () => {
    it("uses blue duration, ignoring red when they differ", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST, { duration: 3 });
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST, { duration: 7 });

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.duration).toBe(3);
    });

    it("preserves blue duration when both agree", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST, { duration: 2 });
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST, { duration: 2 });

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.duration).toBe(2);
    });
  });

  describe("deriveSteps — motion rehydration", () => {
    it("produces blue and red motions with correct colors", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.motions.blue?.color).toBe(MotionColor.BLUE);
      expect(step!.motions.red?.color).toBe(MotionColor.RED);
    });

    it("copies startLocation / endLocation from each solo prop step", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.motions.blue?.startLocation).toBe(GridLocation.NORTH);
      expect(step!.motions.blue?.endLocation).toBe(GridLocation.EAST);
      expect(step!.motions.red?.startLocation).toBe(GridLocation.SOUTH);
      expect(step!.motions.red?.endLocation).toBe(GridLocation.WEST);
    });

    it("applies viewerPrefs propType to both motions", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()], {
        bluePropType: PropType.FAN,
        redPropType: PropType.FAN,
        catDogMode: false,
      });

      expect(step!.motions.blue?.propType).toBe(PropType.FAN);
      expect(step!.motions.red?.propType).toBe(PropType.FAN);
    });

    it("defaults propType to STAFF when viewerPrefs not provided", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.motions.blue?.propType).toBe(PropType.STAFF);
      expect(step!.motions.red?.propType).toBe(PropType.STAFF);
    });

    it("sets isVisible true on both motions", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.motions.blue?.isVisible).toBe(true);
      expect(step!.motions.red?.isVisible).toBe(true);
    });
  });

  describe("deriveSteps — grid mode derivation", () => {
    it("derives DIAMOND when all four locations are cardinal", () => {
      // N, E, S, W are all cardinal
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.gridMode).toBe(GridMode.DIAMOND);
      expect(step!.motions.blue?.gridMode).toBe(GridMode.DIAMOND);
      expect(step!.motions.red?.gridMode).toBe(GridMode.DIAMOND);
    });

    it("derives BOX when all four locations are intercardinal", () => {
      // NE, SE, SW, NW are all intercardinal
      const blueStep = makeStep(GridLocation.NORTHEAST, GridLocation.SOUTHEAST);
      const redStep = makeStep(GridLocation.SOUTHWEST, GridLocation.NORTHWEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.gridMode).toBe(GridMode.BOX);
    });

    it("derives SKEWED when locations are a mix of cardinal and intercardinal", () => {
      // N (cardinal) + NE (intercardinal) → SKEWED
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.NORTHEAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.SOUTHWEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.gridMode).toBe(GridMode.SKEWED);
    });

    it("derives CENTRIC when any location is CENTER", () => {
      const blueStep = makeStep(GridLocation.CENTER, GridLocation.NORTH);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.gridMode).toBe(GridMode.CENTRIC);
    });

    it("applies the same gridMode to both motions in a step", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.NORTHEAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.SOUTHWEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);

      const [step] = deriveSteps(blue, red, [makePairing()]);

      expect(step!.motions.blue?.gridMode).toBe(step!.gridMode);
      expect(step!.motions.red?.gridMode).toBe(step!.gridMode);
    });
  });

  describe("deriveSteps — length mismatch guard", () => {
    it("throws when blue steps count does not match pairings count", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep, blueStep]);
      const red = makeSoloProp([redStep]);
      const pairings = [makePairing()];

      expect(() => deriveSteps(blue, red, pairings)).toThrow();
    });
  });

  describe("deriveStartPosition", () => {
    it("returns an object with isStartPosition true", () => {
      const blue = makeSoloProp([], GridLocation.NORTH, Orientation.IN);
      const red = makeSoloProp([], GridLocation.SOUTH, Orientation.OUT);

      const startPos = deriveStartPosition(blue, red);

      expect(startPos.isStartPosition).toBe(true);
    });

    it("produces STATIC motions for both colors", () => {
      const blue = makeSoloProp([], GridLocation.NORTH, Orientation.IN);
      const red = makeSoloProp([], GridLocation.SOUTH, Orientation.OUT);

      const startPos = deriveStartPosition(blue, red);

      expect(startPos.motions.blue?.motionType).toBe(MotionType.STATIC);
      expect(startPos.motions.red?.motionType).toBe(MotionType.STATIC);
    });

    it("uses solo prop startLocation for both start and end of each motion", () => {
      const blue = makeSoloProp([], GridLocation.EAST, Orientation.IN);
      const red = makeSoloProp([], GridLocation.WEST, Orientation.OUT);

      const startPos = deriveStartPosition(blue, red);

      expect(startPos.motions.blue?.startLocation).toBe(GridLocation.EAST);
      expect(startPos.motions.blue?.endLocation).toBe(GridLocation.EAST);
      expect(startPos.motions.red?.startLocation).toBe(GridLocation.WEST);
      expect(startPos.motions.red?.endLocation).toBe(GridLocation.WEST);
    });

    it("carries the solo prop startOrientation onto the motion", () => {
      const blue = makeSoloProp([], GridLocation.NORTH, Orientation.CLOCK);
      const red = makeSoloProp([], GridLocation.SOUTH, Orientation.COUNTER);

      const startPos = deriveStartPosition(blue, red);

      expect(startPos.motions.blue?.startOrientation).toBe(Orientation.CLOCK);
      expect(startPos.motions.red?.startOrientation).toBe(Orientation.COUNTER);
    });

    it("derives DIAMOND gridMode when both start locations are cardinal", () => {
      const blue = makeSoloProp([], GridLocation.NORTH, Orientation.IN);
      const red = makeSoloProp([], GridLocation.SOUTH, Orientation.OUT);

      const startPos = deriveStartPosition(blue, red);

      expect(startPos.gridMode).toBe(GridMode.DIAMOND);
    });

    it("assigns a unique id each call", () => {
      const blue = makeSoloProp([], GridLocation.NORTH, Orientation.IN);
      const red = makeSoloProp([], GridLocation.SOUTH, Orientation.OUT);

      const sp1 = deriveStartPosition(blue, red);
      const sp2 = deriveStartPosition(blue, red);

      expect(sp1.id).not.toBe(sp2.id);
    });

    it("sets gridPosition to null (position-lookup is out of scope)", () => {
      const blue = makeSoloProp([], GridLocation.NORTH, Orientation.IN);
      const red = makeSoloProp([], GridLocation.SOUTH, Orientation.OUT);

      const startPos = deriveStartPosition(blue, red);

      expect(startPos.gridPosition).toBeNull();
    });
  });

  describe("deriveSteps — float prefloat preservation", () => {
    it("preserves prefloatMotionType on a float blue motion", () => {
      const blueFloat = makeStep(GridLocation.SOUTH, GridLocation.EAST, {
        motionType: MotionType.FLOAT,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: "fl",
        prefloatMotionType: MotionType.PRO,
      });
      const redAnti = makeStep(GridLocation.SOUTH, GridLocation.EAST, {
        motionType: MotionType.ANTI,
        rotationDirection: RotationDirection.CLOCKWISE,
        turns: 0.5,
      });

      const blue = makeSoloProp([blueFloat]);
      const red = makeSoloProp([redAnti]);
      const pairings = [makePairing({ letter: Letter.I })];

      const steps = deriveSteps(blue, red, pairings);

      expect(steps[0]!.motions.blue.prefloatMotionType).toBe(MotionType.PRO);
    });

    it("derives prefloatRotationDirection from prefloat type + handpath (pro on s→e = ccw)", () => {
      const blueFloat = makeStep(GridLocation.SOUTH, GridLocation.EAST, {
        motionType: MotionType.FLOAT,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: "fl",
        prefloatMotionType: MotionType.PRO,
      });
      const redAnti = makeStep(GridLocation.SOUTH, GridLocation.EAST, {
        motionType: MotionType.ANTI,
        rotationDirection: RotationDirection.CLOCKWISE,
        turns: 0.5,
      });

      const blue = makeSoloProp([blueFloat]);
      const red = makeSoloProp([redAnti]);
      const pairings = [makePairing({ letter: Letter.I })];

      const steps = deriveSteps(blue, red, pairings);

      expect(steps[0]!.motions.blue.prefloatRotationDirection).toBe(
        RotationDirection.COUNTER_CLOCKWISE
      );
    });

    it("derives prefloatRotationDirection as cw when prefloat is anti on a ccw handpath", () => {
      const blueFloat = makeStep(GridLocation.SOUTH, GridLocation.EAST, {
        motionType: MotionType.FLOAT,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: "fl",
        prefloatMotionType: MotionType.ANTI,
      });
      const redPro = makeStep(GridLocation.SOUTH, GridLocation.EAST, {
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        turns: 1,
      });

      const blue = makeSoloProp([blueFloat]);
      const red = makeSoloProp([redPro]);
      const pairings = [makePairing({ letter: Letter.I })];

      const steps = deriveSteps(blue, red, pairings);

      expect(steps[0]!.motions.blue.prefloatRotationDirection).toBe(
        RotationDirection.CLOCKWISE
      );
    });

    it("leaves prefloat fields undefined when motionType is not float", () => {
      const blueStep = makeStep(GridLocation.NORTH, GridLocation.EAST);
      const redStep = makeStep(GridLocation.SOUTH, GridLocation.WEST);

      const blue = makeSoloProp([blueStep]);
      const red = makeSoloProp([redStep]);
      const pairings = [makePairing()];

      const steps = deriveSteps(blue, red, pairings);

      expect(steps[0]!.motions.blue.prefloatMotionType).toBeUndefined();
      expect(steps[0]!.motions.blue.prefloatRotationDirection).toBeUndefined();
    });
  });
});
