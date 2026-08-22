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

  it("publishes the complete registered alphabet as the Letter Codex", async () => {
    const { groups } = await getGlossaryData();
    const letterCodex = groups.find((group) => group.key === "letter");
    const letterTypes = groups.find((group) => group.key === "letterType");

    expect(letterCodex?.label).toBe("Letter Codex");
    expect(new Set(letterCodex?.terms.map(({ term }) => term))).toEqual(
      new Set([
        ...Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        "Sigma (Σ)",
        "Delta (Δ)",
        "Theta (Θ)",
        "Omega (Ω)",
        "W-Dash (W-)",
        "X-Dash (X-)",
        "Y-Dash (Y-)",
        "Z-Dash (Z-)",
        "Sigma-Dash (Σ-)",
        "Delta-Dash (Δ-)",
        "Theta-Dash (Θ-)",
        "Omega-Dash (Ω-)",
        "Phi (Φ)",
        "Psi (Ψ)",
        "Lambda (Λ)",
        "Phi-Dash (Φ-)",
        "Psi-Dash (Ψ-)",
        "Lambda-Dash (Λ-)",
        "Alpha (α)",
        "Beta (β)",
        "Gamma (γ)",
        "Tau-Dash (τ-)",
      ])
    );
    expect(letterCodex?.terms).toHaveLength(48);
    expect(letterTypes?.terms.map(({ term }) => term)).not.toContain(
      "Tau-Dash (τ-)"
    );
  });

  it("places every glossary entry exactly once", async () => {
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
