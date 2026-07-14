import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CANONICAL_LETTERS,
  letterToSlug,
  slugToLetter,
  letterSeo,
  letterImageBasename,
  letterImagePaths,
  allLetterSeo,
  letterFacts,
} from "$lib/shared/seo/notation-letters";

const CSV_PATH = resolve(process.cwd(), "static/data/pictographs/DiamondPictographDataframe.csv");

describe("notation-letters SEO metadata", () => {
  it("covers exactly the 47 canonical letters", () => {
    expect(CANONICAL_LETTERS).toHaveLength(47);
    expect(new Set(CANONICAL_LETTERS).size).toBe(47);
  });

  it("every canonical letter has a dataframe row (is renderable)", () => {
    const csv = readFileSync(CSV_PATH, "utf-8");
    const lines = csv.split("\n").filter((l) => l.trim().length > 0);
    const csvLetters = new Set(lines.slice(1).map((l) => l.split(",")[0]).filter(Boolean));
    for (const letter of CANONICAL_LETTERS) {
      expect(csvLetters.has(letter), `CSV missing row for "${letter}"`).toBe(true);
    }
    // The canonical set is exactly the distinct dataframe letters.
    expect(new Set(CANONICAL_LETTERS)).toEqual(csvLetters);
  });

  it("slugs round-trip and are URL/filename safe and unique", () => {
    const slugs = new Set<string>();
    for (const letter of CANONICAL_LETTERS) {
      const slug = letterToSlug(letter);
      expect(slug, `slug for ${letter}`).toMatch(/^[a-z0-9-]+$/);
      expect(slugToLetter(slug)).toBe(letter);
      slugs.add(slug);
    }
    expect(slugs.size).toBe(CANONICAL_LETTERS.length);
  });

  it("maps Greek and dash letters to readable slugs", () => {
    expect(letterToSlug("Σ")).toBe("sigma");
    expect(letterToSlug("Σ-")).toBe("sigma-dash");
    expect(letterToSlug("Φ-")).toBe("phi-dash");
    expect(letterToSlug("α")).toBe("alpha");
    expect(letterToSlug("W-")).toBe("w-dash");
    expect(letterToSlug("A")).toBe("a");
  });

  it("builds descriptive, keyword-bearing filenames and paths", () => {
    expect(letterImageBasename("Σ-")).toBe("kinetic-alphabet-letter-sigma-dash");
    const paths = letterImagePaths("A");
    expect(paths.webp).toBe("/notation/letters/kinetic-alphabet-letter-a.webp");
    expect(paths.webpSmall).toBe("/notation/letters/kinetic-alphabet-letter-a-small.webp");
    expect(paths.png).toBe("/notation/letters/kinetic-alphabet-letter-a.png");
  });

  it("produces non-thin, letter-specific SEO copy for every letter", () => {
    const descriptions = new Set<string>();
    for (const seo of allLetterSeo()) {
      expect(seo.title).toContain(`Letter ${seo.letter}`);
      expect(seo.title.toLowerCase()).toContain("kinetic alphabet");
      expect(seo.description).toContain(seo.letter);
      expect(seo.alt).toContain(seo.letter);
      expect(seo.alt.length).toBeGreaterThan(20);
      expect(seo.href).toBe(`/notation/letters/${seo.slug}`);
      descriptions.add(seo.description);
    }
    // Unique copy per page (no duplicate descriptions across 47 pages).
    expect(descriptions.size).toBe(CANONICAL_LETTERS.length);
  });

  it("has canonical motion facts for every letter", () => {
    for (const letter of CANONICAL_LETTERS) {
      const f = letterFacts(letter);
      expect(f, `facts for ${letter}`).toBeDefined();
      expect(f!.blue.motionType.length).toBeGreaterThan(0);
      expect(f!.red.motionType.length).toBeGreaterThan(0);
    }
    // The motion sentence surfaces on the SEO payload.
    expect(letterSeo(CANONICAL_LETTERS[0]).motion).toMatch(/Blue hand:.*Red hand:/);
  });
});
