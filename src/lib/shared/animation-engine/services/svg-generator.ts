import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PropSvgData } from "$lib/shared/animation-engine/domain/types/svg-types";

export type { PropSvgData } from "$lib/shared/animation-engine/domain/types/svg-types";
import {
  applyColorToSvg,
  SELECTIVE_COLOR_PROP_TYPES,
  getMotionColor,
  type ThemeMode,
} from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

/**
 * SVG Generator for creating prop staff images and grid
 * Based on the exact implementation from standalone_animator.html
 */

// Module-level cache for fetched SVG content to avoid repeated network requests
const svgCache = new Map<string, string>();

/**
 * Get the current theme mode based on animation visibility settings
 * Dark Mode (dark mode) = "dark" theme colors (brighter props for contrast)
 * Light Mode (light mode) = "light" theme colors (darker props for contrast)
 */
function getCurrentThemeMode(): ThemeMode {
  try {
    const manager = getAnimationVisibilityManager();
    return manager.isDarkMode() ? "dark" : "light";
  } catch {
    // Fallback to dark mode if manager not available
    return "dark";
  }
}

/**
 * Generate grid SVG with support for strict mode points
 * Loads the actual grid SVG files and adds strict-mode class for animation viewer
 * @param gridMode - Type of grid to generate (GridMode.DIAMOND or GridMode.BOX)
 * @param useStrictPoints - Whether to enable strict mode (for animation viewer)
 */
export async function generateGridSvg(
  gridMode: GridMode = GridMode.DIAMOND,
  useStrictPoints: boolean = true,
  showNonRadialPoints: boolean = true
): Promise<string> {
  // For animation viewer, always use strict mode
  // Load from actual grid SVG files to get the complete grid with all point layers
  let gridFileName: string;
  switch (gridMode) {
    case GridMode.BOX: gridFileName = "box_grid.svg"; break;
    case GridMode.DIAMOND: gridFileName = "diamond_grid.svg"; break;
    default: gridFileName = "8point_grid.svg"; break;
  }

  try {
    const cacheKey = `/images/grid/${gridFileName}`;
    let svgContent: string;

    // Check cache first
    if (svgCache.has(cacheKey)) {
      svgContent = svgCache.get(cacheKey)!;
    } else {
      const response = await fetch(cacheKey);

      if (!response.ok) {
        console.error(`Failed to load grid SVG: ${response.status}`);
        return getFallbackGridSvg(gridMode);
      }
      svgContent = await response.text();
      svgCache.set(cacheKey, svgContent);
    }

    // Add strict-mode class to the SVG root element if strict points are enabled
    if (useStrictPoints) {
      svgContent = svgContent.replace(
        /<svg([^>]*)>/,
        '<svg$1 class="strict-mode">'
      );
    }

    // Hide nonradial (layer2) points when requested
    if (!showNonRadialPoints) {
      svgContent = svgContent.replace(
        '</style>',
        '.strict-layer2-point{fill:none !important}.normal-layer2-point{fill:none !important}\n</style>'
      );
    }

    return svgContent;
  } catch (error) {
    console.error("Error loading grid SVG:", error);
    return getFallbackGridSvg(gridMode);
  }
}

/**
 * Fallback grid SVG for when file loading fails
 */
