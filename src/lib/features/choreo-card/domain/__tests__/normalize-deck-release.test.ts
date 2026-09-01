import { describe, expect, it } from "vitest";
import { normalizeDeckRelease } from "../normalize-deck-release";

describe("normalizeDeckRelease", () => {
  it("restores literal legacy prop and orientation fields", () => {
    const result = normalizeDeckRelease({
      deckNumber: 7,
      createdAt: "2026-01-01T00:00:00.000Z",
      theme: "classic",
      bluePropType: "poi",
      redPropType: "fan",
      cardCount: 1,
      notes: "",
      stepCountDistribution: { 8: 1 },
      recipe: {
        deckMode: "loop",
        startOriModes: ["radial"],
        gridModes: ["diamond"],
        startOriBlue: "in",
        startOriRed: "out",
      },
      sequences: [
        {
          sequenceId: "s1",
          sourceCatalogId: "c1",
          stepCount: 8,
          word: "AB",
          position: 1,
          footer: {},
          variation: { startOriPair: { blue: "clock", red: "counter" } },
        },
      ],
    } as never);

    expect(result).toMatchObject({
      leftPropType: "poi",
      rightPropType: "fan",
      recipe: { startOriLeft: "in", startOriRight: "out" },
    });
    expect(result.sequences[0]?.variation?.startOriPair).toEqual({
      left: "clock",
      right: "counter",
    });
    expect(result).not.toHaveProperty("bluePropType");
    expect(result.recipe).not.toHaveProperty("startOriBlue");
  });
});
