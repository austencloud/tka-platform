import { describe, expect, it } from "vitest";
import { generatePoiReversalCandidates } from "../../src/lib/features/levels/poi-lab/domain/poi-reversal-candidates";
import {
  createEmptyPoiReversalObservationFile,
  createPoiReversalObservation,
  parsePoiReversalObservationFile,
} from "../../src/lib/features/levels/poi-lab/domain/poi-reversal-observations";

describe("poi reversal observations", () => {
  const candidate = generatePoiReversalCandidates()[0]!;

  it("appends review numbers instead of overwriting an earlier judgment", () => {
    const first = createPoiReversalObservation(
      candidate,
      "legal",
      null,
      "",
      []
    );
    const second = createPoiReversalObservation(
      candidate,
      "illegal",
      3,
      "The head drops here.",
      [first]
    );

    expect(first.id).toMatch(/@01$/);
    expect(second.id).toMatch(/@02$/);
    expect(second.firstIllegalStep).toBe(3);
    expect(second.reason).toBe("The head drops here.");
  });

  it("rejects an illegal label without both a step and a reason", () => {
    expect(() =>
      createPoiReversalObservation(candidate, "illegal", null, "No step", [])
    ).toThrow("Choose the first illegal step");
    expect(() =>
      createPoiReversalObservation(candidate, "illegal", 2, "   ", [])
    ).toThrow("Choose the first illegal step");
  });

  it("round-trips the versioned file and rejects duplicate observation IDs", () => {
    const observation = createPoiReversalObservation(
      candidate,
      "unsure",
      null,
      "Needs a throw",
      []
    );
    const file = {
      ...createEmptyPoiReversalObservationFile(),
      observations: [observation],
    };

    expect(parsePoiReversalObservationFile(structuredClone(file))).toEqual(
      file
    );
    expect(() =>
      parsePoiReversalObservationFile({
        ...file,
        observations: [observation, observation],
      })
    ).toThrow("duplicate");
  });
});
