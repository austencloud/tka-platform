/**
 * SequenceComposer Tests
 *
 * Combining two SoloPropData objects into a SequenceData is the load-bearing
 * operation in the compositional sequence model. A mismatch in step counts,
 * missing hashes, or dropped metadata would silently corrupt every sequence
 * created through this path. These tests pin that contract.
 */

import { describe, it, expect } from "vitest";
import { SequenceComposer } from "$lib/shared/foundation/services/implementations/SequenceComposer";
import { StepDeriver } from "$lib/shared/foundation/services/implementations/StepDeriver";
import { ContentHasher } from "$lib/shared/foundation/services/implementations/ContentHasher";
import { HandPathFactory } from "$lib/shared/foundation/services/implementations/HandPathFactory";
import { SoloPropFactory } from "$lib/shared/foundation/services/implementations/SoloPropFactory";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  Orientation,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/SoloPropStepData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared service instances
// ---------------------------------------------------------------------------

const hasher = new ContentHasher();
const handPathFactory = new HandPathFactory(hasher);
const soloPropFactory = new SoloPropFactory(handPathFactory, hasher);
const stepDeriver = new StepDeriver();
const composer = new SequenceComposer(stepDeriver, hasher);

// ---------------------------------------------------------------------------
// Standard two-step solo props used across multiple tests
// ---------------------------------------------------------------------------

const blueStep1 = makeStep(GridLocation.NORTH, GridLocation.EAST);
const blueStep2 = makeStep(GridLocation.EAST, GridLocation.SOUTH);
const redStep1 = makeStep(GridLocation.SOUTH, GridLocation.WEST);
const redStep2 = makeStep(GridLocation.WEST, GridLocation.NORTH);

const twoStepBlue = soloPropFactory.create(
  [blueStep1, blueStep2],
  GridLocation.NORTH,
  Orientation.IN
);

