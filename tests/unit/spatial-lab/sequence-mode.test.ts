import { describe, it, expect } from "vitest";
import { DEMO_SEQUENCES, type DemoSequence } from "../../../src/lib/features/lab/tabs/spatial-lab/services/demo-sequences";

describe("demo-sequences", () => {
  it("has at least 3 sequences", () => {
    expect(DEMO_SEQUENCES.length).toBeGreaterThanOrEqual(3);
  });

  it("every sequence has 2+ beats with valid 3D positions", () => {
    for (const seq of DEMO_SEQUENCES) {
      expect(seq.beats.length).toBeGreaterThanOrEqual(2);
      for (const beat of seq.beats) {
        expect(beat.left).toHaveProperty("x");
        expect(beat.left).toHaveProperty("y");
        expect(beat.left).toHaveProperty("z");
        expect(beat.right).toHaveProperty("x");
        expect(beat.right).toHaveProperty("y");
        expect(beat.right).toHaveProperty("z");
      }
    }
  });

  it("every sequence has a name and description", () => {
    for (const seq of DEMO_SEQUENCES) {
      expect(seq.name.length).toBeGreaterThan(0);
      expect(seq.description.length).toBeGreaterThan(0);
    }
  });

  it("plane split sequence has beats with z > 0 (behind)", () => {
    const planeSplit = DEMO_SEQUENCES.find((s) => s.name === "Plane Split");
    expect(planeSplit).toBeDefined();
    const hasDepth = planeSplit!.beats.some(
      (b) => b.left.z > 0 || b.right.z > 0,
    );
    expect(hasDepth).toBe(true);
  });

  it("crossing sequence has beats where arms cross center", () => {
    const crossing = DEMO_SEQUENCES.find((s) => s.name === "Crossing");
    expect(crossing).toBeDefined();
    const hasCross = crossing!.beats.some(
      (b) => b.left.x > 0 && b.right.x < 0,
    );
    expect(hasCross).toBe(true);
  });

  it("height sweep has beats with non-zero y", () => {
    const heightSweep = DEMO_SEQUENCES.find((s) => s.name === "Height Sweep");
    expect(heightSweep).toBeDefined();
    const hasHeight = heightSweep!.beats.some(
      (b) => b.left.y !== 0 || b.right.y !== 0,
    );
    expect(hasHeight).toBe(true);
  });
});
