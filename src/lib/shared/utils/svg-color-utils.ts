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
 * Check if a color should be preserved (not transformed)
 */
export function shouldPreserveColor(color: string): boolean {
  const colorLower = color.toLowerCase();
  return (
    colorLower === "none" ||
    colorLower === "transparent" ||
    ACCENT_COLORS_TO_PRESERVE.some(
      (accent) => accent.toLowerCase() === colorLower
    )
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
  } = {}
): string {
  const {
    transformStroke = false,
    removeCenterPoint = true,
    makeClassNamesUnique = false,
    colorSuffix = "",
  } = options;

  let coloredSvg = svgText;

  // Replace fill attribute colors
  coloredSvg = coloredSvg.replace(
    /fill="(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)"/gi,
    (match, capturedColor) => {
      if (shouldPreserveColor(capturedColor)) {
        return match;
      }
      return `fill="${targetColor}"`;
    }
  );

  // Replace fill in style attributes (CSS)
  coloredSvg = coloredSvg.replace(
    /fill:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
    (match, capturedColor) => {
      if (shouldPreserveColor(capturedColor)) {
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
        if (shouldPreserveColor(capturedColor)) {
          return match;
        }
        return `stroke="${targetColor}"`;
      }
    );

    coloredSvg = coloredSvg.replace(
      /stroke:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
      (match, capturedColor) => {
        if (shouldPreserveColor(capturedColor)) {
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

  // Make CSS class names unique to prevent conflicts between different colored props
  if (makeClassNamesUnique && colorSuffix) {
    coloredSvg = coloredSvg.replace(/\.st(\d+)/g, `.st$1-${colorSuffix}`);
    coloredSvg = coloredSvg.replace(
      /class="st(\d+)"/g,
      `class="st$1-${colorSuffix}"`
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
