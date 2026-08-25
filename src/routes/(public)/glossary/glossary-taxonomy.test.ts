import { describe, expect, it } from "vitest";
import { load } from "./+page.server";

interface GlossaryData {
  groups: Array<{
    key: string;
    label: string;
    terms: Array<{
      term: string;
      aliases: string[];
      related: Array<{ term: string; slug: string }>;
    }>;
  }>;
  total: number;
  codex: {
    key: string;
    label: string;
    sectionSlug: string;
    letters: string[];
  };
}

async function getGlossaryData(): Promise<GlossaryData> {
  return (await load({} as never)) as unknown as GlossaryData;
}

describe("public glossary taxonomy", () => {
  it("presents exactly the six canonical numbered letter types", async () => {
    const { groups } = await getGlossaryData();
    const letterTypes = groups.find((group) => group.key === "letterType");

    expect(letterTypes?.terms.map(({ term }) => term)).toEqual([
      "Type 1: Dual-Shift",
      "Type 2: Shift",
      "Type 3: Cross-Shift",
      "Type 4: Dash",
      "Type 5: Dual-Dash",
      "Type 6: Static",
    ]);
  });

  it("keeps the alphabet in the visual Codex instead of DefinedTerms", async () => {
    const { codex, groups } = await getGlossaryData();
    const publicTerms = groups.flatMap((group) => group.terms);

    expect(groups.find((group) => group.key === "letter")).toBeUndefined();
    expect(codex.label).toBe("Letter Codex");
    // The Codex draws the Level 1 dataframe and only that.
    expect(codex.letters).toHaveLength(47);
    expect(codex.letters).not.toContain("τ-");
    expect(publicTerms.map(({ term }) => term)).not.toContain("A");
  });

  it("defines Tau-Dash as a term, since the Codex cannot draw it", async () => {
    const { groups } = await getGlossaryData();
    const letterTypes = groups.find((group) => group.key === "letterType");
    const tauDash = groups
      .flatMap((group) => group.terms)
      .find(({ term }) => term === "Tau-Dash");

    // Outside the Level 1 dataframe, so it has no pictograph to show — it
    // stays a written entry rather than disappearing from the public glossary.
    expect(tauDash).toBeDefined();
    // Still an individual letter, never a seventh letter type.
    expect(letterTypes?.terms.map(({ term }) => term)).not.toContain("Tau-Dash");
  });

  it("places every public glossary term exactly once", async () => {
    const { groups, total } = await getGlossaryData();
    const terms = groups.flatMap((group) => group.terms);

    expect(terms).toHaveLength(total);
    expect(new Set(terms.map(({ term }) => term)).size).toBe(total);
  });

  it("attaches public search aliases to the canonical terms", async () => {
    const { groups } = await getGlossaryData();
    const terms = groups.flatMap((group) => group.terms);

    expect(
      terms.find(({ term }) => term === "Type 1: Dual-Shift")?.aliases
    ).toEqual(expect.arrayContaining(["type1", "dual-shift"]));
    expect(terms.find(({ term }) => term === "Pro")?.aliases).toEqual(
      expect.arrayContaining(["prospin", "pro-spin"])
    );
    expect(terms.find(({ term }) => term === "Quarter-Same")?.aliases).toEqual(
      expect.arrayContaining(["quarter same", "stuv", "qs"])
    );
  });

  it("resolves every related-term link to an on-page entry", async () => {
    const { groups } = await getGlossaryData();
    const terms = groups.flatMap((group) => group.terms);
    const names = new Set(terms.map(({ term }) => term));

    for (const term of terms) {
      for (const related of term.related) {
        expect(names.has(related.term), `${term.term} -> ${related.term}`).toBe(
          true
        );
      }
    }
  });
});
