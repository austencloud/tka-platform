import { describe, it, expect } from "vitest";
import { buildFlowerSequence } from "../build-flower-sequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

// Minimal two-hand archetype: one step, both hands pro, south start, in orientation.
function proArchetype(): SequenceData {
  const motion = (color: "blue" | "red") => ({
    motionType: "pro",
    rotationDirection: "cw",
    startLocation: "s",
    endLocation: "s",
    turns: 0,
    startOrientation: "in",
    endOrientation: "in",
    isVisible: true,
    propType: "staff",
    arrowLocation: "s",
    color,
    gridMode: "diamond",
    arrowPlacementData: {},
    propPlacementData: {},
  });
  const step = {
    id: "step-1",
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: { blue: motion("blue"), red: motion("red") },
    gridMode: "diamond",
  };
  return {
    id: "arch-pro",
    name: "arch",
    word: "A",
    steps: [step as any],
    thumbnails: [],
    isFavorite: false,
    isCircular: true,
    tags: [],
    metadata: {},
  } as unknown as SequenceData;
}

describe("buildFlowerSequence", () => {
  // Absence is encoded as an invisible placeholder, not a missing key: every
  // Step carries BOTH hands, and isVisibleMotion() is the presence predicate
  // (the StepData/Step unification — "absence = invisible placeholder"). The
  // stripped hand therefore stays on the step with isVisible: false.
  it("strips to the requested hand only", () => {
    const seq = buildFlowerSequence(proArchetype(), { style: "pro", turns: 1, ori: "in", grid: "diamond", petals: 2 }, "blue", []);
    const m = seq.steps[0]!.motions;
    expect(m.blue?.isVisible).toBe(true);
    expect(m.red?.isVisible).toBe(false);
  });

  it("tags the shown hand's prop as a club", () => {
    const seq = buildFlowerSequence(proArchetype(), { style: "pro", turns: 1, ori: "in", grid: "diamond", petals: 2 }, "blue", []);
    expect(seq.steps[0]!.motions.blue?.propType).toBe("club");
  });
});
