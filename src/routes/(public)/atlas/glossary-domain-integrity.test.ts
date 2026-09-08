import { describe, expect, it } from "vitest";
import {
  BASE_ALPHABET_LETTERS,
  DOMAIN_TOPICS,
  EXTENDED_ALPHABET_LETTERS,
  GLOSSARY,
  LETTER_TYPES,
  REGISTERED_ALPHABET_LETTERS,
  TERM_ALIASES,
  getLetterType,
  resolveTermAlias,
} from "@tka/domain";
import { VTG_GLOSSARY } from "@vtg/domain";

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
    expect(GLOSSARY.turns?.definition).toContain(
      "not a mathematical lower bound"
    );
    expect(GLOSSARY.turns?.definition).toContain("turns = (P/H - 1) / 2");
    expect(GLOSSARY.turns?.definition).toContain("-0.25 for 2:1");
    expect(GLOSSARY.turns?.definition).toContain("exceptional 1:0 ratio");
    expect(GLOSSARY.float?.definition).toContain("separate binary state");
    expect(GLOSSARY["constraint-preset"]?.definition).toContain("no-static");
    expect(GLOSSARY["constraint-preset"]?.definition).not.toContain("pro-cw");
    expect(GLOSSARY["negative-space"]?.definition).toContain("body turns");
  });

  it("documents negative turns without collapsing Float into a number", () => {
    const motionTypes = DOMAIN_TOPICS["motion-types-complete"]?.content ?? "";

    expect(motionTypes).toContain("historical baseline");
    expect(motionTypes).toContain("turns = (P/H - 1) / 2");
    expect(motionTypes).toContain("-0.25 turns");
    expect(motionTypes).toContain("1:0");
    expect(motionTypes).toContain("not numeric -0.5 turns");
    expect(motionTypes).not.toContain("Negative turns do not exist");
  });

  it("states VTG ratios hand-first, matching Noel Yee's notation", () => {
    const pattern = VTG_GLOSSARY.find((entry) => entry.term === "pattern");

    expect(pattern?.definition).toContain("hand:prop");
    expect(pattern?.definition).toContain(
      "hand cycles first and prop rotations second"
    );
    expect(pattern?.definition).toContain("1:1, 1:3, and 1:5");
    expect(pattern?.definition).not.toContain("3:1");
    expect(pattern?.definition).not.toContain("inverse order");
  });

  it("keeps pictographs, sequence steps, and musical beats distinct", () => {
    expect(resolveTermAlias("beat")).toBe("beat");
    expect(GLOSSARY.beat?.definition).toContain("musical timing");
    expect(GLOSSARY.step?.definition).toContain(
      "pictograph in the context of a sequence"
    );
    expect(GLOSSARY.pictograph?.definition).toContain("can stand alone");
  });

  it("keeps individual letters out of the glossary taxonomy", () => {
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
    expect(dataframeLetterEntries).toHaveLength(0);
    expect(GLOSSARY["tau-dash"]).toBeDefined();
    expect(GLOSSARY["tau-dash"]?.category).not.toBe("letterType");
  });
});
