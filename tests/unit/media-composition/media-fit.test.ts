import { describe, expect, it } from "vitest";
import { calculateMediaFit } from "$lib/shared/media-composition/services/media-fit";

describe("calculateMediaFit", () => {
  it("centers a landscape source inside a portrait region", () => {
    const result = calculateMediaFit({
      sourceWidth: 1920,
      sourceHeight: 1080,
      regionWidth: 1080,
      regionHeight: 960,
      fit: "contain",
    });

    expect(result.drawRect).toEqual({
      x: 0,
      y: 176.25,
      width: 1080,
      height: 607.5,
    });
    expect(result.visibleSourceRect).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("returns the exact horizontal crop for a landscape source covering portrait", () => {
    const result = calculateMediaFit({
      sourceWidth: 1920,
      sourceHeight: 1080,
      regionWidth: 1080,
      regionHeight: 960,
      fit: "cover",
    });

    expect(result.drawRect.x).toBeCloseTo(-313.333333, 5);
    expect(result.drawRect.y).toBe(0);
    expect(result.drawRect.width).toBeCloseTo(1706.666667, 5);
    expect(result.drawRect.height).toBe(960);
    expect(result.visibleSourceRect).toEqual({
      x: 352.5,
      y: 0,
      width: 1215,
      height: 1080,
    });
  });

  it("stretches the full source into the region for fill", () => {
    expect(
      calculateMediaFit({
        sourceWidth: 800,
        sourceHeight: 1200,
        regionWidth: 1080,
        regionHeight: 1920,
        fit: "fill",
      })
    ).toEqual({
      drawRect: { x: 0, y: 0, width: 1080, height: 1920 },
      visibleSourceRect: { x: 0, y: 0, width: 800, height: 1200 },
    });
  });

  it("rejects geometry that cannot produce a frame", () => {
    expect(() =>
      calculateMediaFit({
        sourceWidth: 0,
        sourceHeight: 1080,
        regionWidth: 1080,
        regionHeight: 1920,
        fit: "cover",
      })
    ).toThrow("sourceWidth must be a positive finite number");
  });
});
