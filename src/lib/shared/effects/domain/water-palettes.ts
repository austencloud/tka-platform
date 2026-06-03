/**
 * Water palette registry.
 *
 * Backend-agnostic - both 2D (Water2DRenderer) and 3D (WaterRenderer3D)
 * resolve a WaterIntent's palette field through `resolveWaterPalette()`
 * and then sample core/edge/highlight/splashTint/puddleTint as needed.
 */

import type { WaterIntent } from "./effects-config";

export interface WaterPalette {
  readonly id: WaterIntent["palette"];
  /** Hex - dense droplet core. */
  readonly core: string;
  /** Hex - droplet rim. */
  readonly edge: string;
  /** Hex - specular / wet sheen. */
  readonly highlight: string;
  /** Hex - splash burst tint (1f.iv). */
  readonly splashTint: string;
  /** Hex - ground-puddle tint (1f.iv). */
  readonly puddleTint: string;
  /** True suppresses ground puddles (spirit palette). */
  readonly suppressPuddles?: boolean;
}

const CLASSIC: WaterPalette = {
  id: "classic",
  core: "#3a7fd9",
  edge: "#6fb3ff",
  highlight: "#e8f4ff",
  splashTint: "#b8dcff",
  puddleTint: "#2a5a9a",
};

const MERCURY: WaterPalette = {
  id: "mercury",
  core: "#9a9fa8",
  edge: "#d4d8df",
  highlight: "#ffffff",
  splashTint: "#c0c4cb",
  puddleTint: "#6a6e75",
};

const ACID: WaterPalette = {
  id: "acid",
  core: "#7fd94a",
  edge: "#b8ff6f",
  highlight: "#e8ffc0",
  splashTint: "#98e860",
  puddleTint: "#4a8a2a",
};

const BLOOD: WaterPalette = {
  id: "blood",
  core: "#8a1818",
  edge: "#d93838",
  highlight: "#ff8080",
  splashTint: "#b82828",
  puddleTint: "#4a0808",
};

const SPIRIT: WaterPalette = {
  id: "spirit",
  core: "#80ffe8",
  edge: "#c0fff4",
  highlight: "#ffffff",
  splashTint: "#a0f8e0",
  puddleTint: "#40c8a8",
  suppressPuddles: true,
};

export const WATER_PALETTES = {
  classic: CLASSIC,
  mercury: MERCURY,
  acid: ACID,
  blood: BLOOD,
  spirit: SPIRIT,
} as const;

/**
 * Resolve the active palette for an intent. For `palette === "custom"`,
 * derive the five slots from `customColor` via HSL shift.
 */
export function resolveWaterPalette(intent: WaterIntent): WaterPalette {
  if (intent.palette !== "custom") {
    return WATER_PALETTES[intent.palette];
  }
  return deriveCustomPalette(intent.customColor);
}

/**
 * Custom-palette derivation rule from the spec:
 *   core       = base
 *   edge       = +15% L
 *   highlight  = +35% L, -50% S
 *   splashTint = -5% L
 *   puddleTint = -35% L
 */
export function deriveCustomPalette(hex: string): WaterPalette {
  const base = hexToHsl(hex);
  const core = hslToHex(base);
  const edge = hslToHex({ h: base.h, s: base.s, l: clamp01(base.l + 0.15) });
  const highlight = hslToHex({
    h: base.h,
    s: clamp01(base.s - 0.5),
    l: clamp01(base.l + 0.35),
  });
  const splashTint = hslToHex({ h: base.h, s: base.s, l: clamp01(base.l - 0.05) });
  const puddleTint = hslToHex({ h: base.h, s: base.s, l: clamp01(base.l - 0.35) });
  return { id: "custom", core, edge, highlight, splashTint, puddleTint };
}

/* --- HSL helpers --- */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeHex(hex: string): string {
  const s = hex.trim().replace(/^#/, "");
  if (s.length === 3) {
    return s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return s.length >= 6 ? s.slice(0, 6) : "3a7fd9";
}

function hexToHsl(hex: string): Hsl {
  const s = normalizeHex(hex);
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s: sat, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (n: number): string =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
