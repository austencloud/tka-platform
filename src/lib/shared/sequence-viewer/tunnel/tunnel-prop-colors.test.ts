import { describe, it, expect } from "vitest";
import {
  SPOTLIGHT_DIM,
  dimHex,
  normalizeTunnelHexColor,
  resolveTunnelPropColorState,
  tunnelColorFromHex,
  spotlightFactor,
  tunnelPropColor,
} from "./tunnel-prop-colors";

describe("tunnelPropColor", () => {
  it("anchors the base pair at blue and red", () => {
    const left = tunnelPropColor(0, 7); // base blue
    const right = tunnelPropColor(1, 7); // base red
    // Base blue: blue channel dominates.
    expect(left.rgb255.b).toBeGreaterThan(left.rgb255.r);
    expect(left.rgb255.b).toBeGreaterThan(left.rgb255.g);
    // Base red: red channel dominates.
    expect(right.rgb255.r).toBeGreaterThan(right.rgb255.g);
    expect(right.rgb255.r).toBeGreaterThan(right.rgb255.b);
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

describe("Tunnel exact color state", () => {
  it("normalizes six- and three-digit hex colors", () => {
    expect(normalizeTunnelHexColor(" #A1B2C3 ", "#000000")).toBe("#a1b2c3");
    expect(normalizeTunnelHexColor("#0f8", "#000000")).toBe("#00ff88");
    expect(normalizeTunnelHexColor("transparent", "#123456")).toBe("#123456");
  });

  it("migrates the legacy spectrum boolean without losing a custom pair", () => {
    expect(resolveTunnelPropColorState(undefined, false).mode).toBe("hands");
    expect(resolveTunnelPropColorState(undefined, true).mode).toBe("spectrum");
    expect(
      resolveTunnelPropColorState({
        mode: "custom",
        custom: { blue: "#123ABC", red: "#fedcba" },
      })
    ).toEqual({
      mode: "custom",
      custom: { left: "#123abc", right: "#fedcba" },
    });
  });

  it("converts exact hex values to renderer color channels", () => {
    expect(tunnelColorFromHex("#804020")).toEqual({
      hex: "#804020",
      rgb255: { r: 128, g: 64, b: 32 },
      rgb01: { r: 128 / 255, g: 64 / 255, b: 32 / 255 },
    });
  });
});

describe("spotlightFactor", () => {
  it("is full (1) when nothing is selected", () => {
    expect(spotlightFactor(null, 0)).toBe(1);
    expect(spotlightFactor(undefined, 3)).toBe(1);
  });

  it("is full for the selected family, dimmed for every other", () => {
    // Select copy arm 2 → family 2 bright; base (0) and other copies dim.
    expect(spotlightFactor(2, 2)).toBe(1);
    expect(spotlightFactor(2, 0)).toBe(SPOTLIGHT_DIM);
    expect(spotlightFactor(2, 1)).toBe(SPOTLIGHT_DIM);
    // Select the base ("you", arm 0) → family 0 bright; copies dim.
    expect(spotlightFactor(0, 0)).toBe(1);
    expect(spotlightFactor(0, 1)).toBe(SPOTLIGHT_DIM);
  });

  it("keeps every generated instance of one authored performer bright", () => {
    expect(spotlightFactor([1, 5], 1)).toBe(1);
    expect(spotlightFactor([1, 5], 5)).toBe(1);
    expect(spotlightFactor([1, 5], 3)).toBe(SPOTLIGHT_DIM);
  });
});

describe("dimHex", () => {
  it("returns the color unchanged at factor >= 1", () => {
    expect(dimHex("#3366ff", 1)).toBe("#3366ff");
  });

  it("scales the channels toward black", () => {
    expect(dimHex("#ffffff", 0.5)).toBe("#808080"); // 255 * 0.5 = 127.5 → 128
    expect(dimHex("#ffffff", 0)).toBe("#000000");
  });

  it("leaves malformed input alone", () => {
    expect(dimHex("nope", 0.5)).toBe("nope");
  });
});
