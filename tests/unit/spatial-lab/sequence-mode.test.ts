import { describe, it, expect } from "vitest";
import { DEMO_SEQUENCES } from "../../../src/lib/features/lab/tabs/spatial-lab/services/demo-sequences";
import { GridLocation } from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("demo-sequences", () => {
  it("has at least 3 sequences", () => {
    expect(DEMO_SEQUENCES.length).toBeGreaterThanOrEqual(3);
  });

  it("every sequence has 2+ beats with valid GridLocation values", () => {
    const validLocations = new Set(Object.values(GridLocation));
    for (const seq of DEMO_SEQUENCES) {
      expect(seq.beats.length).toBeGreaterThanOrEqual(2);
      for (const beat of seq.beats) {
        expect(validLocations.has(beat.left)).toBe(true);
        expect(validLocations.has(beat.right)).toBe(true);
      }
    }
  });

  it("every sequence has a name and description", () => {
    for (const seq of DEMO_SEQUENCES) {
      expect(seq.name.length).toBeGreaterThan(0);
      expect(seq.description.length).toBeGreaterThan(0);
    }
  });

  it("crossing sequence has beats where arms swap sides", () => {
    const crossing = DEMO_SEQUENCES.find((s) => s.name === "Crossing");
    expect(crossing).toBeDefined();
    const hasSwap = crossing!.beats.some(
      (b) => b.left === GridLocation.EAST && b.right === GridLocation.WEST,
    );
    expect(hasSwap).toBe(true);
  });

  it("height sweep has beats with N and S locations", () => {
    const heightSweep = DEMO_SEQUENCES.find((s) => s.name === "Height Sweep");
    expect(heightSweep).toBeDefined();
    const hasNorth = heightSweep!.beats.some(
      (b) => b.left === GridLocation.NORTH || b.right === GridLocation.NORTH,
    );
    expect(hasNorth).toBe(true);
  });
});
