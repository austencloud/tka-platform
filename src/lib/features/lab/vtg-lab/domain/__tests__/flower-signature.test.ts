import { describe, it, expect } from "vitest";
import {
  buildFlowerAxis,
  flowerPetals,
  flowerKey,
  flowerLabel,
  flowerTurnPattern,
} from "../flower-signature";

describe("flower-signature", () => {
  it("enumerates 56 flowers ordered by turns, pro/anti alternating per step", () => {
    const axis = buildFlowerAxis();
    expect(axis).toHaveLength(56); // 2 styles × 7 turns × 2 orientations × 2 grids
    // turns ascending; pro before anti, in before out, diamond before box twin
    expect(axis[0]).toMatchObject({ style: "pro", turns: 0, ori: "in", grid: "diamond" });
    expect(axis[1]).toMatchObject({ style: "pro", turns: 0, ori: "in", grid: "box" });
    expect(axis[2]).toMatchObject({ style: "pro", turns: 0, ori: "out", grid: "diamond" });
    expect(axis[4]).toMatchObject({ style: "anti", turns: 0, ori: "in", grid: "diamond" });
    expect(axis[8]).toMatchObject({ style: "pro", turns: 0.5, ori: "in", grid: "diamond" });
    // turns never decrease as we walk the axis → one direction of climb
    for (let i = 1; i < axis.length; i++) {
      expect(axis[i]!.turns).toBeGreaterThanOrEqual(axis[i - 1]!.turns);
    }
    // both styles present within the first turn step (alternating, not blocked)
    const firstStep = axis.filter((f) => f.turns === 0).map((f) => f.style);
    expect(firstStep).toEqual(["pro", "pro", "pro", "pro", "anti", "anti", "anti", "anti"]);
  });

  it("computes petals: pro = 2t, anti = 2t + 2", () => {
    expect(flowerPetals({ style: "pro", turns: 0.5 })).toBe(1);
    expect(flowerPetals({ style: "anti", turns: 0.5 })).toBe(3); // triquetra
    expect(flowerPetals({ style: "pro", turns: 3 })).toBe(6);
    expect(flowerPetals({ style: "anti", turns: 3 })).toBe(8);
  });

  it("formats a deck-compatible turn pattern (integers bare, halves X.5)", () => {
    expect(flowerTurnPattern({ turns: 1 })).toBe("1|1");
    expect(flowerTurnPattern({ turns: 0.5 })).toBe("0.5|0.5");
  });

  it("builds a stable key and a human label", () => {
    const f = { style: "anti", turns: 0.5, ori: "out", grid: "box", petals: 3 } as const;
    expect(flowerKey(f)).toBe("anti-0.5-out-box");
    expect(flowerLabel(f)).toBe("Anti 0.5t out box · 3p");
  });
});
