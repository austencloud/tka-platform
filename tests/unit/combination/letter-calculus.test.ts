import { describe, it, expect } from "vitest";
import {
  edgesFromSequence,
  enumerateHybridWords,
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

  it("derives FALG from FL + AA + GG (Austen's canonical hybrid)", () => {
    const words = enumerateHybridWords([FL, AA, GG], { maxLength: 4 });
    const falg = words.find((w) => w.word === "FALG");
    expect(falg).toBeDefined();
    expect(falg!.ingredients).toEqual(
      expect.arrayContaining(["FL", "AA", "GG"])
    );
  });

  it("closed-walk constraint: GG + AA alone cannot interleave (no α↔β edges)", () => {
    const words = enumerateHybridWords([AA, GG], {
      maxLength: 6,
      requireAllIngredients: true,
    });
    expect(words).toHaveLength(0);
  });

  it("HHHH edges chain with GGGG edges (both beta-world)", () => {
    const g = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    const h = { name: "HH", edges: edgesFromSequence(HHHH_CCW) };
    const words = enumerateHybridWords([g, h], {
      maxLength: 4,
      requireAllIngredients: true,
    });
    expect(
      words.some((w) => w.word.includes("G") && w.word.includes("H"))
    ).toBe(true);
  });

  it("alpha-world AAAA cannot reach beta-world GGGG without a bridge", () => {
    const a = { name: "AA", edges: edgesFromSequence(AAAA_CCW) };
    const g = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    expect(
      enumerateHybridWords([a, g], {
        maxLength: 8,
        requireAllIngredients: true,
      })
    ).toHaveLength(0);
  });
});
