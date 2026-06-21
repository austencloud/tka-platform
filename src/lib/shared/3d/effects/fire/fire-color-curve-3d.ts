/**
 * FireColorCurve3D - Color ramp presets for volumetric fire shader.
 *
 * Each preset defines four color stops that the raymarching shader interpolates
 * through based on local fire density/temperature:
 *   hot  → core of flame (brightest, highest density)
 *   warm → mid-flame body
 *   cool → outer edge / dying flame
 *   smoke → nearly-extinguished wisps
 *
 * Colors are normalized to [0,1] for direct use as GLSL vec3 uniforms.
 */

import { Color } from "three";

export type FireColorPreset = "classic" | "blue" | "spirit" | "custom";

export interface FireColorSet {
  hot: Color;
  warm: Color;
  cool: Color;
  smoke: Color;
}

const hex = (r: number, g: number, b: number) => new Color(r / 255, g / 255, b / 255);

const PRESETS: Record<Exclude<FireColorPreset, "custom">, FireColorSet> = {
  classic: {
    // Amber woodfire ramp. Hot stays warm-cream (not white) so additive
    // overlap saturates toward amber instead of clipping all channels to a
    // white-yellow blob that greens out over a cool scene. Warm is true fire
    // orange, not the old bright yellow.
    hot:   hex(255, 217, 168),  // #FFD9A8 - warm cream core
    warm:  hex(255, 122, 24),   // #FF7A18 - fire orange body
    cool:  hex(200, 40, 10),    // #C8280A - deep red outer
    smoke: hex(40, 35, 30),     // #28231E - dark smoke
  },
  blue: {
    hot:   hex(220, 240, 255),  // #DCF0FF - icy white core
    warm:  hex(80, 160, 255),   // #50A0FF - vivid blue
    cool:  hex(30, 50, 180),    // #1E32B4 - deep indigo
    smoke: hex(30, 30, 45),     // #1E1E2D - midnight
  },
  spirit: {
    hot:   hex(220, 255, 230),  // #DCFFE6 - pale green core
    warm:  hex(40, 220, 120),   // #28DC78 - vivid green
    cool:  hex(10, 100, 80),    // #0A6450 - forest
    smoke: hex(25, 35, 30),     // #19231E - dark green-grey
  },
};

export function getFireColors(preset: FireColorPreset, customColors?: Partial<FireColorSet>): FireColorSet {
  if (preset === "custom" && customColors) {
    return {
      hot:   customColors.hot   ?? PRESETS.classic.hot,
      warm:  customColors.warm  ?? PRESETS.classic.warm,
      cool:  customColors.cool  ?? PRESETS.classic.cool,
      smoke: customColors.smoke ?? PRESETS.classic.smoke,
    };
  }

  const key = preset === "custom" ? "classic" : preset;
  return { ...PRESETS[key] };
}
