import { describe, it, expect } from "vitest";
import {
  rollVariation,
  type Rng,
} from "../deck-variation";
import type { VariationConfig } from "../deck-variation";

/** Deterministic rng that yields the given values in order, then 0. */
function seededRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++] ?? 0;
}

const TURNS_ONLY: VariationConfig = {
  reversalFrequency: 0,
  enabledReversals: [],
  turnFrequency: 1,
  enabledTurnPatterns: ["hold-1"],
};

describe("rollVariation", () => {
  it("returns null when nothing rolls", () => {
    const cfg: VariationConfig = {
      reversalFrequency: 0, enabledReversals: [],
      turnFrequency: 0, enabledTurnPatterns: [],
    };
    expect(rollVariation(4, cfg, seededRng([0.9, 0.9]))).toBeNull();
  });

  it("rolls a turn pattern when the turn gate passes", () => {
    // rng #1 = turn gate (0.0 < 1 → pass); rng #2 = pickTurnPattern index (→ 0)
    const v = rollVariation(4, TURNS_ONLY, seededRng([0.0, 0.0]));
    expect(v).not.toBeNull();
    expect(v!.turnPattern).toBe("1|1"); // hold-1
    expect(v!.turnLabel).toBe("Hold 1");
    expect(v!.reversalSequence).toBeUndefined();
  });

  it("skips a turn pattern whose period does not tile the step count", () => {
    const cfg: VariationConfig = {
      reversalFrequency: 0, enabledReversals: [],
      turnFrequency: 1, enabledTurnPatterns: ["wave-21"], // period 4
    };
    // stepCount 2 not divisible by 4 → no candidate → null
    expect(rollVariation(2, cfg, seededRng([0.0, 0.0]))).toBeNull();
  });
});
