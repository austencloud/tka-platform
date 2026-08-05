/**
 * Bubble palette registry.
 *
 * Backend-agnostic - both 2D (Bubbles2DRenderer) and 3D (BubbleEmitter3D)
 * resolve a BubblesIntent's palette field through `resolveBubblePalette()`
 * and then sample rim / highlight / fill / popBurst as needed.
 *
 * Oil palette carries the `iridescent` flag - renderers sample a 3-stop
 * hue-over-lifetime gradient instead of the static rim color when set.
 */

import type { BubblesIntent } from "./effects-config";

export interface BubblePalette {
  readonly id: BubblesIntent["palette"];
  /** Hex - outline color. */
  readonly rim: string;
  /** Hex - specular highlight dot. */
  readonly highlight: string;
  /** rgba string - transparent interior tint. */
  readonly fill: string;
  /** Hex - pop-burst fragment color. */
  readonly popBurst: string;
  /** Oil palette flag - rim animates over lifetime instead of staying static. */
  readonly iridescent?: boolean;
}

const SOAP: BubblePalette = {
  id: "soap",
  rim: "#c8e0ff",
  highlight: "#ffffff",
  fill: "rgba(200,224,255,0.22)",
  popBurst: "#e8f4ff",
};

const CHAMPAGNE: BubblePalette = {
  id: "champagne",
  rim: "#f4e8c8",
  highlight: "#ffffff",
  fill: "rgba(244,232,200,0.26)",
  popBurst: "#fff8e0",
};

// Oil's rim is sampled per-frame via oilIridescentRim() - the value stored
// here is an initial-spawn approximation. Renderers that honor iridescence
// should branch on the flag and call the sampler.
const OIL: BubblePalette = {
  id: "oil",
  rim: "#ff80d0",
  highlight: "#ffffff",
  fill: "rgba(200,160,240,0.24)",
  popBurst: "#c080ff",
  iridescent: true,
};

const ACID: BubblePalette = {
  id: "acid",
  rim: "#b8ff6f",
  highlight: "#e8ffc0",
  fill: "rgba(184,255,111,0.2)",
  popBurst: "#98e860",
};

const SPIRIT: BubblePalette = {
  id: "spirit",
  rim: "#c0fff4",
  highlight: "#ffffff",
  fill: "rgba(192,255,244,0.18)",
  popBurst: "#a0f8e0",
};

export const BUBBLE_PALETTES = {
  soap: SOAP,
  champagne: CHAMPAGNE,
  oil: OIL,
  acid: ACID,
  spirit: SPIRIT,
} as const;

/**
 * Resolve the active palette for an intent. For `palette === "custom"`,
 * derive the four slots from `customColor` via HSL shift.
 */
export function resolveBubblePalette(intent: BubblesIntent): BubblePalette {
  if (intent.palette !== "custom") {
    return BUBBLE_PALETTES[intent.palette];
  }
  return deriveCustomPalette(intent.customColor);
}

/**
 * Custom-palette derivation from a single base color:
 *   rim       = base
 *   highlight = +40% L, -30% S
 *   fill      = base at 15% alpha
 *   popBurst  = +20% L
 */
export function deriveCustomPalette(hex: string): BubblePalette {
  const base = hexToHsl(hex);
  const rim = hslToHex(base);
  const highlight = hslToHex({
    h: base.h,
    s: clamp01(base.s - 0.3),
    l: clamp01(base.l + 0.4),
  });
  const popBurst = hslToHex({ h: base.h, s: base.s, l: clamp01(base.l + 0.2) });
  const baseRgb = hexToRgb(hex);
  const fill = `rgba(${baseRgb.r},${baseRgb.g},${baseRgb.b},0.15)`;
  return { id: "custom", rim, highlight, fill, popBurst };
}

/**
 * Iridescent rim sampler for the oil palette. Returns the hue-shifted rim
 * color for a bubble at normalized age t ∈ [0,1]:
 *   t=0.0 → magenta (#ff80d0)
 *   t=0.5 → cyan    (#80d0ff)
 *   t=1.0 → green-gold (#d0ff80)
 *
 * Renderer branches on palette.iridescent === true. Each bubble only pays
 * one extra per-frame lerp + hex conversion - cheap.
 */
export function oilIridescentRim(t: number): string {
  const u = clamp01(t);
  const stops: Array<{ t: number; h: number; s: number; l: number }> = [
    { t: 0.0, h: hueTurns(320), s: 1.0, l: 0.75 },   // magenta
    { t: 0.5, h: hueTurns(210), s: 1.0, l: 0.75 },   // cyan
    { t: 1.0, h: hueTurns(80), s: 1.0, l: 0.75 },    // green-gold
  ];
  let a = stops[0]!;
  let b = stops[stops.length - 1]!;
  for (let i = 0; i < stops.length - 1; i++) {
    if (u >= stops[i]!.t && u <= stops[i + 1]!.t) {
      a = stops[i]!;
      b = stops[i + 1]!;
      break;
    }
  }
  const span = b.t - a.t;
  const k = span > 0 ? (u - a.t) / span : 0;
  // Shortest-path hue interp (hue is cyclic).
  const dh = shortestHueDelta(a.h, b.h);
  const h = wrap01(a.h + dh * k);
  const s = a.s + (b.s - a.s) * k;
  const l = a.l + (b.l - a.l) * k;
  return hslToHex({ h, s, l });
}

/* --- HSL helpers --- */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function wrap01(n: number): number {
  let v = n % 1;
  if (v < 0) v += 1;
  return v;
}

function hueTurns(degrees: number): number {
  return wrap01(degrees / 360);
}

function shortestHueDelta(a: number, b: number): number {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

function normalizeHex(hex: string): string {
  const s = hex.trim().replace(/^#/, "");
  if (s.length === 3) {
    return s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return s.length >= 6 ? s.slice(0, 6) : "c8e0ff";
}

function hexToRgb(hex: string): Rgb {
  const s = normalizeHex(hex);
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function hexToHsl(hex: string): Hsl {
  const { r: ri, g: gi, b: bi } = hexToRgb(hex);
  const r = ri / 255;
  const g = gi / 255;
  const b = bi / 255;
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
