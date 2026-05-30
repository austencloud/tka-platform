import { describe, it, expect } from "vitest";
import { calculateEndOrientation as core } from "$lib/shared/render/core/calculations/orientation";
// The sequence-engine copy is a positional-arg wrapper that delegates to core.
import { calculateEndOrientation as engine } from "$lib/shared/sequence-engine/services/orientation-propagator";

// Drift tripwire: every derivation copy must agree with the canonical core
// across the input space. If this fails, the copies have diverged — which the
// future "collapse 4 derivers to one" follow-up will fix.
const MOTION_TYPES = ["pro", "anti", "float", "dash", "static"];
const ORIS = ["in", "out", "clock", "counter"];
const TURNS: (number | "fl")[] = [0, 0.5, 1, 1.5, 2, "fl"];
const ROT = ["cw", "ccw", "noRotation"];
const LOCS: [string, string][] = [
  ["n", "e"],
  ["e", "s"],
  ["n", "s"],
];

describe("calculateEndOrientation copies agree with core", () => {
  it("sequence-engine wrapper matches core across the input space", () => {
    for (const motionType of MOTION_TYPES)
      for (const startOrientation of ORIS)
        for (const turns of TURNS)
          for (const rotationDirection of ROT)
            for (const [startLocation, endLocation] of LOCS) {
              const expected = core({
                motionType,
                turns,
                rotationDirection,
                startLocation,
                endLocation,
                startOrientation,
              });
              const got = engine(
                motionType,
                turns,
                rotationDirection,
                startLocation,
                endLocation,
                startOrientation as never
              );
              expect(
                got,
                `${motionType}/${startOrientation}/${turns}/${rotationDirection}/${startLocation}->${endLocation}`
              ).toBe(expected);
            }
  });
});
