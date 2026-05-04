/**
 * Topology Prop Loader - Loads prop render data for topology visualization
 */

import type { GridLocation, GridMode } from "$lib/shared/render/core/types";
import type { TopologyPropRenderData } from "./contracts/types";
import { DefaultPropPositioner } from "$lib/shared/pictograph/prop/services/implementations/DefaultPropPositioner";
import { PropRotAngleManager } from "$lib/shared/pictograph/prop/services/implementations/PropRotAngleManager";
import { GridLocation as GridLocationEnum, GridMode as GridModeEnum } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  applyMotionColorToSvg,
  SELECTIVE_COLOR_PROP_TYPES,
  type ThemeMode,
} from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// ============================================================================
// CACHES
// ============================================================================

const rawSvgCache = new Map<string, string>();
const loadingPromises = new Map<string, Promise<string>>();
const coloredSvgCache = new Map<string, {
  svgContent: string;
  viewBox: { width: number; height: number };
  center: { x: number; y: number };
}>();

// ============================================================================
// STRING → ENUM CONVERTERS
// ============================================================================

const GRID_LOCATION_MAP: Record<string, GridLocationEnum> = {
  n: GridLocationEnum.NORTH,
  e: GridLocationEnum.EAST,
  s: GridLocationEnum.SOUTH,
  w: GridLocationEnum.WEST,
  ne: GridLocationEnum.NORTHEAST,
  se: GridLocationEnum.SOUTHEAST,
  sw: GridLocationEnum.SOUTHWEST,
  nw: GridLocationEnum.NORTHWEST,
  c: GridLocationEnum.CENTER,
};

const GRID_MODE_MAP: Record<string, GridModeEnum> = {
  diamond: GridModeEnum.DIAMOND,
  box: GridModeEnum.BOX,
  skewed: GridModeEnum.SKEWED,
};

// ============================================================================
// HELPERS
// ============================================================================

function parseSvgMetadata(svgText: string): {
  viewBox: { width: number; height: number };
  center: { x: number; y: number };
} {
  const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
  if (viewBoxMatch?.[1]) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    const w = parts[2];
    const h = parts[3];
    if (parts.length === 4 && w !== undefined && h !== undefined) {
      return {
        viewBox: { width: w, height: h },
        center: { x: w / 2, y: h / 2 },
      };
    }
  }
  return {
    viewBox: { width: 90, height: 300 },
    center: { x: 45, y: 150 },
  };
}

function extractSvgContent(svgText: string): string {
  const openTag = svgText.indexOf(">");
  const closeTag = svgText.lastIndexOf("</svg>");
  if (openTag >= 0 && closeTag > openTag) {
    return svgText.substring(openTag + 1, closeTag);
  }
  return svgText;
}

async function fetchSvg(path: string): Promise<string | null> {
  const cached = rawSvgCache.get(path);
  if (cached) return cached;

  let promise = loadingPromises.get(path);
  if (!promise) {
    promise = fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .finally(() => loadingPromises.delete(path));
    loadingPromises.set(path, promise);
  }

  try {
    const text = await promise;
    rawSvgCache.set(path, text);
    return text;
  } catch {
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function loadTopologyProp(
  location: GridLocation,
  gridMode: GridMode,
  color: "blue" | "red",
  propType: string,
  darkMode: boolean,
): Promise<TopologyPropRenderData | null> {
  try {
    const locationEnum = GRID_LOCATION_MAP[location];
    const modeEnum = GRID_MODE_MAP[gridMode];
    if (!locationEnum || !modeEnum) return null;

    const position = DefaultPropPositioner.calculatePosition(
      locationEnum,
      modeEnum,
      true,
    );

    const rotation = PropRotAngleManager.calculateRotation(
      locationEnum,
      Orientation.IN,
      modeEnum,
    );

    const themeMode: ThemeMode = darkMode ? "dark" : "light";
    const motionColor = color === "blue" ? MotionColor.BLUE : MotionColor.RED;
    const svgPath = `/images/props/pictograph/${propType}.svg`;
    const cacheKey = `${svgPath}:${color}:${themeMode}`;

    let cached = coloredSvgCache.get(cacheKey);
    if (!cached) {
      const rawSvg = await fetchSvg(svgPath);
      if (!rawSvg) return null;

      const isSelective = (SELECTIVE_COLOR_PROP_TYPES as readonly string[]).includes(
        propType.toLowerCase()
      );
      const coloredSvg = applyMotionColorToSvg(rawSvg, motionColor, {
        themeMode,
        removeCenterPoint: true,
        makeClassNamesUnique: true,
        selectiveColorMode: isSelective,
      });

      const metadata = parseSvgMetadata(rawSvg);
      const svgContent = extractSvgContent(coloredSvg);

      cached = { svgContent, ...metadata };
      coloredSvgCache.set(cacheKey, cached);
    }

    return {
      svgContent: cached.svgContent,
      viewBox: cached.viewBox,
      center: cached.center,
      position,
      rotation,
    };
  } catch (error) {
    console.error("loadTopologyProp: Failed to load prop", error);
    return null;
  }
}
