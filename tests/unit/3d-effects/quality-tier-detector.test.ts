import { afterEach, describe, expect, it, vi } from "vitest";
import { QualityTierDetector } from "$lib/shared/3d/effects/quality/quality-tier-detector";
import { QualityTier } from "$lib/shared/3d/effects/types";

describe("QualityTierDetector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns HIGH for desktop-class capabilities", () => {
    const detector = new QualityTierDetector();
    const tier = detector.detectFromCapabilities({
      maxTextureUnits: 16,
      floatTextures: true,
      hardwareConcurrency: 12,
      isWebGPU: false,
    });
    expect(tier).toBe(QualityTier.HIGH);
  });

  it("returns MEDIUM for mid-range capabilities", () => {
    const detector = new QualityTierDetector();
    const tier = detector.detectFromCapabilities({
      maxTextureUnits: 8,
      floatTextures: true,
      hardwareConcurrency: 4,
      isWebGPU: false,
    });
    expect(tier).toBe(QualityTier.MEDIUM);
  });

  it("returns LOW for weak capabilities", () => {
    const detector = new QualityTierDetector();
    const tier = detector.detectFromCapabilities({
      maxTextureUnits: 4,
      floatTextures: false,
      hardwareConcurrency: 2,
      isWebGPU: false,
    });
    expect(tier).toBe(QualityTier.LOW);
  });

  it("uses renderer capabilities instead of blanket mobile downgrading", () => {
    vi.stubGlobal("navigator", {
      hardwareConcurrency: 8,
      userAgent: "Mozilla/5.0 (Linux; Android 16) Mobile",
    });

    const detector = new QualityTierDetector();
    const tier = detector.detectFromRenderer({
      capabilities: {
        maxTextures: 16,
      },
      extensions: {
        has: (extensionName: string) =>
          extensionName === "EXT_color_buffer_float",
      },
    });

    expect(tier).toBe(QualityTier.HIGH);
  });

  it("allows manual override", () => {
    const detector = new QualityTierDetector();
    detector.setOverride(QualityTier.LOW);
    expect(detector.currentTier).toBe(QualityTier.LOW);
  });

  it("clears override to return detected tier", () => {
    const detector = new QualityTierDetector();
    detector.detectFromCapabilities({
      maxTextureUnits: 16,
      floatTextures: true,
      hardwareConcurrency: 12,
      isWebGPU: false,
    });
    detector.setOverride(QualityTier.LOW);
    detector.clearOverride();
    expect(detector.currentTier).toBe(QualityTier.HIGH);
  });
});
