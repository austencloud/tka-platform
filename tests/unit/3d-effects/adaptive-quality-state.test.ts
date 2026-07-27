import { afterEach, describe, expect, it, vi } from "vitest";

import { QualityTierDetector } from "$lib/shared/3d/effects/quality/quality-tier-detector";
import { QualityTier } from "$lib/shared/3d/effects/types";
import { createAdaptiveQualityState } from "$lib/shared/3d/state/adaptive-quality-state.svelte";

function detectorAt(tier: QualityTier): QualityTierDetector {
  const detector = new QualityTierDetector();
  detector.detectFromCapabilities({
    maxTextureUnits: tier === QualityTier.HIGH ? 16 : 8,
    floatTextures: tier !== QualityTier.LOW,
    hardwareConcurrency:
      tier === QualityTier.HIGH ? 12 : tier === QualityTier.MEDIUM ? 4 : 2,
    isWebGPU: false,
  });
  return detector;
}

function feedFps(
  state: ReturnType<typeof createAdaptiveQualityState>,
  fps: number,
  seconds: number
): void {
  const frames = Math.ceil(fps * seconds);
  for (let frame = 0; frame < frames; frame += 1) {
    state.observeFrame(1 / fps, true);
  }
}

describe("adaptive 3D quality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts from the detector's capability tier", () => {
    const state = createAdaptiveQualityState(detectorAt(QualityTier.HIGH), {
      devicePixelRatio: 3,
    });

    expect(state.tier).toBe(QualityTier.HIGH);
    expect(state.contentTier).toBe(QualityTier.HIGH);
    expect(state.pixelRatio).toBe(2);
  });

  it("ignores an isolated hitch instead of visibly changing quality", () => {
    const state = createAdaptiveQualityState(detectorAt(QualityTier.HIGH), {
      devicePixelRatio: 2,
    });

    feedFps(state, 20, 0.25);
    feedFps(state, 60, 2);

    expect(state.level).toBe(4);
    expect(state.tier).toBe(QualityTier.HIGH);
  });

  it("drops two levels after severe sustained frame pressure", () => {
    const state = createAdaptiveQualityState(detectorAt(QualityTier.HIGH), {
      devicePixelRatio: 2,
    });

    feedFps(state, 30, 1.1);

    expect(state.level).toBe(2);
    expect(state.tier).toBe(QualityTier.MEDIUM);
    expect(state.contentTier).toBe(QualityTier.HIGH);
    expect(state.pixelRatio).toBe(1.25);
  });

  it("reaches a sub-1x emergency floor when LOW still misses its budget", () => {
    const state = createAdaptiveQualityState(detectorAt(QualityTier.LOW), {
      devicePixelRatio: 3,
    });

    feedFps(state, 30, 1.1);

    expect(state.level).toBe(0);
    expect(state.tier).toBe(QualityTier.LOW);
    expect(state.pixelRatio).toBe(0.5);
  });

  it.each([QualityTier.MEDIUM, QualityTier.HIGH])(
    "keeps %s-capability devices at or above native CSS resolution",
    (capabilityTier) => {
      const state = createAdaptiveQualityState(detectorAt(capabilityTier), {
        devicePixelRatio: 3,
      });

      feedFps(state, 30, 3);

      expect(state.level).toBe(1);
      expect(state.contentTier).toBe(capabilityTier);
      expect(state.pixelRatio).toBe(1);
    }
  );

  it("does not immediately retry a quality level that caused severe pressure", () => {
    const state = createAdaptiveQualityState(detectorAt(QualityTier.LOW), {
      devicePixelRatio: 3,
    });

    feedFps(state, 30, 1.1);
    feedFps(state, 60, 12);

    expect(state.level).toBe(0);
  });

  it("raises one level only after sustained 60 fps headroom", () => {
    const state = createAdaptiveQualityState(detectorAt(QualityTier.LOW), {
      devicePixelRatio: 3,
    });

    feedFps(state, 60, 6.2);

    expect(state.level).toBe(2);
    expect(state.tier).toBe(QualityTier.MEDIUM);
    expect(state.contentTier).toBe(QualityTier.LOW);
    expect(state.pixelRatio).toBe(1.25);
  });

  it("does not adapt across a manual quality override", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const detector = detectorAt(QualityTier.HIGH);
    detector.setOverride(QualityTier.HIGH);
    const state = createAdaptiveQualityState(detector, {
      devicePixelRatio: 2,
    });

    feedFps(state, 20, 4);

    expect(state.level).toBe(4);
    expect(state.tier).toBe(QualityTier.HIGH);
  });
});
