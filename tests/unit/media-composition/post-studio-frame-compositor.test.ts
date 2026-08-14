import { describe, expect, it } from "vitest";
import { POST_STUDIO_PRESETS } from "$lib/shared/media-composition/domain/post-studio-presets";
import { resolveFrameLayerGeometry } from "$lib/shared/media-composition/services/post-studio-frame-compositor";

const preset = POST_STUDIO_PRESETS.find(
  (candidate) => candidate.id === "performance-breakdown"
)!;
const region = preset.regions.find(
  (candidate) => candidate.id === "performance"
)!;

describe("resolveFrameLayerGeometry", () => {
  it("resolves the performance crop in output pixels", () => {
    const geometry = resolveFrameLayerGeometry({
      preset,
      region,
      sourceWidth: 1920,
      sourceHeight: 1080,
      transform: {
        scale: 1,
        rotationDegrees: 0,
        translateX: 0,
        translateY: 0,
      },
    });

    expect(geometry.region).toEqual({
      x: 0,
      y: 0,
      width: 1080,
      height: 1152,
    });
    expect(geometry.drawRect.x).toBeCloseTo(-484);
    expect(geometry.drawRect.y).toBe(0);
    expect(geometry.drawRect.width).toBeCloseTo(2048);
    expect(geometry.drawRect.height).toBe(1152);
  });

  it("converts normalized clip translation into region pixels", () => {
    const geometry = resolveFrameLayerGeometry({
      preset,
      region,
      sourceWidth: 1080,
      sourceHeight: 1080,
      transform: {
        scale: 1.25,
        rotationDegrees: 12,
        translateX: 0.1,
        translateY: -0.25,
      },
    });

    expect(geometry.translateX).toBe(108);
    expect(geometry.translateY).toBe(-288);
    expect(geometry.scale).toBe(1.25);
    expect(geometry.rotationDegrees).toBe(12);
  });
});
