import { describe, expect, it } from "vitest";
import {
  createDefaultAutumnConfig,
  normalizeAutumnConfig,
} from "./autumn-scene-config";

describe("Autumn Scene Lab config", () => {
  it("replaces the deleted procedural-scene shape with production defaults", () => {
    expect(
      normalizeAutumnConfig({
        treeDensity: 0.7,
        leafCount: 900,
        fireflyCount: 80,
      })
    ).toEqual(createDefaultAutumnConfig());
  });

  it("merges partial production controls without losing nested defaults", () => {
    const normalized = normalizeAutumnConfig({
      stars: { enabled: false },
      fog: { density: 0.02 },
      magicIntensity: 1.4,
    });

    expect(normalized.stars.enabled).toBe(false);
    expect(normalized.stars.countScale).toBe(1);
    expect(normalized.fog.density).toBe(0.02);
    expect(normalized.fog.color).toBe("#2b172f");
    expect(normalized.sky.bottomColor).toBe(normalized.fog.color);
    expect(normalized.magicIntensity).toBe(1.4);
  });

  it("rejects malformed values and clamps persisted numbers to control bounds", () => {
    const normalized = normalizeAutumnConfig({
      sky: { topColor: "javascript:red", bottomColor: "#aBc123" },
      fog: { color: 42, density: Number.NaN },
      stars: {
        enabled: "yes",
        countScale: 99,
        sizeScale: -4,
        intensity: Number.POSITIVE_INFINITY,
      },
      groundDetailStrength: -2,
      magicIntensity: 20,
    });

    expect(normalized.sky.topColor).toBe("#120b2b");
    expect(normalized.sky.bottomColor).toBe("#aBc123");
    expect(normalized.fog).toEqual({ color: "#2b172f", density: 0.016 });
    expect(normalized.stars.enabled).toBe(true);
    expect(normalized.stars.countScale).toBe(1.5);
    expect(normalized.stars.sizeScale).toBe(0.5);
    expect(normalized.stars.intensity).toBe(1.35);
    expect(normalized.groundDetailStrength).toBe(0);
    expect(normalized.magicIntensity).toBe(2);
  });
});
