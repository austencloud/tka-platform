/**
 * SVG Color Utilities
 *
 * Centralized color transformation for SVGs.
 * Single source of truth for motion colors and accent preservation.
 */

import { MotionColor } from "@tka/types";

export type ThemeMode = "dark" | "light";

export const ACCENT_COLORS_TO_PRESERVE = [
  "#c9ac68",
  "#ffffff",
  "#fff",
] as const;

export const MOTION_COLOR_MAP: Record<
  MotionColor,
  { dark: string; light: string }
> = {
  [MotionColor.BLUE]: {
    dark: "#3575E2",
    light: "#3D44B8",
  },
  [MotionColor.RED]: {
    dark: "#ED1C24",
    light: "#DC2626",
  },
};

export function getMotionColor(
  color: MotionColor,
  mode: ThemeMode = "dark"
): string {
  return (
    MOTION_COLOR_MAP[color]?.[mode] ?? MOTION_COLOR_MAP[MotionColor.BLUE][mode]
  );
}

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

  coloredSvg = coloredSvg.replace(
    /fill="(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)"/gi,
    (match, capturedColor) => {
      if (shouldPreserveColor(capturedColor)) return match;
      return `fill="${targetColor}"`;
    }
  );

  coloredSvg = coloredSvg.replace(
    /fill:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
    (match, capturedColor) => {
      if (shouldPreserveColor(capturedColor)) return match;
      return `fill:${targetColor}`;
    }
  );

  if (transformStroke) {
    coloredSvg = coloredSvg.replace(
      /stroke="(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)"/gi,
      (match, capturedColor) => {
        if (shouldPreserveColor(capturedColor)) return match;
        return `stroke="${targetColor}"`;
      }
    );

    coloredSvg = coloredSvg.replace(
      /stroke:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
      (match, capturedColor) => {
        if (shouldPreserveColor(capturedColor)) return match;
        return `stroke:${targetColor}`;
      }
    );
  }

  if (removeCenterPoint) {
    coloredSvg = coloredSvg.replace(
      /<circle[^>]*id="centerPoint"[^>]*\/?>/g,
      ""
    );
  }

  if (makeClassNamesUnique && colorSuffix) {
    coloredSvg = coloredSvg.replace(/\.st(\d+)/g, `.st$1-${colorSuffix}`);
    coloredSvg = coloredSvg.replace(
      /class="st(\d+)"/g,
      `class="st$1-${colorSuffix}"`
    );
  }

  return coloredSvg;
}

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
