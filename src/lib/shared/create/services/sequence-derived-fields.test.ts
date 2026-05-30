import { describe, it, expect } from "vitest";
import {
  reconcileStepDerived,
  normalizeSequenceDerived,
} from "./sequence-derived-fields";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

function step(
  blue: { start: GridLocation; end: GridLocation },
  red: { start: GridLocation; end: GridLocation },
  stale: Partial<StepData> = {}
): StepData {
  return {
    ...createStepData({
      ...stale,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          startLocation: blue.start,
          endLocation: blue.end,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          startLocation: red.start,
          endLocation: red.end,
        }),
      },
    }),
    // createStepData drops gridMode — re-apply any stale gridMode the test set
    ...(stale.gridMode !== undefined ? { gridMode: stale.gridMode } : {}),
  } as StepData;
}

describe("reconcileStepDerived", () => {
  it("heals the canonical stale alpha2 → GAMMA14 box-M step", () => {
    // blue nw→ne, red sw→se; stale stored alpha2/alpha4 from a pre-edit seed
    const stale = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST },
      {
        startPosition: GridPosition.ALPHA2,
        endPosition: GridPosition.ALPHA4,
        letter: "M" as StepData["letter"],
      }
    );

    const fixed = reconcileStepDerived(stale);

    expect(fixed.startPosition).toBe(GridPosition.GAMMA14);
    expect(fixed.endPosition).toBe(GridPosition.GAMMA4);
    expect(fixed.gridMode).toBe(GridMode.BOX);
    // letter is Layer 2 (async) — reconcileStepDerived leaves it untouched here
    expect(fixed.letter).toBe("M");
  });

  it("derives DIAMOND + correct position for a cardinal pair", () => {
    const s = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.gridMode).toBe(GridMode.DIAMOND);
    expect(fixed.startPosition).toBe(GridPosition.ALPHA1);
  });

  it("derives SKEWED + zeta position for a mixed cardinal/intercardinal pair", () => {
    const s = step(
      { start: GridLocation.SOUTHWEST, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTHWEST }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.gridMode).toBe(GridMode.SKEWED);
    expect(fixed.startPosition).toBe(GridPosition.ZETA1);
  });

  it("stamps the derived gridMode onto both motions", () => {
    const s = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.motions[MotionColor.BLUE]?.gridMode).toBe(GridMode.BOX);
    expect(fixed.motions[MotionColor.RED]?.gridMode).toBe(GridMode.BOX);
  });

  it("preserves the step-level gridMode field (createStepData-drop trap)", () => {
    const s = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.gridMode).toBeDefined();
    expect(fixed.gridMode).toBe(GridMode.BOX);
  });

  it("is idempotent on already-correct data", () => {
    const s = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH }
    );
    const once = reconcileStepDerived(s);
    const twice = reconcileStepDerived(once);
    expect(twice.startPosition).toBe(once.startPosition);
    expect(twice.endPosition).toBe(once.endPosition);
    expect(twice.gridMode).toBe(once.gridMode);
  });

  it("keeps prior positions and does not throw on a corrupt location", () => {
    const s = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH },
      { startPosition: GridPosition.ALPHA1 }
    );
    // Corrupt blue start location → not a valid pair key
    const corrupt: StepData = {
      ...s,
      motions: {
        ...s.motions,
        [MotionColor.BLUE]: {
          ...s.motions[MotionColor.BLUE]!,
          startLocation: "xyz" as GridLocation,
        },
      },
    };
    expect(() => reconcileStepDerived(corrupt)).not.toThrow();
    const fixed = reconcileStepDerived(corrupt);
    expect(fixed.startPosition).toBe(GridPosition.ALPHA1); // prior kept
  });

  it("returns blank/incomplete steps unchanged", () => {
    const blank = createStepData({ isBlank: true });
    expect(reconcileStepDerived(blank)).toBe(blank);
    const oneHand = createStepData({
      motions: { [MotionColor.BLUE]: createMotionData({}) },
    });
    expect(reconcileStepDerived(oneHand)).toBe(oneHand);
  });
});

describe("normalizeSequenceDerived", () => {
  it("heals every step and sets sequence.gridMode from the reconciled steps", () => {
    const boxStep = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST },
      { startPosition: GridPosition.ALPHA2, stepNumber: 1 }
    );
    const seq = {
      id: "s1",
      name: "t",
      word: "",
      steps: [boxStep],
      gridMode: GridMode.DIAMOND, // STALE sequence-level value
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    const fixed = normalizeSequenceDerived(seq);

    expect(fixed.steps[0]!.startPosition).toBe(GridPosition.GAMMA14);
    expect(fixed.steps[0]!.gridMode).toBe(GridMode.BOX);
    expect(fixed.gridMode).toBe(GridMode.BOX); // sequence-level healed too
  });

  it("is a no-op (value-equal) on already-correct sequences", () => {
    const good = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH },
      { stepNumber: 1 }
    );
    const seq = {
      id: "s2",
      name: "t",
      word: "",
      steps: [good],
      gridMode: GridMode.DIAMOND,
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    const once = normalizeSequenceDerived(seq);
    const twice = normalizeSequenceDerived(once);
    expect(twice.steps[0]!.startPosition).toBe(once.steps[0]!.startPosition);
    expect(twice.gridMode).toBe(once.gridMode);
  });
});
