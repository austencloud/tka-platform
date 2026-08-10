import { describe, expect, it } from "vitest";
import {
  BackgroundType,
  CelestialBackgroundSystem,
} from "@austencloud/backgrounds";
import { DEFAULT_CELESTIAL_LAB_SETTINGS } from "../../src/lib/shared/background-builder/domain/lab-settings-types";
import { normalizeCelestialLabSettings } from "../../src/lib/shared/background-builder/domain/celestial-lab-settings";
import { BACKGROUND_THEME_COLORS } from "../../src/lib/shared/theme/config/tka-theme-config";

describe("Celestial 2D background contract", () => {
  it("loads the cloud-only renderer from the installed package", () => {
    const system = new CelestialBackgroundSystem();

    expect(system.getLayerVisibility()).toEqual({
      gradient: true,
      clouds: true,
      sunGlow: true,
      atmosphere: true,
      vignette: true,
    });
  });

  it("migrates legacy island settings into the cloud scene", () => {
    const migrated = normalizeCelestialLabSettings({
      quality: "medium",
      layers: {
        clouds: false,
        godRays: false,
        islands: true,
        pillars: false,
      },
    });

    expect(migrated).toEqual({
      quality: "medium",
      layers: {
        clouds: false,
        sunGlow: true,
        atmosphere: true,
        vignette: true,
      },
    });
  });

  it("falls back to current defaults for invalid saved data", () => {
    expect(
      normalizeCelestialLabSettings({ quality: "maximum", layers: null })
    ).toEqual(DEFAULT_CELESTIAL_LAB_SETTINGS);
  });

  it("uses the bright sky palette in TKA", () => {
    expect(BACKGROUND_THEME_COLORS[BackgroundType.CELESTIAL]).toEqual([
      "#2070c8",
      "#4a9ae8",
      "#8dc4e8",
      "#d4c8a0",
    ]);
  });
});
