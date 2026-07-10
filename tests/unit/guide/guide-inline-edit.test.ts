import { describe, it, expect } from "vitest";
import {
  appendStep,
  deriveWordFromStrip,
  stepsOf,
  truncateStripAt,
} from "../../../src/routes/(public)/guide/level-1/_data/guide-inline-edit";
import type { StepData } from "../../../src/lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "../../../src/lib/shared/pictograph/shared/domain/models/pictograph-data";

function makeBox(stepNumber: number | null, letter: string | null = null): StepData {
  return {
    id: `b-${stepNumber ?? "start"}`,
    letter: letter as unknown as StepData["letter"],
    gridMode: "diamond" as unknown as StepData["gridMode"],
    stepNumber,
    isBlank: false,
    motions: {},
  } as unknown as StepData;
}

function makeStrip(): StepData[] {
  return [makeBox(0), makeBox(1, "A"), makeBox(2, "B"), makeBox(3, "C")];
}

describe("guide-inline-edit (Guide Companion v2, P3 staging logic)", () => {
  it("stepsOf excludes the start box", () => {
    const strip = makeStrip();
    const steps = stepsOf(strip);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.stepNumber)).toEqual([1, 2, 3]);
  });

  it("truncateStripAt keeps the start box plus steps 1..N, dropping the rest", () => {
    const strip = makeStrip();
    const truncated = truncateStripAt(strip, 1);
    expect(truncated.map((b) => b.stepNumber)).toEqual([0, 1]);
  });

  it("truncateStripAt(0) keeps only the start box", () => {
    const strip = makeStrip();
    const truncated = truncateStripAt(strip, 0);
    expect(truncated.map((b) => b.stepNumber)).toEqual([0]);
  });

  it("appendStep renumbers off the current step count, ignoring any stepNumber on the option", () => {
    const strip = truncateStripAt(makeStrip(), 1); // start + step 1
    const option = { id: "picked", letter: "D", motions: {} } as unknown as PictographData;
    const next = appendStep(strip, option);
    expect(next).toHaveLength(3);
    const appended = next[2]!;
    expect(appended.stepNumber).toBe(2);
    expect(appended.letter).toBe("D");
  });

  it("truncate-then-append staging round trip: drop steps after 1, append a new step 2", () => {
    const strip = makeStrip();
    const truncated = truncateStripAt(strip, 1);
    const option = { id: "picked", letter: "X", motions: {} } as unknown as PictographData;
    const rebuilt = appendStep(truncated, option);
    expect(rebuilt.map((b) => b.stepNumber)).toEqual([0, 1, 2]);
    expect(stepsOf(rebuilt).map((b) => b.letter)).toEqual(["A", "X"]);
  });

  it("deriveWordFromStrip joins step letters, excluding the start box", () => {
    const strip = makeStrip();
    expect(deriveWordFromStrip(strip)).toBe("ABC");
  });

  it("deriveWordFromStrip returns empty string for a strip with only a start box", () => {
    const strip = truncateStripAt(makeStrip(), 0);
    expect(deriveWordFromStrip(strip)).toBe("");
  });
});
