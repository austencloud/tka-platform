import { describe, expect, it } from "vitest";
import { normalizeStoredBeatResultsJson } from "./train-database-models";

describe("Train beat-detail compatibility", () => {
  it("restores literal blue/red hand pairs", () => {
    const [beat] = JSON.parse(
      normalizeStoredBeatResultsJson(
        JSON.stringify([
          {
            stepNumber: 1,
            expected: { blue: "n", red: "s" },
            detected: { blue: "e", red: null },
            positionCorrect: { blue: true, red: false },
          },
        ])
      )
    );

    expect(beat).toMatchObject({
      expected: { left: "n", right: "s" },
      detected: { left: "e", right: null },
      positionCorrect: { left: true, right: false },
    });
  });
});