const twoStepRed = soloPropFactory.create(
  [redStep1, redStep2],
  GridLocation.SOUTH,
  Orientation.OUT
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SequenceComposer", () => {
  // -------------------------------------------------------------------------
  // Basic output shape
  // -------------------------------------------------------------------------

  describe("combine — basic output shape", () => {
    it("returns a SequenceData when step counts match", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("produces a SequenceData with the correct number of steps", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.steps).toHaveLength(2);
    });

    it("sets word to empty string (letters are null until resolution pass)", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.word).toBe("");
    });

    it("assigns a unique id on each call", () => {
      const r1 = composer.combine({ blue: twoStepBlue, red: twoStepRed });
      const r2 = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(r1.id).not.toBe(r2.id);
    });
  });

  // -------------------------------------------------------------------------
  // Mismatch guard
  // -------------------------------------------------------------------------

  describe("combine — step count mismatch", () => {
    it("throws when blue has more steps than red", () => {
      const threeStepBlue = soloPropFactory.create(
        [blueStep1, blueStep2, makeStep(GridLocation.SOUTH, GridLocation.WEST)],
        GridLocation.NORTH,
        Orientation.IN
      );

      expect(() =>
        composer.combine({ blue: threeStepBlue, red: twoStepRed })
      ).toThrow();
    });

    it("throws when red has more steps than blue", () => {
      const threeStepRed = soloPropFactory.create(
        [redStep1, redStep2, makeStep(GridLocation.NORTH, GridLocation.EAST)],
        GridLocation.SOUTH,
        Orientation.OUT
      );

      expect(() =>
        composer.combine({ blue: twoStepBlue, red: threeStepRed })
      ).toThrow();
    });

    it("error message includes both step counts", () => {
      const oneStepBlue = soloPropFactory.create(
        [blueStep1],
        GridLocation.NORTH,
        Orientation.IN
      );

      let message = "";
      try {
        composer.combine({ blue: oneStepBlue, red: twoStepRed });
      } catch (err) {
        message = (err as Error).message;
      }

      expect(message).toContain("1");
      expect(message).toContain("2");
    });
  });

  // -------------------------------------------------------------------------
  // Compositional fields
  // -------------------------------------------------------------------------

  describe("combine — compositional fields", () => {
    it("stores the blue solo prop on the result", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.blueSoloProp).toBe(twoStepBlue);
    });

    it("stores the red solo prop on the result", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.redSoloProp).toBe(twoStepRed);
    });

    it("populates stepPairings with one entry per beat", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.stepPairings).toHaveLength(2);
    });

    it("initialises all pairing letters to null", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      for (const pairing of result.stepPairings!) {
        expect(pairing.letter).toBeNull();
      }
    });

    it("initialises all reversal flags to false", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      for (const pairing of result.stepPairings!) {
        expect(pairing.blueReversal).toBe(false);
        expect(pairing.redReversal).toBe(false);
      }
    });

    it("initialises all position fields to null", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      for (const pairing of result.stepPairings!) {
        expect(pairing.startPosition).toBeNull();
        expect(pairing.endPosition).toBeNull();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Content hashes
  // -------------------------------------------------------------------------

  describe("combine — content hashes", () => {
    it("stores bluePathHash matching the blue hand path contentHash", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.bluePathHash).toBe(twoStepBlue.handPath.contentHash);
    });

    it("stores redPathHash matching the red hand path contentHash", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.redPathHash).toBe(twoStepRed.handPath.contentHash);
    });

    it("stores blueSoloHash matching the blue solo prop contentHash", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.blueSoloHash).toBe(twoStepBlue.contentHash);
    });

    it("stores redSoloHash matching the red solo prop contentHash", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.redSoloHash).toBe(twoStepRed.contentHash);
    });

    it("hashes are non-empty strings", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(typeof result.bluePathHash).toBe("string");
      expect(result.bluePathHash!.length).toBeGreaterThan(0);
      expect(typeof result.redSoloHash).toBe("string");
      expect(result.redSoloHash!.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Backward-compatibility: steps array
  // -------------------------------------------------------------------------

  describe("combine — derived steps (backward compat)", () => {
    it("steps array has one entry per beat", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.steps).toHaveLength(2);
    });

    it("each step carries a unique id", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      const ids = result.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("steps are 1-indexed", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.steps[0]!.stepNumber).toBe(1);
      expect(result.steps[1]!.stepNumber).toBe(2);
    });

    it("steps have blue and red motions populated", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      for (const step of result.steps) {
        expect(step.motions.blue).toBeDefined();
        expect(step.motions.red).toBeDefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Metadata passthrough
  // -------------------------------------------------------------------------

  describe("combine — metadata passthrough", () => {
    it("passes through name when provided", () => {
      const result = composer.combine(
        { blue: twoStepBlue, red: twoStepRed },
        { name: "Test Sequence" }
      );

      expect(result.name).toBe("Test Sequence");
    });

    it("sets name to empty string when not provided", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.name).toBe("");
    });

    it("passes through author when provided", () => {
      const result = composer.combine(
        { blue: twoStepBlue, red: twoStepRed },
        { author: "austen" }
      );

      expect(result.author).toBe("austen");
    });

    it("leaves author undefined when not provided", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.author).toBeUndefined();
    });

    it("passes through notes when provided", () => {
      const result = composer.combine(
        { blue: twoStepBlue, red: twoStepRed },
        { notes: "Written for the fire jam" }
      );

      expect(result.notes).toBe("Written for the fire jam");
    });

    it("leaves notes undefined when not provided", () => {
      const result = composer.combine({ blue: twoStepBlue, red: twoStepRed });

      expect(result.notes).toBeUndefined();
    });

    it("accepts all three metadata fields together", () => {
      const result = composer.combine(
        { blue: twoStepBlue, red: twoStepRed },
        { name: "Full Meta", author: "austen", notes: "all three" }
      );

      expect(result.name).toBe("Full Meta");
      expect(result.author).toBe("austen");
      expect(result.notes).toBe("all three");
    });
  });
});
