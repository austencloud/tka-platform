/**
 * Pure SVG color transforms shared by browser and Node renderers.
 *
 * Props are embedded more than once in a pictograph. Class and ID suffixing is
 * therefore part of correctness, not just cleanup: two unscoped `.st0` rules
 * let the later prop's color override the earlier prop.
 */

export type MotionColor = "blue" | "red";
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
  blue: {
    dark: "#3575E2",
    light: "#3D44B8",
  },
  red: {
    dark: "#ED1C24",
    light: "#DC2626",
  },
};

/**
 * Props whose artwork is only PARTLY the motion color. Selective mode keeps any
 * fill that is dark (luminance below 0.4) or saturated (above 0.05) and repaints
 * the rest — so a torch keeps its shaft, a sword keeps its gold blade, and the
 * energy pair keeps its neutral hilt and pale core while the blade takes on
 * blue or red.
 */
export const SELECTIVE_COLOR_PROP_TYPES = [
  "torch",
  "bigtorch",
  "sword",
  "energy_saber",
  "energy_staff",
  // LED baton: the frosted caps are neutral gray and take blue or red, while the
  // braided shaft, collars and clear tubes stay hardware-colored on both hands.
  "capsule_baton",
  "sword-knight",
  "sword-saber",
  "sword-flamberge",
  "sword-khopesh",
  "sword-claymore",
] as const;

export function getMotionColor(
  color: MotionColor,
  mode: ThemeMode = "dark",
): string {
  return MOTION_COLOR_MAP[color]?.[mode] ?? MOTION_COLOR_MAP.blue[mode];
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  if (max === 0) return 0;
  const min = Math.min(r, g, b);
  return (max - min) / max;
}

export function shouldPreserveColor(
  color: string,
  selectiveMode?: boolean,
): boolean {
  const colorLower = color.toLowerCase();

  if (colorLower === "none" || colorLower === "transparent") return true;

  if (selectiveMode && colorLower.startsWith("#")) {
    const rgb = parseHex(colorLower);
    if (!rgb) return false;
    if (luminance(rgb.r, rgb.g, rgb.b) < 0.4) return true;
    if (saturation(rgb.r, rgb.g, rgb.b) > 0.05) return true;
    return false;
  }

  return ACCENT_COLORS_TO_PRESERVE.some(
    (accent) => accent.toLowerCase() === colorLower,
  );
}

export interface SvgColorOptions {
  transformStroke?: boolean;
  removeCenterPoint?: boolean;
  makeClassNamesUnique?: boolean;
  colorSuffix?: string;
  selectiveColorMode?: boolean;
}

export function applyColorToSvg(
  svgText: string,
  targetColor: string,
  options: SvgColorOptions = {},
): string {
  const {
    transformStroke = false,
    removeCenterPoint = true,
    makeClassNamesUnique = false,
    colorSuffix = "",
    selectiveColorMode = false,
  } = options;

  let coloredSvg = svgText;

  coloredSvg = coloredSvg.replace(
    /fill="(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)"/gi,
    (match, capturedColor: string) => {
      if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
        return match;
      }
      return `fill="${targetColor}"`;
    },
  );

  coloredSvg = coloredSvg.replace(
    /fill:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
    (match, capturedColor: string) => {
      if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
        return match;
      }
      return `fill:${targetColor}`;
    },
  );

  if (transformStroke) {
    coloredSvg = coloredSvg.replace(
      /stroke="(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)"/gi,
      (match, capturedColor: string) => {
        if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
          return match;
        }
        return `stroke="${targetColor}"`;
      },
    );

    coloredSvg = coloredSvg.replace(
      /stroke:\s*(#[0-9A-Fa-f]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi,
      (match, capturedColor: string) => {
        if (shouldPreserveColor(capturedColor, selectiveColorMode)) {
          return match;
        }
        return `stroke:${targetColor}`;
      },
    );
  }

  if (removeCenterPoint) {
    coloredSvg = coloredSvg.replace(
      /<circle[^>]*id="centerPoint"[^>]*\/?>/g,
      "",
    );
  }

  if (makeClassNamesUnique && colorSuffix) {
    coloredSvg = coloredSvg.replace(/\.st(\d+)/g, `.st$1-${colorSuffix}`);
    coloredSvg = coloredSvg.replace(
      /class="st(\d+)"/g,
      `class="st$1-${colorSuffix}"`,
    );
    coloredSvg = coloredSvg.replace(
      /id="([^"]+)"/g,
      `id="$1-${colorSuffix}"`,
    );
    coloredSvg = coloredSvg.replace(
      /url\(#([^)]+)\)/g,
      `url(#$1-${colorSuffix})`,
    );
  }

  return coloredSvg;
}

export interface MotionSvgColorOptions
  extends Omit<SvgColorOptions, "colorSuffix"> {
  themeMode?: ThemeMode;
}

export function applyMotionColorToSvg(
  svgText: string,
  motionColor: MotionColor,
  options: MotionSvgColorOptions = {},
): string {
  const mode = options.themeMode ?? "dark";
  const targetColor = getMotionColor(motionColor, mode);

  return applyColorToSvg(svgText, targetColor, {
    ...options,
    colorSuffix: motionColor,
  });
}
