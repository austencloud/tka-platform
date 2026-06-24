import { describe, it, expect } from "vitest";
import { combineSequence } from "$lib/shared/foundation/services/implementations/SequenceComposer";
import { createSoloProp } from "$lib/shared/foundation/services/solo-prop-factory";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  Orientation,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/solo-prop-step-data";

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


const blueStep1 = makeStep(GridLocation.NORTH, GridLocation.EAST);
const blueStep2 = makeStep(GridLocation.EAST, GridLocation.SOUTH);
const redStep1 = makeStep(GridLocation.SOUTH, GridLocation.WEST);
const redStep2 = makeStep(GridLocation.WEST, GridLocation.NORTH);

const twoStepBlue = createSoloProp(
  [blueStep1, blueStep2],
  GridLocation.NORTH,
  Orientation.IN
);

const twoStepRed = createSoloProp(
  [redStep1, redStep2],
  GridLocation.SOUTH,
  Orientation.OUT
);

describe("SequenceComposer", () => {
  describe("combine — basic output shape", () => {
    it("produces a SequenceData with the correct number of steps", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      expect(result.steps).toHaveLength(2);
    });

    it("sets word to empty string (letters are null until resolution pass)", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      expect(result.word).toBe("");
    });
  });

  describe("combine — step count mismatch", () => {
    it("throws when blue has more steps than red", () => {
      const threeStepBlue = createSoloProp(
        [blueStep1, blueStep2, makeStep(GridLocation.SOUTH, GridLocation.WEST)],
        GridLocation.NORTH,
        Orientation.IN
      );

      expect(() =>
        combineSequence({ blue: threeStepBlue, red: twoStepRed })
      ).toThrow();
    });

    it("throws when red has more steps than blue", () => {
      const threeStepRed = createSoloProp(
        [redStep1, redStep2, makeStep(GridLocation.NORTH, GridLocation.EAST)],
        GridLocation.SOUTH,
        Orientation.OUT
      );

      expect(() =>
        combineSequence({ blue: twoStepBlue, red: threeStepRed })
      ).toThrow();
    });

    it("error message includes both step counts", () => {
      const oneStepBlue = createSoloProp(
        [blueStep1],
        GridLocation.NORTH,
        Orientation.IN
      );

      let message = "";
      try {
        combineSequence({ blue: oneStepBlue, red: twoStepRed });
      } catch (err) {
        message = (err as Error).message;
      }

      expect(message).toContain("1");
      expect(message).toContain("2");
    });
  });

  describe("combine — content hashes", () => {
    it("stores bluePathHash matching the blue hand path contentHash", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      expect(result.bluePathHash).toBe(twoStepBlue.handPath.contentHash);
    });

    it("stores redPathHash matching the red hand path contentHash", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      expect(result.redPathHash).toBe(twoStepRed.handPath.contentHash);
    });

    it("stores blueSoloHash matching the blue solo prop contentHash", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      expect(result.blueSoloHash).toBe(twoStepBlue.contentHash);
    });

    it("stores redSoloHash matching the red solo prop contentHash", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      expect(result.redSoloHash).toBe(twoStepRed.contentHash);
    });
  });

  describe("combine — derived steps (backward compat)", () => {
    it("steps are 1-indexed", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      expect(result.steps[0]!.stepNumber).toBe(1);
      expect(result.steps[1]!.stepNumber).toBe(2);
    });

    it("steps have blue and red motions populated", () => {
      const result = combineSequence({ blue: twoStepBlue, red: twoStepRed });

      for (const step of result.steps) {
        expect(step.motions.blue).toBeDefined();
        expect(step.motions.red).toBeDefined();
      }
    });
  });
});
