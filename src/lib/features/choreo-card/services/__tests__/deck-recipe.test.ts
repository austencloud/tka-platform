import { describe, it, expect } from "vitest";
import { hashRecipe, mintSeed, GENERATOR_VERSION } from "../deck-recipe";
import type { DeckRecipe } from "../../domain/models/DeckRelease";

const base: DeckRecipe = {
  schemaVersion: 1,
  generatorVersion: GENERATOR_VERSION,
  seed: "abc123",
  deckMode: "loop",
  startOriModes: ["radial"],
  gridModes: ["diamond"],
  totalCards: 52,
  sliceTypes: ["quartered"],
  loopTypes: ["rotated"],
  levels: [1],
};

describe("deck-recipe", () => {
  it("hashRecipe is stable regardless of key insertion order", () => {
    const reordered: DeckRecipe = { ...base, gridModes: ["diamond"], startOriModes: ["radial"] };
    expect(hashRecipe(base)).toEqual(hashRecipe(reordered));
  });

  it("different seeds → different hash", () => {
    expect(hashRecipe(base)).not.toEqual(hashRecipe({ ...base, seed: "different" }));
  });

  it("different dials → different hash", () => {
    expect(hashRecipe(base)).not.toEqual(hashRecipe({ ...base, totalCards: 36 }));
  });

  it("mintSeed yields a 16-hex-char string and varies", () => {
    const s = mintSeed();
    expect(s).toMatch(/^[0-9a-f]{16}$/);
    expect(mintSeed()).not.toEqual(s);
  });

  it("GENERATOR_VERSION is a non-empty string", () => {
    expect(typeof GENERATOR_VERSION).toBe("string");
    expect(GENERATOR_VERSION.length).toBeGreaterThan(0);
  });
});