function getFallbackGridSvg(gridMode: GridMode): string {
  if (gridMode === GridMode.EIGHT_POINT) {
    return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 950 950" xml:space="preserve" class="strict-mode">
<style>
  .box-grid-stroke{stroke:#000;stroke-width:7;stroke-miterlimit:10}
  .normal-hand-point{fill:none}
  .strict-hand-point{fill:currentColor}
</style>
<circle id="center_point" cx="475" cy="475" r="12"/>
<circle id="n_diamond_hand_point_strict" class="strict-hand-point" cx="475" cy="325" r="4.7"/>
<circle id="e_diamond_hand_point_strict" class="strict-hand-point" cx="625" cy="475" r="4.7"/>
<circle id="s_diamond_hand_point_strict" class="strict-hand-point" cx="475" cy="625" r="4.7"/>
<circle id="w_diamond_hand_point_strict" class="strict-hand-point" cx="325" cy="475" r="4.7"/>
<circle id="strict_ne_box_hand_point" class="strict-hand-point" cx="581.1" cy="368.9" r="4.7"/>
<circle id="strict_se_box_hand_point" class="strict-hand-point" cx="581.1" cy="581.1" r="4.7"/>
<circle id="strict_sw_box_hand_point" class="strict-hand-point" cx="368.9" cy="581.1" r="4.7"/>
<circle id="strict_nw_box_hand_point" class="strict-hand-point" cx="368.9" cy="368.9" r="4.7"/>
</svg>`;
  } else if (gridMode === GridMode.BOX) {
    return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 950 950" xml:space="preserve" class="strict-mode">
<style>
  .box-outer-ring{fill:none;stroke:#000;stroke-width:13;stroke-miterlimit:10}
  .normal-hand-point{fill:none}
  .strict-hand-point{fill:currentColor}
</style>
<circle id="center_point" cx="475" cy="475" r="11.2"/>
<circle id="ne_box_outer_point" class="box-outer-ring" cx="262.9" cy="262.9" r="25"/>
<circle id="se_box_outer_point" class="box-outer-ring" cx="687.1" cy="262.9" r="25"/>
<circle id="sw_box_outer_point" class="box-outer-ring" cx="687.1" cy="687.1" r="25"/>
<circle id="nw_box_outer_point" class="box-outer-ring" cx="262.9" cy="687.1" r="25"/>
<circle id="strict_ne_box_hand_point" class="strict-hand-point" cx="581.1" cy="368.9" r="4.7"/>
<circle id="strict_se_box_hand_point" class="strict-hand-point" cx="581.1" cy="581.1" r="4.7"/>
<circle id="strict_sw_box_hand_point" class="strict-hand-point" cx="368.9" cy="581.1" r="4.7"/>
<circle id="strict_nw_box_hand_point" class="strict-hand-point" cx="368.9" cy="368.9" r="4.7"/>
</svg>`;
  } else {
    return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 950 950" xml:space="preserve" class="strict-mode">
<style>
  .normal-hand-point{fill:none}
  .strict-hand-point{fill:currentColor}
</style>
<circle id="n_diamond_hand_point_strict" class="strict-hand-point" cx="475" cy="325" r="4.7"/>
<circle id="e_diamond_hand_point_strict" class="strict-hand-point" cx="625" cy="475" r="4.7"/>
<circle id="s_diamond_hand_point_strict" class="strict-hand-point" cx="475" cy="625" r="4.7"/>
<circle id="w_diamond_hand_point_strict" class="strict-hand-point" cx="325" cy="475" r="4.7"/>
<circle id="center_point" cx="475" cy="475" r="12"/>
</svg>`;
  }
}

/**
 * Generate blue staff SVG exactly as in standalone_animator.html
 * @deprecated Use generateBluePropSvg instead
 */
export function generateBlueStaffSvg(): string {
  const themeMode = getCurrentThemeMode();
  const blueColor = getMotionColor(MotionColor.BLUE, themeMode);
  return `<svg version="1.1" id="staff" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 252.8 77.8" style="enable-background:new 0 0 252.8 77.8;" xml:space="preserve"><path fill="${blueColor}" stroke="#555555" stroke-width="1" stroke-miterlimit="10" d="M251.4,67.7V10.1c0-4.8-4.1-8.7-9.1-8.7s-9.1,3.9-9.1,8.7v19.2H10.3c-4.9,0-8.9,3.8-8.9,8.5V41 c0,4.6,4,8.5,8.9,8.5h222.9v18.2c0,4.8,4.1,8.7,9.1,8.7S251.4,72.5,251.4,67.7z"/><circle id="centerPoint" fill="#FF0000" cx="126.4" cy="38.9" r="5" /></svg>`;
}

/**
 * Generate red staff SVG exactly as in standalone_animator.html
 * @deprecated Use generateRedPropSvg instead
 */
export function generateRedStaffSvg(): string {
  const themeMode = getCurrentThemeMode();
  const redColor = getMotionColor(MotionColor.RED, themeMode);
  return `<svg version="1.1" id="staff" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 252.8 77.8" style="enable-background:new 0 0 252.8 77.8;" xml:space="preserve"><path fill="${redColor}" stroke="#555555" stroke-width="1" stroke-miterlimit="10" d="M251.4,67.7V10.1c0-4.8-4.1-8.7-9.1-8.7s-9.1,3.9-9.1,8.7v19.2H10.3c-4.9,0-8.9,3.8-8.9,8.5V41 c0,4.6,4,8.5,8.9,8.5h222.9v18.2c0,4.8,4.1,8.7,9.1,8.7S251.4,72.5,251.4,67.7z"/><circle id="centerPoint" fill="#FF0000" cx="126.4" cy="38.9" r="5" /></svg>`;
}

/**
 * Generate prop SVG with custom color
 */
export async function generatePropSvg(
  propType: string = "staff",
  color: string
): Promise<PropSvgData> {
  // Use the 300px scaled versions from animated directory for animation display
  const propTypeLower = propType.toLowerCase();
  const path = `/images/props/animated/${propTypeLower}.svg`;
  const originalSvg = await fetchPropSvg(path);
  const coloredSvg = applyColorToPropSvg(originalSvg, color, propTypeLower);
  const { width, height } = extractViewBoxDimensions(originalSvg);
  return { svg: coloredSvg, width, height };
}

/**
 * Generate blue prop SVG with dynamic prop type
 * Color adapts to theme: dark backgrounds get bright blue, light backgrounds get darker blue
 * @param propType - Type of prop to generate
 * @param darkMode - When provided, uses this instead of global dark mode state (for preview isolation)
 */
export async function generateBluePropSvg(
  propType: string = "staff",
  darkMode?: boolean
): Promise<PropSvgData> {
  // Use passed darkMode if provided, otherwise read from global state
  const themeMode =
    darkMode !== undefined
      ? darkMode
        ? "dark"
        : "light"
      : getCurrentThemeMode();
  return generatePropSvg(
    propType,
    getMotionColor(MotionColor.BLUE, themeMode)
  );
}

/**
 * Generate red prop SVG with dynamic prop type
 * Color adapts to theme: dark backgrounds get bright red, light backgrounds get darker red
 * @param propType - Type of prop to generate
 * @param darkMode - When provided, uses this instead of global dark mode state (for preview isolation)
 */
export async function generateRedPropSvg(
  propType: string = "staff",
  darkMode?: boolean
): Promise<PropSvgData> {
  // Use passed darkMode if provided, otherwise read from global state
  const themeMode =
    darkMode !== undefined
      ? darkMode
        ? "dark"
        : "light"
      : getCurrentThemeMode();
  return generatePropSvg(
    propType,
    getMotionColor(MotionColor.RED, themeMode)
  );
}

/**
 * Fetch prop SVG from server (with caching)
 */
async function fetchPropSvg(path: string): Promise<string> {
  // Level 1: In-memory cache (fastest, clears on reload)
  if (svgCache.has(path)) {
    return svgCache.get(path)!;
  }

  // Level 2: Try network fetch
  try {
    const response = await fetch(path);
    if (response.ok) {
      const svgText = await response.text();
      svgCache.set(path, svgText);
      // Background: persist to IndexedDB for offline use
      saveToIDB(path, svgText).catch(() => {});
      return svgText;
    }
  } catch {
    // Network failed - fall through to IndexedDB
  }

  // Level 3: IndexedDB offline cache (survives reload, works offline)
  const cached = await loadFromIDB(path);
  if (cached) {
    svgCache.set(path, cached);
    return cached;
  }

  throw new Error(`Failed to fetch prop SVG from ${path} (offline, no cache)`);
}

// ---- IndexedDB persistence for offline prop SVGs ----

let idbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("tka-animated-svg-cache", 1);
    request.onerror = () => {
      idbPromise = null; // allow retry on next call
      reject(request.error);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("svgs")) {
        db.createObjectStore("svgs", { keyPath: "path" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return idbPromise;
}

async function saveToIDB(path: string, svgText: string): Promise<void> {
  const db = await getIDB();
  const tx = db.transaction("svgs", "readwrite");
  tx.objectStore("svgs").put({ path, svgText, cachedAt: Date.now() });
}

async function loadFromIDB(path: string): Promise<string | null> {
  try {
    const db = await getIDB();
    const tx = db.transaction("svgs", "readonly");
    return new Promise((resolve) => {
      const request = tx.objectStore("svgs").get(path);
      request.onsuccess = () => resolve(request.result?.svgText ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Apply color to prop SVG while preserving transparent sections and accent colors.
 * Torch-family props preserve dark body fills (only knob/handle gets colored).
 */
function applyColorToPropSvg(svgText: string, color: string, propType?: string): string {
  const isSelective = propType
    ? (SELECTIVE_COLOR_PROP_TYPES as readonly string[]).includes(propType.toLowerCase())
    : false;

  return applyColorToSvg(svgText, color, {
    selectiveColorMode: isSelective,
  });
}

/**
 * Extract viewBox dimensions from SVG
 */
function extractViewBoxDimensions(svgText: string): {
  width: number;
  height: number;
} {
  // Try to extract from viewBox attribute
  const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/);
  if (viewBoxMatch?.[1]) {
    const viewBoxValues = viewBoxMatch[1].split(/\s+/).map(Number);
    if (viewBoxValues.length === 4) {
      return { width: viewBoxValues[2]!, height: viewBoxValues[3]! };
    }
  }

  // Fallback to width/height attributes
  const widthMatch = svgText.match(/width=["']([^"']+)["']/);
  const heightMatch = svgText.match(/height=["']([^"']+)["']/);

  if (widthMatch && heightMatch) {
    return {
      width: parseFloat(widthMatch[1]!),
      height: parseFloat(heightMatch[1]!),
    };
  }

  // Default fallback (staff dimensions)
  console.warn(
    "Could not extract SVG dimensions, using default staff dimensions"
  );
  return { width: 252.8, height: 77.8 };
}
