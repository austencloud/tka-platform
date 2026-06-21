/**
 * Tunnel layer coloration.
 *
 * Beyond the base blue/red pair, every overlaid kaleidoscope copy used to reuse
 * the base colors — so a fold-8 + mirror stack just repeated purple/orange. This
 * spreads the layers across the spectrum while keeping the two families on
 * opposite ends:
 *
 *   - Blue family (even propIndex) fans the COOL arc: blue → cyan → green.
 *     Green is the blue family's far end (green reads as "closer to blue").
 *   - Red family (odd propIndex) fans the WARM/PINK arc: red → pink → magenta.
 *     Magenta is the red family's far end ("closer to red").
 *
 * The base pair (propIndex 0 = blue, 1 = red) is left to the app's own colors;
 * callers only recolor layers (propIndex >= 2). The propIndex convention matches
 * the tip trackers: base blue=0, red=1; layer li blue=2+2*li, red=3+2*li.
 */

// Hue arcs in degrees. t=0 sits at the family anchor, t=1 at its far color.
const BLUE_ANCHOR_HUE = 250; // blue-violet
const BLUE_FAR_HUE = 110; // green  (250 → 200 cyan → 110 green)
const RED_ANCHOR_HUE = 360; // red (== 0)
const RED_FAR_HUE = 285; // magenta-violet (360 → 320 magenta → 285)

const SAT = 0.85;
const LIGHT = 0.57;

export interface TunnelColor {
  /** "#rrggbb" */
  hex: string;
  /** Components in 0..1 (for the fire colorField / WebGL uniforms). */
  rgb01: { r: number; g: number; b: number };
  /** Components in 0..255. */
  rgb255: { r: number; g: number; b: number };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** HSL (h in deg, s/l in 0..1) → rgb 0..1. */
function hslToRgb01(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: r + m, g: g + m, b: b + m };
}

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

/**
 * Color for one prop in the tunnel stack.
 *
 * @param propIndex  base blue=0, red=1; layer blue=2+2*li, red=3+2*li.
 * @param layerCount number of overlaid layers (`additionalLayers.length`); the
 *                   family spans `layerCount + 1` props (base + layers), so the
 *                   fan stretches to fill exactly the active stack.
 */
export function tunnelPropColor(propIndex: number, layerCount: number): TunnelColor {
  const isBlue = propIndex % 2 === 0;
  const familyIndex = Math.floor(propIndex / 2); // 0 = base
  const familyCount = Math.max(1, layerCount + 1);
  const t = familyCount <= 1 ? 0 : Math.min(1, familyIndex / (familyCount - 1));

  const hue = isBlue
    ? lerp(BLUE_ANCHOR_HUE, BLUE_FAR_HUE, t)
    : lerp(RED_ANCHOR_HUE, RED_FAR_HUE, t);

  const rgb01 = hslToRgb01(hue, SAT, LIGHT);
  const rgb255 = { r: rgb01.r * 255, g: rgb01.g * 255, b: rgb01.b * 255 };
  const hex = `#${toHex2(rgb255.r)}${toHex2(rgb255.g)}${toHex2(rgb255.b)}`;
  return { hex, rgb01, rgb255 };
}
