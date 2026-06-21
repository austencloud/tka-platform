import { describe, it, expect } from "vitest";
import { tunnelPropColor } from "./tunnel-prop-colors";

describe("tunnelPropColor", () => {
  it("anchors the base pair at blue and red", () => {
    const blue = tunnelPropColor(0, 7); // base blue
    const red = tunnelPropColor(1, 7); // base red
    // Base blue: blue channel dominates.
    expect(blue.rgb255.b).toBeGreaterThan(blue.rgb255.r);
    expect(blue.rgb255.b).toBeGreaterThan(blue.rgb255.g);
    // Base red: red channel dominates.
    expect(red.rgb255.r).toBeGreaterThan(red.rgb255.g);
    expect(red.rgb255.r).toBeGreaterThan(red.rgb255.b);
  });

  it("fans the blue family toward green (far end is green-dominant)", () => {
    const far = tunnelPropColor(2 + 2 * 6, 7); // last blue layer (familyIndex 7)
    expect(far.rgb255.g).toBeGreaterThan(far.rgb255.r);
    expect(far.rgb255.g).toBeGreaterThan(far.rgb255.b);
  });

  it("fans the red family toward magenta (far end has strong red+blue, low green)", () => {
    const far = tunnelPropColor(3 + 2 * 6, 7); // last red layer (familyIndex 7)
    expect(far.rgb255.b).toBeGreaterThan(far.rgb255.g);
    expect(far.rgb255.r).toBeGreaterThan(far.rgb255.g);
  });

  it("returns distinct colors per layer (no repeats)", () => {
    const hexes = new Set<string>();
    for (let li = 0; li < 7; li++) {
      hexes.add(tunnelPropColor(2 + 2 * li, 7).hex);
      hexes.add(tunnelPropColor(3 + 2 * li, 7).hex);
    }
    expect(hexes.size).toBe(14);
  });

  it("produces valid hex", () => {
    expect(tunnelPropColor(4, 7).hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});
