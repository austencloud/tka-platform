import { describe, it, expect } from "vitest";
import {
  calculateBetaOffset,
  type BetaMotionInput,
  type BetaOffsetInput,
} from "$lib/shared/render/core/calculations/beta-offset";
import { getBetaOffsetSize } from "$lib/shared/render/core/constants/prop-classification";

/**
 * When two props end at the same point (a "beta" position) they must be offset
 * so they don't render on top of each other. calculateBetaOffset is a sequence
 * of skip "gates" followed by a direction lookup. The recurring domain truth is
 * that the two props separate SYMMETRICALLY — blue's offset is the mirror of
 * red's — and that mismatched configurations skip with a zero offset. A wrong
 * gate silently overlaps or mis-separates the props.
 */

function motion(overrides: Partial<BetaMotionInput>): BetaMotionInput {
  return {
    startLocation: "n",
    endLocation: "n",
    motionType: "static",
    color: "blue",
    ...overrides,
  };
}

describe("calculateBetaOffset — Gate 1: distinct end locations", () => {
  it("returns a zero offset when the props end at different locations", () => {
    const input: BetaOffsetInput = {
      blueMotion: motion({ endLocation: "n", color: "blue" }),
      redMotion: motion({ endLocation: "s", color: "red" }),
      letter: "A",
      gridMode: "diamond",
    };
    expect(calculateBetaOffset(input, input.blueMotion)).toEqual({ x: 0, y: 0 });
    expect(calculateBetaOffset(input, input.redMotion)).toEqual({ x: 0, y: 0 });
  });
});

describe("calculateBetaOffset — both hands", () => {
  it("separates the two hands horizontally by the hand offset size", () => {
    const input: BetaOffsetInput = {
      // Neither hand starts from an east/west position -> default branch.
      blueMotion: motion({ endLocation: "n", startLocation: "n", color: "blue", propType: "hand" }),
      redMotion: motion({ endLocation: "n", startLocation: "n", color: "red", propType: "hand" }),
      letter: "A",
      gridMode: "diamond",
    };
    const blue = calculateBetaOffset(input, input.blueMotion);
    const red = calculateBetaOffset(input, input.redMotion);

    const size = getBetaOffsetSize("hand", "diamond");
    expect(Math.abs(blue.x)).toBeCloseTo(size, 6);
    expect(Math.abs(red.x)).toBeCloseTo(size, 6);
    expect(blue.y).toBe(0);
    expect(red.y).toBe(0);
    // Symmetric separation.
    expect(blue.x).toBeCloseTo(-red.x, 6);
  });

  it("orients by approach: blue-from-east goes right, red-from-west goes left", () => {
    const input: BetaOffsetInput = {
      blueMotion: motion({ endLocation: "n", startLocation: "e", color: "blue", propType: "hand" }),
      redMotion: motion({ endLocation: "n", startLocation: "w", color: "red", propType: "hand" }),
      letter: "A",
      gridMode: "diamond",
    };
    const blue = calculateBetaOffset(input, input.blueMotion);
    const red = calculateBetaOffset(input, input.redMotion);
    expect(blue.x).toBeGreaterThan(0); // blue from east -> right
    expect(red.x).toBeLessThan(0); // red from west -> left
  });
});

describe("calculateBetaOffset — Gate 3: hybrid orientation skip", () => {
  it("returns a zero offset when one prop is radial and the other non-radial", () => {
    const input: BetaOffsetInput = {
      blueMotion: motion({ endLocation: "n", color: "blue", motionType: "static", endOrientation: "in", propType: "staff" }),
      redMotion: motion({ endLocation: "n", color: "red", motionType: "static", endOrientation: "clock", propType: "staff" }),
      letter: "A",
      gridMode: "diamond",
    };
    expect(calculateBetaOffset(input, input.blueMotion)).toEqual({ x: 0, y: 0 });
    expect(calculateBetaOffset(input, input.redMotion)).toEqual({ x: 0, y: 0 });
  });
});

describe("calculateBetaOffset — symmetric separation (letter G)", () => {
  it("gives blue the exact mirror of red's offset", () => {
    const input: BetaOffsetInput = {
      blueMotion: motion({
        startLocation: "e",
        endLocation: "s",
        motionType: "pro",
        color: "blue",
        endOrientation: "in",
        propType: "staff",
      }),
      redMotion: motion({
        startLocation: "w",
        endLocation: "s",
        motionType: "pro",
        color: "red",
        endOrientation: "in",
        propType: "staff",
      }),
      letter: "G",
      gridMode: "diamond",
    };
    const blue = calculateBetaOffset(input, input.blueMotion);
    const red = calculateBetaOffset(input, input.redMotion);

    // The two props must push apart symmetrically.
    expect(blue.x).toBeCloseTo(-red.x, 6);
    expect(blue.y).toBeCloseTo(-red.y, 6);
    // And the separation must be non-zero (they really do move apart).
    expect(Math.abs(blue.x) + Math.abs(blue.y)).toBeGreaterThan(0);
  });

  it("uses the staff offset size for the separation magnitude", () => {
    const input: BetaOffsetInput = {
      blueMotion: motion({ startLocation: "e", endLocation: "s", motionType: "pro", color: "blue", endOrientation: "in", propType: "staff" }),
      redMotion: motion({ startLocation: "w", endLocation: "s", motionType: "pro", color: "red", endOrientation: "in", propType: "staff" }),
      letter: "G",
      gridMode: "diamond",
    };
    const red = calculateBetaOffset(input, input.redMotion);
    const size = getBetaOffsetSize("staff", "diamond");
    // South special-case direction is horizontal (right), so magnitude is on x.
    expect(Math.hypot(red.x, red.y)).toBeCloseTo(size, 6);
  });
});

describe("calculateBetaOffset — buugeng opposite chirality nests (Gate 4)", () => {
  it("returns a zero offset for two opposite-chirality buugeng props", () => {
    const input: BetaOffsetInput = {
      blueMotion: motion({ endLocation: "n", color: "blue", motionType: "static", endOrientation: "in", propType: "buugeng" }),
      redMotion: motion({ endLocation: "n", color: "red", motionType: "static", endOrientation: "in", propType: "buugeng" }),
      letter: "A",
      gridMode: "diamond",
      blueBuugengFlipped: true,
      redBuugengFlipped: false,
    };
    expect(calculateBetaOffset(input, input.blueMotion)).toEqual({ x: 0, y: 0 });
  });
});
