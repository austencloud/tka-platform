import { describe, expect, it } from "vitest";
import { describeMask } from "../pattern-sentence";

describe("describeMask", () => {
  it("says every step when every step is active", () => {
    expect(describeMask([true])).toBe("every step");
    expect(describeMask([true, true])).toBe("every step");
    expect(describeMask([true, true, true, true])).toBe("every step");
  });

  it("says no steps when nothing is active", () => {
    expect(describeMask([false])).toBe("no steps");
    expect(describeMask([false, false, false])).toBe("no steps");
  });

  it("names a period of two in plain words", () => {
    expect(describeMask([true, false])).toBe("every other step");
  });

  it("says where an offset period of two starts", () => {
    expect(describeMask([false, true])).toBe(
      "every other step, starting on step 2"
    );
  });

  it("counts longer periods with an ordinal", () => {
    expect(describeMask([true, false, false, false])).toBe("every 4th step");
    expect(describeMask([true, false, false])).toBe("every 3rd step");
  });

  it("says where a longer offset period starts", () => {
    expect(describeMask([false, false, true, false])).toBe(
      "every 4th step, starting on step 3"
    );
  });

  it("lists the steps when the rhythm is irregular", () => {
    expect(describeMask([true, false, true, false, false, true])).toBe(
      "steps 1, 3 and 6"
    );
    expect(describeMask([true, true, false])).toBe("steps 1 and 2");
  });

  it("treats an empty mask as no steps", () => {
    expect(describeMask([])).toBe("no steps");
  });
});
