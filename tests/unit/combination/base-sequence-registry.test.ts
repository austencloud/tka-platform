import { describe, it, expect, beforeAll } from "vitest";
import {
  BASE_SEQUENCES,
  confirmedBases,
  ambientEligibleBases,
  ambientLetterSet,
} from "$lib/shared/combination/domain/base-sequence-registry";
import { getAllLetterVariants } from "../../helpers/real-pictograph-loader";
import { positionGroup } from "$lib/shared/combination/services/position-groups";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("base-sequence registry", () => {
  it("contains the MCP-documented compound bases", () => {
    const words = BASE_SEQUENCES.map((b) => b.word);
    for (const w of ["DJ", "EK", "FL", "MP", "NQ", "OR", "ΦΨ"]) {
      expect(words).toContain(w);
    }
  });

  it("contains Austen's promoted bases", () => {
    const words = BASE_SEQUENCES.map((b) => b.word);
    expect(words).toContain("WΣYθ");
    expect(words).toContain("XΔZΩ");
  });

  it("every confirmed base has edges; unconfirmed bases have null edges", () => {
    for (const base of BASE_SEQUENCES) {
      if (base.confirmed) expect(base.edges).not.toBeNull();
      else expect(base.edges).toBeNull();
    }
  });

  it("ambient-eligible = confirmed bases only", () => {
    expect(ambientEligibleBases().every((b) => b.confirmed)).toBe(true);
    expect(confirmedBases().length).toBeGreaterThanOrEqual(9);
  });

  it("ambientLetterSet covers the bridge letters", () => {
    const letters = ambientLetterSet();
    expect(letters.has("Φ")).toBe(true);
    expect(letters.has("Ψ")).toBe(true);
    expect(letters.has("G")).toBe(true);
  });

  it("confirmed edges agree with the canonical dataframe", async () => {
    // For every confirmed base's edges: look up the letter's variants in the
    // canonical diamond dataframe and assert the (from, to) position-family
    // pair of the edge matches the families of at least one real dataframe
    // row for that letter — pins registry data to canon
    // (verify-at-canonical-source).
    const confirmed = confirmedBases();
    expect(confirmed.length).toBeGreaterThan(0);

    for (const base of confirmed) {
      for (const edge of base.edges ?? []) {
        const variants = await getAllLetterVariants(
          edge.letter,
          GridMode.DIAMOND
        );
        expect(
          variants.length,
          `no diamond dataframe rows found for letter ${edge.letter} (base ${base.word})`
        ).toBeGreaterThan(0);

        const families = variants.map((v) => ({
          from: v.startPosition ? positionGroup(v.startPosition) : null,
          to: v.endPosition ? positionGroup(v.endPosition) : null,
        }));

        const hasMatch = families.some(
          (f) => f.from === edge.from && f.to === edge.to
        );
        expect(
          hasMatch,
          `base ${base.word}'s edge ${edge.letter}: ${edge.from}->${edge.to} ` +
            `does not match any real dataframe row for ${edge.letter} ` +
            `(found families: ${JSON.stringify(families)})`
        ).toBe(true);
      }
    }
  });
});
