/**
 * Fork Detection Scenario Tests
 *
 * EARNED TESTS: Fork detection failing would be silent data corruption.
 * If a hash collision goes undetected, an edit to a sequence silently
 * overwrites the original instead of creating a new variation (fork).
 * If two identical sequences hash differently, phantom forks accumulate.
 *
 * These tests exercise the real SequenceContentHasher against realistic
 * editing scenarios to verify the fork/no-fork decision boundary is correct.
 *
 * The decision logic in LibraryRepository.saveSequence():
 *   forks  → incomingHash && existingHash && existingHash !== incomingHash
 *   passes → any other case (legacy doc without hash, same hash, etc.)
 */

import { describe, it, expect } from "vitest";
import { SequenceContentHasher } from "$lib/features/library/services/implementations/SequenceContentHasher";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(id: string, overrides: Partial<StepData> = {}): StepData {
  return {
    id,
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
  } as StepData;
}

/**
 * A realistic 2-step sequence used as the baseline in most tests.
 */
function makeSequence(overrides: Partial<Parameters<typeof createSequenceData>[0]> = {}) {
  const step1 = makeStep("step-1", { stepNumber: 1 });
  const step2 = makeStep("step-2", {
    stepNumber: 2,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: MotionType.ANTI,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        startLocation: GridLocation.EAST,
        endLocation: GridLocation.SOUTH,
        turns: 1,
        startOrientation: Orientation.OUT,
        endOrientation: Orientation.IN,
        gridMode: GridMode.DIAMOND,
        color: MotionColor.BLUE,
      }),
      [MotionColor.RED]: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.WEST,
        endLocation: GridLocation.NORTH,
        turns: 1,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.OUT,
        gridMode: GridMode.DIAMOND,
        color: MotionColor.RED,
      }),
    },
  });

  return createSequenceData({
    name: "Test Sequence",
    word: "AB",
    steps: [step1, step2],
    tags: ["practice"],
    notes: "original",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Fork detection scenarios", () => {
  const hasher = new SequenceContentHasher();

  // -------------------------------------------------------------------------
  // Content changes → different hash → fork triggered
  // -------------------------------------------------------------------------

  it("editing a turn value produces a different hash (triggers fork)", async () => {
    const original = makeSequence();
    const originalHash = await hasher.computeHash(original);

    // Edit: bump blue turns on step 1 from 1 → 2
    const step1Edited = makeStep("step-1", {
      stepNumber: 1,
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

    const edited = createSequenceData({
      ...original,
      steps: [step1Edited, original.steps[1]!],
    });
    const editedHash = await hasher.computeHash(edited);

    expect(editedHash).not.toBe(originalHash);
  });

  it("editing motion type produces a different hash (triggers fork)", async () => {
    const original = makeSequence();
    const originalHash = await hasher.computeHash(original);

    // Edit: change blue motionType on step 1 from PRO → ANTI
    const step1Edited = makeStep("step-1", {
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          motionType: MotionType.ANTI, // changed
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
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
    });

    const edited = createSequenceData({
      ...original,
      steps: [step1Edited, original.steps[1]!],
    });
    const editedHash = await hasher.computeHash(edited);

    expect(editedHash).not.toBe(originalHash);
  });

  it("adding a step produces a different hash (triggers fork)", async () => {
    // Start with a 1-step sequence
    const oneStep = createSequenceData({
      name: "One Step",
      word: "A",
      steps: [makeStep("step-1", { stepNumber: 1 })],
    });
    const oneStepHash = await hasher.computeHash(oneStep);

    // Add a second step
    const newStep = makeStep("step-2", {
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

    const twoStep = createSequenceData({
      ...oneStep,
      steps: [...oneStep.steps, newStep],
    });
    const twoStepHash = await hasher.computeHash(twoStep);

    expect(twoStepHash).not.toBe(oneStepHash);
  });

  // -------------------------------------------------------------------------
  // Metadata-only changes → same hash → no fork
  // -------------------------------------------------------------------------

  it("changing only name does NOT change hash (no fork)", async () => {
    const original = makeSequence({ name: "My Sequence" });
    const renamed = createSequenceData({ ...original, name: "A Different Name" });

    const originalHash = await hasher.computeHash(original);
    const renamedHash = await hasher.computeHash(renamed);

    expect(renamedHash).toBe(originalHash);
  });

  it("changing only visibility/notes does NOT change hash (no fork)", async () => {
    // Both sequences have identical motion content; only notes differ.
    // Notes are user annotations, not part of the motion identity.
    const withNotes = makeSequence({ notes: "for the competition" });
    const withoutNotes = createSequenceData({ ...withNotes, notes: undefined });

    const hashWith = await hasher.computeHash(withNotes);
    const hashWithout = await hasher.computeHash(withoutNotes);

    expect(hashWith).toBe(hashWithout);
  });

  it("changing only tags does NOT change hash (no fork)", async () => {
    const withTags = makeSequence({ tags: ["favorite", "performance", "competition"] });
    const withDifferentTags = createSequenceData({ ...withTags, tags: [] });

    const hashWithTags = await hasher.computeHash(withTags);
    const hashWithDifferentTags = await hasher.computeHash(withDifferentTags);

    expect(hashWithTags).toBe(hashWithDifferentTags);
  });

  // -------------------------------------------------------------------------
  // Legacy sequence handling — pure condition logic test
  // -------------------------------------------------------------------------

  it("legacy sequence without stored hash gets treated as metadata update (no fork)", () => {
    // The fork condition in LibraryRepository.saveSequence() is:
    //   incomingHash && existingHash && existingHash !== incomingHash
    //
    // When existingHash is undefined (legacy doc), the condition short-circuits
    // to false regardless of incomingHash. This test verifies that logic directly.

    const incomingHash = "abc123def456";
    const existingHashLegacy: string | undefined = undefined;
    const existingHashPresent = "zzz999yyy888";

    const shouldFork = (incoming: string | undefined, existing: string | undefined): boolean =>
      !!(incoming && existing && existing !== incoming);

    // Legacy doc: no stored hash → no fork, even if content changed
    expect(shouldFork(incomingHash, existingHashLegacy)).toBe(false);

    // Same hash → no fork
    expect(shouldFork(incomingHash, incomingHash)).toBe(false);

    // Different hashes, both present → fork
    expect(shouldFork(incomingHash, existingHashPresent)).toBe(true);

    // No incoming hash (shouldn't happen in practice) → no fork
    expect(shouldFork(undefined, existingHashPresent)).toBe(false);
  });
});
