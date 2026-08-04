import { describe, it, expect } from "vitest";
import {
  edgesFromSequence,
  enumerateHybridWords,
  findIngredientCoverWitness,
  type IngredientEdges,
} from "$lib/shared/combination/services/letter-calculus";
import { GGGG_CW, HHHH_CCW, AAAA_CCW, FALG } from "./fixtures";
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

const FL: IngredientEdges = {
  name: "FL",
  edges: [
    { letter: "F", from: GridPositionGroup.BETA, to: GridPositionGroup.ALPHA },
    { letter: "L", from: GridPositionGroup.ALPHA, to: GridPositionGroup.BETA },
  ],
};
const AA: IngredientEdges = {
  name: "AA",
  edges: [
    { letter: "A", from: GridPositionGroup.ALPHA, to: GridPositionGroup.ALPHA },
  ],
};
const GG: IngredientEdges = {
  name: "GG",
  edges: [
    { letter: "G", from: GridPositionGroup.BETA, to: GridPositionGroup.BETA },
  ],
};

describe("letter calculus", () => {
  it("extracts family edges from a concrete sequence", () => {
    const edges = edgesFromSequence(GGGG_CW);
    expect(edges).toHaveLength(4);
    expect(edges[0]).toMatchObject({ letter: "G", from: "beta", to: "beta" });
  });

  it("FALG's real card decomposes into the FL/AA/GG edge families", () => {
    const edges = edgesFromSequence(FALG);
    expect(edges).toHaveLength(8);
    // First half: F β→α, A α→α, L α→β, G β→β
    expect(
      edges.slice(0, 4).map((e) => `${e.letter}:${e.from}>${e.to}`)
    ).toEqual(["F:beta>alpha", "A:alpha>alpha", "L:alpha>beta", "G:beta>beta"]);
  });

  it("derives FALG from FL + AA + GG (Austen's canonical hybrid), reported as its canonical rotation", () => {
    const { words } = enumerateHybridWords([FL, AA, GG], { maxLength: 4 });
    // FALG's rotations are FALG, ALGF, LGFA, GFAL. Lexicographically:
    // A(65) < F(70) < G(71) < L(76), so "ALGF" (starts with A) sorts first —
    // that's the canonical form I3 requires, distinct from display-layer
    // simplification (word-simplifier.ts), which is not involved here.
    const falg = words.find((w) => w.word === "ALGF");
    expect(falg).toBeDefined();
    expect(falg!.letters).toEqual(["A", "L", "G", "F"]);
    expect(falg!.ingredients).toEqual(
      expect.arrayContaining(["FL", "AA", "GG"])
    );
  });

  it("word set is stable regardless of ingredient array order (I3)", () => {
    const orderings: readonly (readonly IngredientEdges[])[] = [
      [FL, AA, GG],
      [GG, AA, FL],
      [AA, GG, FL],
    ];
    const wordLists = orderings.map((ings) =>
      enumerateHybridWords(ings, { maxLength: 4 })
        .words.map((w) => w.word)
        .sort()
    );
    expect(wordLists[1]).toEqual(wordLists[0]);
    expect(wordLists[2]).toEqual(wordLists[0]);
  });

  it("closed-walk constraint: GG + AA alone cannot interleave (no α↔β edges)", () => {
    const { words } = enumerateHybridWords([AA, GG], {
      maxLength: 6,
      requireAllIngredients: true,
    });
    expect(words).toHaveLength(0);
  });

  it("HHHH edges chain with GGGG edges as primitive necklaces (both beta-world)", () => {
    const g = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    const h = { name: "HH", edges: edgesFromSequence(HHHH_CCW) };
    const { words } = enumerateHybridWords([g, h], {
      maxLength: 4,
      requireAllIngredients: true,
    });
    expect(words.some((w) => w.word === "GH")).toBe(true);
    // GHGH would just repeat "GH" twice — I5 excludes it once primitivity applies.
    expect(words.some((w) => w.word === "GHGH")).toBe(false);
  });

  it("alpha-world AAAA cannot reach beta-world GGGG without a bridge", () => {
    const a = { name: "AA", edges: edgesFromSequence(AAAA_CCW) };
    const g = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    const { words } = enumerateHybridWords([a, g], {
      maxLength: 8,
      requireAllIngredients: true,
    });
    expect(words).toHaveLength(0);
  });

  it("emits only primitive necklaces — a pure self-loop ingredient never emits GG/GGG (I5)", () => {
    const gg = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    const { words } = enumerateHybridWords([gg], { maxLength: 6 });
    expect(words.map((w) => w.word)).toEqual(["G"]);
  });

  it("exact cover: two ingredients sharing one identical edge require 2 occurrences, not 1 (I4 false-positive case)", () => {
    // Both ingredients offer the SAME edge (G: β→β) after dedup, so a walk
    // occurrence's owner set is {G1, G2} either way. A union-of-owners check
    // would wrongly call a single occurrence "covers both" since both names
    // appear in that one owner set — the exact-cover check must require a
    // DISTINCT occurrence per ingredient.
    const sharedOwners = new Set(["G1", "G2"]);

    // "G" (1 occurrence): cannot credit both G1 and G2 from a single occurrence.
    expect(findIngredientCoverWitness([sharedOwners], ["G1", "G2"])).toBeNull();

    // "GG" (2 occurrences): each ingredient claims one — feasible.
    expect(
      findIngredientCoverWitness([sharedOwners, sharedOwners], ["G1", "G2"])
    ).toEqual(["G1", "G2"]);
  });

  it("tiny search budget truncates the search; results stay a subset of the full run (M10)", () => {
    const g = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    const h = { name: "HH", edges: edgesFromSequence(HHHH_CCW) };

    const full = enumerateHybridWords([g, h], { maxLength: 4 });
    expect(full.searchComplete).toBe(true);

    const truncatedRun = enumerateHybridWords([g, h], {
      maxLength: 4,
      searchBudget: 3,
    });
    expect(truncatedRun.searchComplete).toBe(false);

    const fullWords = new Set(full.words.map((w) => w.word));
    for (const candidate of truncatedRun.words) {
      expect(fullWords.has(candidate.word)).toBe(true);
    }
  });
});
