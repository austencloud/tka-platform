import { describe, expect, it } from "vitest";
import { BASE_ALPHABET_LETTERS } from "@tka/domain";
import { LETTER_DESCRIPTIONS } from "../../src/routes/(public)/atlas/_data/letter-descriptions.server";

describe("letter codex descriptions", () => {
  it("describes every letter the Level 1 codex draws", () => {
    expect(Object.keys(LETTER_DESCRIPTIONS)).toEqual(BASE_ALPHABET_LETTERS);
    expect(
      Object.values(LETTER_DESCRIPTIONS).every((text) => text.length > 0)
    ).toBe(true);
  });

  it("keeps motion, rotation, and position facts specific to the selected letter", () => {
    expect(LETTER_DESCRIPTIONS.A).toContain("Split-Same timing");
    expect(LETTER_DESCRIPTIONS.U).toContain("leading hand's prop prospins");
    expect(LETTER_DESCRIPTIONS["W-"]).toContain(
      "One hand shifts while the other dashes"
    );
    expect(LETTER_DESCRIPTIONS["Φ"]).toContain("start in beta");
    expect(LETTER_DESCRIPTIONS["α"]).toContain("Both hands remain stationary");
  });
});
