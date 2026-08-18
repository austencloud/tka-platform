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

  it("resolves clip translation against the source the slot hides", () => {
    // A 1080-square source covering a 1080x1152 slot draws 1152 wide, and the
    // 1.25 scale takes both sides to 1440: 360 hidden across, 288 down. A pan
    // is a fraction of that, so 0.1 across is 36px and -0.25 down is -72px.
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

    expect(geometry.translateX).toBeCloseTo(36);
    expect(geometry.translateY).toBeCloseTo(-72);
    expect(geometry.scale).toBe(1.25);
    expect(geometry.rotationDegrees).toBe(12);
  });

  it("refuses to pan a layer that is hiding nothing", () => {
    // Source and slot share an aspect, so a cover fit hides no source at all.
    // Panning here could only open a gap beside the picture, which is the
    // difference between a crop control and a shove.
    const geometry = resolveFrameLayerGeometry({
      preset,
      region,
      sourceWidth: 1080,
      sourceHeight: 1152,
      transform: {
        scale: 1,
        rotationDegrees: 0,
        translateX: 0.4,
        translateY: -0.5,
      },
    });

    expect(geometry.translateX).toBeCloseTo(0);
    expect(geometry.translateY).toBeCloseTo(0);
  });
});
