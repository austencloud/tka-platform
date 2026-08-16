import { describe, expect, it } from "vitest";
import { clampLanesToLevel } from "../turn-pattern-data";

describe("clampLanesToLevel", () => {
  it("rounds a half turn to a whole one when dropping to level 2", () => {
    // A half sits exactly between two whole turns, and the tie goes down — the
    // same choice `clampTurnToLevel` already makes for the single-value stepper,
    // so a level drop never hands back more turning than was drawn.
    expect(clampLanesToLevel({ blue: [0.5, 1.5, 2], red: [2.5] }, 2, 3)).toEqual({
      blue: [0, 1, 2],
      red: [2],
    });
  });

  it("brings a turn down under a lowered intensity cap", () => {
    expect(clampLanesToLevel({ blue: [3, 1], red: [2] }, 2, 1)).toEqual({
      blue: [1, 1],
      red: [1],
    });
  });

  it("turns a float into no turn at all below level 3", () => {
    // Level 2 has no float, and rounding it to a spin would invent a value the
    // user never drew.
    expect(clampLanesToLevel({ blue: ["fl"], red: [0] }, 2, 3)).toEqual({
      blue: [0],
      red: [0],
    });
  });

  it("leaves a level 3 pattern alone", () => {
    const lanes = { blue: [0.5, "fl" as const], red: [1.5] };
    expect(clampLanesToLevel(lanes, 3, 3)).toEqual(lanes);
  });
});
