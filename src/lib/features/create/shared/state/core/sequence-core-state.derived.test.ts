import { describe, it, expect } from "vitest";
import { createSequenceCoreState } from "./sequence-core-state.svelte";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

describe("setCurrentSequence reconciles derived fields", () => {
  it("heals a stale alpha2/box step and derives state.gridMode (not trusts stored)", () => {
    const core = createSequenceCoreState();

    const staleStep = createStepData({
      stepNumber: 1,
      startPosition: GridPosition.ALPHA2, // STALE
      endPosition: GridPosition.ALPHA4, // STALE
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          startLocation: GridLocation.NORTHWEST,
          endLocation: GridLocation.NORTHEAST,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          startLocation: GridLocation.SOUTHWEST,
          endLocation: GridLocation.SOUTHEAST,
        }),
      },
    });

    const seq = {
      id: "s1",
      name: "t",
      word: "",
      steps: [staleStep],
      gridMode: GridMode.DIAMOND, // STALE — must NOT be trusted
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    core.setCurrentSequence(seq);

    // `core.gridMode` is the chokepoint's wiring proof: normalizeSequenceDerived
    // sets the sequence-level gridMode from the FIRST reconciled step. The stale
    // stored value was DIAMOND; seeing BOX proves the step was reconciled
    // (nw/sw intercardinal → box) and the stored value was NOT trusted.
    // (core.currentSequence is a $derived getter that does not recompute outside
    // a reactive root, so per-step positions are asserted in the unit tests for
    // reconcileStepDerived / normalizeSequenceDerived.)
    expect(core.gridMode).toBe(GridMode.BOX);
  });

  it("setting null clears state without throwing", () => {
    const core = createSequenceCoreState();
    core.setCurrentSequence(null);
    expect(core.currentSequence).toBeNull();
  });
});
