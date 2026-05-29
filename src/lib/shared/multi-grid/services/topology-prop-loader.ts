/**
 * TopologyPropLoader - Loads prop render data for topology visualization
 *
 * Computes strict position + rotation and loads colored SVG content
 * for rendering props in the Multi-Grid Lab. Uses the same coordinate
 * system and rotation logic as the main pictograph pipeline, but
 * bypasses the heavyweight MotionData/placement pipeline.
 *
 * Strict coordinates (150px from center) are used to match the
 * topology's strict grid mode, matching ConjoinedCanvas behavior.
 */

import type { GridLocation, GridMode } from "$lib/shared/render/core/types";
import type { TopologyPropRenderData } from "./types";
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

/** Raw SVG text cache: path → SVG string */
const rawSvgCache = new Map<string, string>();

/** In-flight fetch deduplication */
const loadingPromises = new Map<string, Promise<string>>();

/** Colored SVG cache: "path:color:theme" → colored SVG string + metadata */
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
// IMPLEMENTATION
// ============================================================================

export class TopologyPropLoader {
  async loadProp(
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

      // 1. Compute strict position (150px from center, matching conjoined mode)
      const position = DefaultPropPositioner.calculatePosition(
        locationEnum,
        modeEnum,
        true, // useStrict
      );

      // 2. Compute rotation (default orientation: "in")
      const rotation = PropRotAngleManager.calculateRotation(
        locationEnum,
        Orientation.IN,
        modeEnum,
      );

      // 3. Load colored SVG
      const themeMode: ThemeMode = darkMode ? "dark" : "light";
      const motionColor = color === "blue" ? MotionColor.BLUE : MotionColor.RED;
      const svgPath = `/images/props/pictograph/${propType}.svg`;
      const cacheKey = `${svgPath}:${color}:${themeMode}`;

      let cached = coloredSvgCache.get(cacheKey);
      if (!cached) {
        const rawSvg = await this.fetchSvg(svgPath);
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

        const metadata = this.parseSvgMetadata(rawSvg);
        const svgContent = this.extractSvgContent(coloredSvg);

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
      console.error("TopologyPropLoader: Failed to load prop", error);
      return null;
    }
  }

  private async fetchSvg(path: string): Promise<string | null> {
    // Check cache
    const cached = rawSvgCache.get(path);
    if (cached) return cached;

    // Deduplicate in-flight requests
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

  private parseSvgMetadata(svgText: string): {
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
    // Fallback for staff-sized props
    return {
      viewBox: { width: 90, height: 300 },
      center: { x: 45, y: 150 },
    };
  }

  private extractSvgContent(svgText: string): string {
    // Remove outer <svg> wrapper, return inner content
    const openTag = svgText.indexOf(">");
    const closeTag = svgText.lastIndexOf("</svg>");
    if (openTag >= 0 && closeTag > openTag) {
      return svgText.substring(openTag + 1, closeTag);
    }
    return svgText;
  }
}
