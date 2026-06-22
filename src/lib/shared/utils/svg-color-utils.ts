/**
 * SVG Color Utilities
 *
 * Centralized color transformation for SVGs across the entire application.
 * This single source of truth prevents inconsistencies when preserving
 * accent colors during color transformations.
 */

import { MotionColor } from "../pictograph/shared/domain/enums/pictograph-enums";

/**
 * Theme mode for color selection
 */
export type ThemeMode = "dark" | "light";

/**
 * Colors that should NEVER be transformed when applying prop/motion colors.
 * Add new accent colors here and they'll be preserved everywhere.
 */
export const ACCENT_COLORS_TO_PRESERVE = [
  "#c9ac68", // Gold/tan color used for minihoop grip
  "#ffffff", // White - used for background shapes/accents
  "#fff", // White shorthand
] as const;

/**
 * Mode-aware color map for motion colors.
 * Each color has variants optimized for CONTRAST against the background:
 * - Dark mode (dark background) → BRIGHT colors for visibility
 * - Light mode (light background) → DARKER colors for visibility
 *
 * Must match CSS variables in app.css (:root and :root.dark --dm-motion-*)
 */
export const MOTION_COLOR_MAP: Record<
  MotionColor,
  { dark: string; light: string }
> = {
  [MotionColor.BLUE]: {
    dark: "#3575E2", // Bright blue - visible on dark backgrounds
    light: "#3D44B8", // Darker purplish blue - visible on light backgrounds
  },
  [MotionColor.RED]: {
    dark: "#ED1C24", // Bright red - visible on dark backgrounds
    light: "#DC2626", // Darker red - visible on light backgrounds
  },
};

/**
 * Get the appropriate color for a motion color based on theme mode.
 * This is the primary way to access motion colors throughout the app.
 *
 * @param color - The MotionColor enum value
 * @param mode - The current theme mode ("dark" or "light"), defaults to "dark"
 * @returns The hex color string
 */
export function getMotionColor(
  color: MotionColor,
  mode: ThemeMode = "dark"
): string {
  return (
    MOTION_COLOR_MAP[color]?.[mode] ?? MOTION_COLOR_MAP[MotionColor.BLUE][mode]
  );
}

/**
 * Prop types that use selective coloring: only neutral (white/gray) fills get colored,
 * dark fills and warm/saturated fills (yellows, golds) are preserved.
 * Used for torches where the shaft stays dark, wick stays yellow, and knob gets hand color.
 * Sword behaves the same: the yellow blade (wick) stays, the neutral-gray hilt and grip take the hand color.
 */
export const SELECTIVE_COLOR_PROP_TYPES = [
  "torch",
  "bigtorch",
  "sword",
  // Sword-style previews (comparison only, not yet shipped prop types). Keeps the
  // gold wick + dark/white shading; only the neutral-gray hardware takes hand color.
  "sword-knight",
  "sword-saber",
  "sword-flamberge",
  "sword-khopesh",
  "sword-claymore",
] as const;

/**
 * Parse a 6-digit hex color to 0-1 RGB channels.
 * Returns null for non-hex or short-hex colors.
 */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

/**
 * Compute relative luminance (0 = black, 1 = white).
 */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute HSV saturation (0 = gray/white, 1 = fully saturated).
 */
function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  if (max === 0) return 0;
  const min = Math.min(r, g, b);
  return (max - min) / max;
}

/**
 * Check if a color should be preserved (not transformed).
 *
 * In selectiveMode, only neutral unsaturated light colors get replaced:
 * - Dark colors (luminance < 0.4) → preserved (shaft/body)
 * - Warm/saturated colors (saturation > 0.05) → preserved (wick, gold accents)
 * - White is NOT preserved (overrides global list) → gets hand color
 */
export function shouldPreserveColor(color: string, selectiveMode?: boolean): boolean {
  const colorLower = color.toLowerCase();

  // Always skip none/transparent
  if (colorLower === "none" || colorLower === "transparent") return true;

  if (selectiveMode && colorLower.startsWith("#")) {
    const rgb = parseHex(colorLower);
    if (!rgb) return false;

    // Dark colors: preserve (shaft body)
    if (luminance(rgb.r, rgb.g, rgb.b) < 0.4) return true;

    // Warm/saturated colors: preserve (wick, gold, cream)
    if (saturation(rgb.r, rgb.g, rgb.b) > 0.05) return true;

    // Neutral light colors (whites, light grays): replace with hand color
    return false;
  }

  // Standard mode: check global accent list
  return ACCENT_COLORS_TO_PRESERVE.some(
    (accent) => accent.toLowerCase() === colorLower
  );
}

