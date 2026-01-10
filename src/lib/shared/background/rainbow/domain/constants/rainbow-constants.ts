import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

/**
 * Pride color palettes - each represents a different pride flag
 */
export const PRIDE_PALETTES = {
  /** Classic 6-stripe rainbow pride flag */
  classic: ["#E40303", "#FF8C00", "#FFED00", "#008026", "#24408E", "#732982"],

  /** Progress pride flag (inclusive of trans + BIPOC) */
  progress: [
    "#FFFFFF",
    "#F5A9B8",
    "#5BCEFA",
    "#613915",
    "#000000",
    "#E40303",
    "#FF8C00",
    "#FFED00",
    "#008026",
    "#24408E",
    "#732982",
  ],

  /** Transgender pride flag */
  trans: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"],

  /** Bisexual pride flag */
  bisexual: ["#D60270", "#9B4F96", "#0038A8"],

  /** Pansexual pride flag */
  pansexual: ["#FF218C", "#FFD800", "#21B1FF"],

  /** Non-binary pride flag */
  nonbinary: ["#FCF434", "#FFFFFF", "#9C59D1", "#2C2C2C"],

  /** Lesbian pride flag */
  lesbian: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"],

  /** Asexual pride flag */
  asexual: ["#000000", "#A3A3A3", "#FFFFFF", "#800080"],

  /** Gay/MLM pride flag */
  gay: ["#078D70", "#26CEAA", "#98E8C1", "#FFFFFF", "#7BADE2", "#5049CC", "#3D1A78"],
} as const;

export type PridePalette = keyof typeof PRIDE_PALETTES;

/**
 * Darken colors for daily background use
 * Pride colors are vivid - we reduce saturation and lightness
 */
export function darkenForBackground(hex: string, saturationMult = 0.7, lightnessMult = 0.5): string {
  // Convert hex to HSL, darken, convert back
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.s *= saturationMult;
  hsl.l *= lightnessMult;

  const darkRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(darkRgb.r, darkRgb.g, darkRgb.b);
}

/**
 * Get darkened palette for background use
 */
export function getDarkenedPalette(palette: PridePalette): string[] {
  return PRIDE_PALETTES[palette].map((color) => darkenForBackground(color));
}

// Color conversion utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: r * 255, g: g * 255, b: b * 255 };
}

/**
 * Quality-based configuration for Rainbow background
 */
export interface RainbowQualityConfig {
  bandCount: number;
  bokehCount: number;
  sparkleCount: number;
  heartCount: number;
  shimmerEnabled: boolean;
  shimmerPoints: number;
  waveAnimation: boolean;
}

export const RAINBOW_QUALITY_CONFIGS: Record<QualityLevel, RainbowQualityConfig> = {
  high: {
    bandCount: 8,
    bokehCount: 20,
    sparkleCount: 80,
    heartCount: 3,
    shimmerEnabled: true,
    shimmerPoints: 50,
    waveAnimation: true,
  },
  medium: {
    bandCount: 6,
    bokehCount: 12,
    sparkleCount: 50,
    heartCount: 0,
    shimmerEnabled: true,
    shimmerPoints: 30,
    waveAnimation: true,
  },
  low: {
    bandCount: 6,
    bokehCount: 6,
    sparkleCount: 25,
    heartCount: 0,
    shimmerEnabled: true,
    shimmerPoints: 15,
    waveAnimation: true,
  },
  minimal: {
    bandCount: 4,
    bokehCount: 3,
    sparkleCount: 10,
    heartCount: 0,
    shimmerEnabled: false,
    shimmerPoints: 0,
    waveAnimation: false,
  },
  "ultra-minimal": {
    bandCount: 3,
    bokehCount: 0,
    sparkleCount: 0,
    heartCount: 0,
    shimmerEnabled: false,
    shimmerPoints: 0,
    waveAnimation: false,
  },
};

/**
 * Animation speeds and parameters
 */
export const RAINBOW_ANIMATION = {
  /** Wave propagation speed (radians per frame at 60fps) - gentle flow */
  waveSpeed: 0.006,

  /** Base wave frequency */
  waveFrequency: 0.003,

  /** Wave amplitude as fraction of band height */
  waveAmplitude: 0.3,

  /** Shimmer wave speed */
  shimmerSpeed: 0.012,

  /** Bokeh drift speed */
  bokehDriftSpeed: 0.0003,

  /** Sparkle twinkle speed range */
  sparkleSpeedMin: 0.01,
  sparkleSpeedMax: 0.03,

  /** Heart float speed */
  heartFloatSpeed: 0.0005,
  heartSwayAmplitude: 0.02,
  heartSwaySpeed: 0.01,

  /** Reduced motion multiplier */
  reducedMotionMultiplier: 0.1,
};

/**
 * Background gradient stops (dark foundation)
 */
export const RAINBOW_BASE_GRADIENT = [
  { position: 0, color: "#0a0a15" },
  { position: 0.5, color: "#12121f" },
  { position: 1, color: "#0d0d18" },
];
