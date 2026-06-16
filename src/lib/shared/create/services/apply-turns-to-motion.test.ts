import { describe, it, expect, vi } from "vitest";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

// Deterministic orientation: "in" at 0 turns, "out" otherwise — lets us assert
// that turns flow through to an end-orientation recompute.
vi.mock("$lib/shared/pictograph/prop/services/orientation-calculator", () => ({
  calculateEndOrientation: (m: { turns: number | "fl" }) =>
    m.turns === 0 || m.turns === "fl" ? "in" : "out",
}));

import { applyPendingTurnsToOption } from "./apply-turns-to-motion";

function makeOption(): PictographData {
  return {
    letter: "A",
    motions: {
      blue: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "s",
        endLocation: "e",
      }),
      red: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "n",
        endLocation: "w",
      }),
    },
  } as unknown as PictographData;
}

describe("applyPendingTurnsToOption", () => {
  it("applies turns per hand and recomputes end orientation", () => {
    const result = applyPendingTurnsToOption(makeOption(), 1, 0);
    expect(result.motions.blue!.turns).toBe(1);
    expect(result.motions.blue!.endOrientation).toBe("out");
    expect(result.motions.red!.turns).toBe(0);
    expect(result.motions.red!.endOrientation).toBe("in");
  });

  it("returns a new object and does not mutate the input", () => {
    const input = makeOption();
    const result = applyPendingTurnsToOption(input, 1, 1);
    expect(result).not.toBe(input);
    expect(input.motions.blue!.turns).toBe(0);
  });

  it("returns the option unchanged when a motion is missing", () => {
    const input = { letter: "A", motions: { blue: undefined, red: undefined } } as unknown as PictographData;
    expect(applyPendingTurnsToOption(input, 1, 1)).toBe(input);
  });
});