/**
 * Apply color transformation to an SVG string.
 * Preserves accent colors, transparent fills, and "none" values.
 *
 * @param svgText - The raw SVG string
 * @param targetColor - The color to apply (hex string like "#2E3192")
 * @param options - Optional configuration
 * @returns The transformed SVG string
 */
export function applyColorToSvg(
  svgText: string,
  targetColor: string,
  options: {
    transformStroke?: boolean;
    removeCenterPoint?: boolean;
    makeClassNamesUnique?: boolean;
    colorSuffix?: string;
    /** Enable selective coloring: only neutral (white/gray) fills get replaced. Dark and warm fills preserved. */
    selectiveColorMode?: boolean;
  } = {}
): string {
  const {
    transformStroke = false,
    removeCenterPoint = true,
    makeClassNamesUnique = false,
    colorSuffix = "",
    selectiveColorMode = false,
  } = options;

  let coloredSvg = svgText;

  // Replace fill attribute colors
  coloredSvg = coloredSvg.replace(
    /fill="(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)"/gi,
    (match, capturedColor) => {
      if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
        return match;
      }
      return `fill="${targetColor}"`;
    }
  );

  // Replace fill in style attributes (CSS)
  coloredSvg = coloredSvg.replace(
    /fill:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
    (match, capturedColor) => {
      if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
        return match;
      }
      return `fill:${targetColor}`;
    }
  );

  // Optionally transform stroke colors
  if (transformStroke) {
    coloredSvg = coloredSvg.replace(
      /stroke="(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)"/gi,
      (match, capturedColor) => {
        if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
          return match;
        }
        return `stroke="${targetColor}"`;
      }
    );

    coloredSvg = coloredSvg.replace(
      /stroke:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
      (match, capturedColor) => {
        if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
          return match;
        }
        return `stroke:${targetColor}`;
      }
    );
  }

  // Remove centerPoint circle (used for positioning, not display)
  if (removeCenterPoint) {
    coloredSvg = coloredSvg.replace(
      /<circle[^>]*id="centerPoint"[^>]*\/?>/g,
      ""
    );
  }

  // Make CSS class names and element IDs unique to prevent conflicts
  // between different colored props injected into the same DOM
  if (makeClassNamesUnique && colorSuffix) {
    coloredSvg = coloredSvg.replace(/\.st(\d+)/g, `.st$1-${colorSuffix}`);
    coloredSvg = coloredSvg.replace(
      /class="st(\d+)"/g,
      `class="st$1-${colorSuffix}"`
    );

    // Uniquify gradient/filter IDs and their url() references
    // Prevents DOM ID collisions (e.g. two props both defining id="cb-shade")
    coloredSvg = coloredSvg.replace(
      /id="([^"]+)"/g,
      `id="$1-${colorSuffix}"`
    );
    coloredSvg = coloredSvg.replace(
      /url\(#([^)]+)\)/g,
      `url(#$1-${colorSuffix})`
    );
  }

  return coloredSvg;
}

/**
 * Apply motion color to an SVG string.
 * Convenience wrapper that uses the standard motion color map.
 *
 * @param svgText - The raw SVG string
 * @param motionColor - The MotionColor enum value
 * @param options - Optional configuration (includes themeMode for dark/light variants)
 * @returns The transformed SVG string
 */
export function applyMotionColorToSvg(
  svgText: string,
  motionColor: MotionColor,
  options: {
    transformStroke?: boolean;
    removeCenterPoint?: boolean;
    makeClassNamesUnique?: boolean;
    themeMode?: ThemeMode;
    selectiveColorMode?: boolean;
  } = {}
): string {
  const mode = options.themeMode ?? "dark";
  const targetColor = getMotionColor(motionColor, mode);
  const colorSuffix = motionColor.toLowerCase();

  return applyColorToSvg(svgText, targetColor, {
    ...options,
    colorSuffix,
    makeClassNamesUnique: options.makeClassNamesUnique,
  });
}
