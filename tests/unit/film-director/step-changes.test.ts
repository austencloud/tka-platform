import { describe, expect, it } from "vitest";

import { resolveStepChange } from "../../../src/routes/test/film-director/_lib/director-step-changes";

const entries = [
  { step: 0, value: "none" },
  { step: 4, value: "trails" },
  { step: 8, value: "fire" },
];

describe("resolveStepChange", () => {
  it("returns the performer's base value when the list is empty", () => {
    expect(resolveStepChange([], 7, "linear")).toBe("linear");
  });

  it("returns the base value before the first entry", () => {
    expect(resolveStepChange([{ step: 8, value: "punch" }], 7, "linear")).toBe(
      "linear"
    );
  });

  it("takes the entry that names the step exactly", () => {
    expect(resolveStepChange(entries, 4, "glide")).toBe("trails");
  });

  it("holds the last entry at or before the step", () => {
    expect(resolveStepChange(entries, 5, "glide")).toBe("trails");
    expect(resolveStepChange(entries, 7, "glide")).toBe("trails");
    expect(resolveStepChange(entries, 8, "glide")).toBe("fire");
    expect(resolveStepChange(entries, 40, "glide")).toBe("fire");
  });

  it("does not care what order the entries were written in", () => {
    const shuffled = [entries[2]!, entries[0]!, entries[1]!];
    expect(resolveStepChange(shuffled, 5, "glide")).toBe("trails");
  });

  it("ignores the fractional part of a step", () => {
    expect(resolveStepChange(entries, 3.99, "glide")).toBe("none");
    expect(resolveStepChange(entries, 4.01, "glide")).toBe("trails");
  });

  it("falls back to the base value for a step that is not a finite number", () => {
    expect(resolveStepChange(entries, Number.NaN, "glide")).toBe("glide");
  });
});
