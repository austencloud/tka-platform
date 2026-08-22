import { describe, expect, it } from "vitest";
import {
  BASE_ALPHABET_LETTERS,
  EXTENDED_ALPHABET_LETTERS,
  GLOSSARY,
  LETTER_TYPES,
  REGISTERED_ALPHABET_LETTERS,
  TERM_ALIASES,
  getLetterType,
  resolveTermAlias,
} from "@tka/domain";

describe("glossary domain integrity", () => {
  it("keeps related terms and aliases connected to canonical entries", () => {
    for (const [term, entry] of Object.entries(GLOSSARY)) {
      for (const related of entry.relatedTerms) {
        const target = GLOSSARY[related] ? related : resolveTermAlias(related);
        expect(GLOSSARY[target], `${term} -> ${related}`).toBeDefined();
      }
    }

    for (const [alias, target] of Object.entries(TERM_ALIASES)) {
      expect(GLOSSARY[target], `${alias} -> ${target}`).toBeDefined();
      if (GLOSSARY[alias]) expect(target).toBe(alias);
    }
  });

  it("separates the 47 dataframe letters from registered extensions", () => {
    expect(BASE_ALPHABET_LETTERS).toHaveLength(47);
    expect(EXTENDED_ALPHABET_LETTERS).toEqual(["τ-"]);
    expect(REGISTERED_ALPHABET_LETTERS).toHaveLength(48);
    expect(LETTER_TYPES["4"]?.letters).toEqual(["Φ", "Ψ", "Λ"]);
    expect(LETTER_TYPES["4"]?.extendedLetters).toEqual(["τ-"]);
    expect(getLetterType("τ-")).toBe(4);
  });

  it("does not publish contradicted motion vocabulary", () => {
    expect(GLOSSARY["half-float"]).toBeUndefined();
    expect(GLOSSARY.turns?.definition).toContain("nonnegative");
    expect(GLOSSARY.float?.definition).toContain("separate binary state");
    expect(GLOSSARY["constraint-preset"]?.definition).toContain("no-static");
    expect(GLOSSARY["constraint-preset"]?.definition).not.toContain("pro-cw");
    expect(GLOSSARY["negative-space"]?.definition).toContain("body turns");
  });

  it("keeps Tau-Dash as a letter and exactly six numbered letter types", () => {
    const letterTypes = Object.keys(GLOSSARY).filter(
      (term) => GLOSSARY[term]?.category === "letterType"
    );
    const dataframeLetterEntries = Object.keys(GLOSSARY).filter((term) =>
      /^letter-(?!type$)/.test(term)
    );

    expect(letterTypes).toEqual([
      "type-1",
      "type-2",
      "type-3",
      "type-4",
      "type-5",
      "type-6",
    ]);
    expect(dataframeLetterEntries).toHaveLength(47);
    expect(GLOSSARY["tau-dash"]?.category).not.toBe("letterType");
  });
});
