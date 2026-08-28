import { describe, expect, it } from "vitest";
import { normalizeCameraFrameDelta } from "@austencloud/camera-3d";

describe("camera frame delta", () => {
  it("normalizes a negative background-tab delta", () => {
    expect(normalizeCameraFrameDelta(-0.07264)).toBeCloseTo(0.07264, 8);
  });

  it("caps debugger and renderer stalls", () => {
    expect(normalizeCameraFrameDelta(2.5)).toBe(0.1);
  });

  it("lets fixed-step vehicle consumers request a larger bounded catch-up", () => {
    expect(normalizeCameraFrameDelta(0.125, 0.25)).toBe(0.125);
    expect(normalizeCameraFrameDelta(2.5, 0.25)).toBe(0.25);
    expect(normalizeCameraFrameDelta(2.5, 5)).toBe(0.25);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite delta %s",
    (delta) => {
      expect(normalizeCameraFrameDelta(delta)).toBe(0);
    }
  );
});
