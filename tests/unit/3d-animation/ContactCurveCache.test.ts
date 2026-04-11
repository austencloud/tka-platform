import { describe, it, expect } from "vitest";
import { ContactCurveCache } from "$lib/shared/3d/services/implementations/ContactCurveCache";
import type { ContactCurveData } from "$lib/shared/3d/services/contracts/IContactCurveCache";

const testCurve: ContactCurveData = {
  clipName: "test-clip",
  frameRate: 30,
  frameCount: 4,
  leftFoot:  [1.0, 1.0, 0.0, 0.0],
  rightFoot: [0.0, 0.0, 1.0, 1.0],
};

describe("ContactCurveCache", () => {
  it("returns zero contact when no curve is registered", () => {
    const cache = new ContactCurveCache();
    const result = cache.getContactAt("unknown-clip", 0.5);
    expect(result.leftFoot).toBe(0);
    expect(result.rightFoot).toBe(0);
    expect(result.hasCurve).toBe(false);
  });

  it("samples the first frame at phase 0", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    const result = cache.getContactAt("test-clip", 0);
    expect(result.leftFoot).toBeCloseTo(1.0);
    expect(result.rightFoot).toBeCloseTo(0.0);
    expect(result.hasCurve).toBe(true);
  });

  it("samples the last frame at phase 1", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    const result = cache.getContactAt("test-clip", 1);
    expect(result.leftFoot).toBeCloseTo(0.0);
    expect(result.rightFoot).toBeCloseTo(1.0);
  });

  it("linearly interpolates between frames", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    // Phase 0.5 = between frames 1 and 2 (0.5 * 3 = 1.5)
    // left:  frames [1.0, 1.0, 0.0, 0.0] -> at index 1.5 -> 0.5
    // right: frames [0.0, 0.0, 1.0, 1.0] -> at index 1.5 -> 0.5
    const result = cache.getContactAt("test-clip", 0.5);
    expect(result.leftFoot).toBeCloseTo(0.5, 3);
    expect(result.rightFoot).toBeCloseTo(0.5, 3);
  });

  it("clamps out-of-range phase", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    const low = cache.getContactAt("test-clip", -0.5);
    const high = cache.getContactAt("test-clip", 1.5);
    expect(low.leftFoot).toBeCloseTo(1.0);
    expect(high.rightFoot).toBeCloseTo(1.0);
  });
});
