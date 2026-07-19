import { describe, it, expect } from "vitest";
import type { StepLike } from "$lib/shared/foundation/domain/models/step-like";
import { defaultInterval, extractPairRelations } from "../relation-extractor";

function step(
  blueStart: string,
  blueEnd: string,
  redStart: string,
  redEnd: string
): StepLike {
  return {
    letter: "A",
    startPosition: null,
    endPosition: null,
    motions: {
      blue: { motionType: "pro", startLocation: blueStart, endLocation: blueEnd },
      red: { motionType: "pro", startLocation: redStart, endLocation: redEnd },
    },
  } as unknown as StepLike;
}

describe("defaultInterval", () => {
  it("halves for the halved slice", () => {
    expect(defaultInterval(16, "halved")).toBe(8);
  });
  it("quarters for the quartered slice", () => {
    expect(defaultInterval(16, "quartered")).toBe(4);
  });
  it("is 0 for too-short sequences", () => {
    expect(defaultInterval(1, "halved")).toBe(0);
  });
});

describe("extractPairRelations", () => {
  it("cites a 180° rotation between beat 1 and beat 9 in a 16-beat halved sequence", () => {
    // ROTATE_180: n<->s, e<->w. Second half is the rotated image of the first.
    const first = step("n", "e", "s", "w");
    const second = step("s", "w", "n", "e");
    const steps = [
      first, first, first, first, first, first, first, first,
      second, second, second, second, second, second, second, second,
    ];

    const relations = extractPairRelations(steps, defaultInterval(16, "halved"));
    expect(relations).toHaveLength(8);
    expect(relations[0]).toMatchObject({ beatA: 1, beatB: 9, rotation: "180" });
    expect(relations[0]!.transform).toContain("rotated");
  });

  it("returns an empty array for an odd-length or too-short sequence", () => {
    expect(extractPairRelations([step("n", "e", "s", "w")], 0)).toEqual([]);
  });
});
