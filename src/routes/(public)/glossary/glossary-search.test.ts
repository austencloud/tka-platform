import { describe, expect, it } from "vitest";
import {
  matchesGlossaryTerm,
  matchesGlossarySearchText,
  normalizeGlossarySearchText,
} from "./glossary-search";

describe("glossary search normalization", () => {
  it("treats punctuation and hyphens as word breaks", () => {
    expect(normalizeGlossarySearchText("Quarter-Opposite / R/R")).toBe(
      "quarter opposite r r"
    );
    expect(
      matchesGlossarySearchText(
        "Quarter-Opposite",
        normalizeGlossarySearchText("quarter opp")
      )
    ).toBe(true);
  });

  it("matches joined and separated curriculum spellings", () => {
    expect(
      matchesGlossarySearchText(
        "Hand Path",
        normalizeGlossarySearchText("handpath")
      )
    ).toBe(true);
    expect(
      matchesGlossarySearchText(
        "Halfway Point",
        normalizeGlossarySearchText("half way")
      )
    ).toBe(true);
  });

  it("preserves Greek letters", () => {
    expect(normalizeGlossarySearchText("Σ-Dash")).toBe("σ dash");
  });

  it("matches an alias even when the canonical name and definition do not", () => {
    expect(
      matchesGlossaryTerm(
        {
          term: "Type 1: Dual-Shift",
          aliases: ["type1", "dual shift"],
          definition: "Both hands shift to adjacent grid points.",
          examples: [],
          related: [],
          benefit: null,
          importance: null,
        },
        normalizeGlossarySearchText("type1")
      )
    ).toBe(true);
  });

  it("does not match one-character queries against definition prose", () => {
    const query = normalizeGlossarySearchText("A");

    expect(
      matchesGlossaryTerm(
        {
          term: "A",
          aliases: [],
          definition: "A Type 1 letter.",
          examples: [],
          related: [],
          benefit: null,
          importance: null,
        },
        query
      )
    ).toBe(true);
    expect(
      matchesGlossaryTerm(
        {
          term: "Dash",
          aliases: [],
          definition: "A straight hand path.",
          examples: [],
          related: [],
          benefit: null,
          importance: null,
        },
        query
      )
    ).toBe(false);
  });
});
