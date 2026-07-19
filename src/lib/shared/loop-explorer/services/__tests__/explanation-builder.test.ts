import { describe, it, expect } from "vitest";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { buildExplanation } from "../explanation-builder";
import type { BeatPairRelation } from "../relation-extractor";

describe("buildExplanation", () => {
  it("cites a rotated beat pair with the 180° label, never 'turn'", () => {
    const relations: BeatPairRelation[] = [
      { beatA: 1, beatB: 9, transform: ["rotated"], rotation: "180" },
    ];

    const explanation = buildExplanation({
      components: new Set([LOOPComponent.ROTATED]),
      slice: "halved",
      relations,
      seedLength: 8,
      totalLength: 16,
    });

    expect(explanation.citations[0]).toBe("Beat 9 = beat 1 rotated 180°.");
    expect(explanation.citations[0]).not.toMatch(/turn/i);
    expect(explanation.intro).not.toMatch(/turn/i);
    expect(explanation.lengthMath).not.toMatch(/turn/i);
  });

  it("cites a 90° quartered rotation with direction", () => {
    const relations: BeatPairRelation[] = [
      { beatA: 1, beatB: 5, transform: ["rotated"], rotation: "90cw" },
    ];

    const explanation = buildExplanation({
      components: new Set([LOOPComponent.ROTATED]),
      slice: "quartered",
      relations,
      seedLength: 4,
      totalLength: 16,
    });

    expect(explanation.citations[0]).toBe("Beat 5 = beat 1 rotated 90° clockwise.");
    expect(explanation.citations[0]).not.toMatch(/turn/i);
  });

  it("cites a repeated (identity) beat pair", () => {
    const relations: BeatPairRelation[] = [{ beatA: 1, beatB: 5, transform: [] }];
    const explanation = buildExplanation({
      components: new Set([LOOPComponent.SWAPPED]),
      slice: "halved",
      relations,
      seedLength: 4,
      totalLength: 8,
    });
    expect(explanation.citations[0]).toBe("Beat 5 repeats beat 1.");
  });

  it("joins multi-component transforms with 'and'", () => {
    const relations: BeatPairRelation[] = [
      { beatA: 2, beatB: 10, transform: ["mirrored", "swapped"] },
    ];
    const explanation = buildExplanation({
      components: new Set([LOOPComponent.MIRRORED, LOOPComponent.SWAPPED]),
      slice: "halved",
      relations,
      seedLength: 8,
      totalLength: 16,
    });
    expect(explanation.citations[0]).toBe("Beat 10 = beat 2 mirrored and swapped.");
  });

  it("computes the length-math line from the wire's expander multiplier", () => {
    // No wire supplied → falls back to totalLength/seedLength rounding.
    const explanation = buildExplanation({
      components: new Set([LOOPComponent.ROTATED]),
      slice: "halved",
      relations: [],
      seedLength: 8,
      totalLength: 16,
    });
    expect(explanation.lengthMath).toBe("8 × 2 = 16 beats.");
  });
});
