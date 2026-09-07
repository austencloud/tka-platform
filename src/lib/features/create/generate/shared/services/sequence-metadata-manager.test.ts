import { describe, expect, it } from "vitest";
import { DifficultyLevel } from "../domain/models/generate-models";
import { mapDifficultyToLevel } from "./sequence-metadata-manager";

describe("mapDifficultyToLevel (generate module copy)", () => {
  it("maps SKEWED to level 4, not level 2", () => {
    // Regression: this copy carries its own module-local DifficultyLevel
    // enum but the same hand-maintained switch bug — SKEWED fell through to
    // the level-2 default instead of the level 4 that config-mapper.ts's
    // DIFFICULTY_TO_LEVEL has always defined for it.
    expect(mapDifficultyToLevel(DifficultyLevel.SKEWED)).toBe(4);
  });

  it("still maps the other levels correctly", () => {
    expect(mapDifficultyToLevel(DifficultyLevel.BEGINNER)).toBe(1);
    expect(mapDifficultyToLevel(DifficultyLevel.INTERMEDIATE)).toBe(2);
    expect(mapDifficultyToLevel(DifficultyLevel.ADVANCED)).toBe(3);
  });
});
