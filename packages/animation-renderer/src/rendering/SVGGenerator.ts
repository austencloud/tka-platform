/**
 * SVG Generator for creating prop staff images and grid.
 *
 * Package version: accepts dark mode via constructor config instead of
 * reading from a global singleton. Grid SVGs are loaded from a
 * configurable asset base path.
 */

import type { ISVGGenerator, PropSvgData } from "../contracts/ISVGGenerator";
import {
  applyColorToSvg,
  getMotionColor,
  type ThemeMode,
} from "../utils/svg-color-utils";
import { MotionColor } from "@tka/types";

export interface SVGGeneratorConfig {
  /** Base path for static assets (prop SVGs, grid SVGs). Default: "" (root) */
  assetBasePath?: string;
  /** Function to get current dark mode state. Default: () => true */
  getDarkMode?: () => boolean;
}

export class SVGGenerator implements ISVGGenerator {
  private static svgCache = new Map<string, string>();

  private readonly assetBasePath: string;
  private readonly getDarkMode: () => boolean;

  constructor(config: SVGGeneratorConfig = {}) {
    this.assetBasePath = config.assetBasePath ?? "";
    this.getDarkMode = config.getDarkMode ?? (() => true);
  }

  private getCurrentThemeMode(): ThemeMode {
    return this.getDarkMode() ? "dark" : "light";
  }

  /**
   * Generate grid SVG.
   * Accepts gridMode as a string ("diamond" or "box") for decoupling from the GridMode enum.
   */
  generateGridSvg(
    gridMode: string | unknown = "diamond",
    useStrictPoints: boolean = true
  ): string {
    const mode =
      typeof gridMode === "string" ? gridMode.toLowerCase() : "diamond";
    const gridFileName =
      mode === "box" ? "box_grid.svg" : "diamond_grid.svg";

    try {
      const cacheKey = `${this.assetBasePath}/images/grid/${gridFileName}`;
      let svgContent: string;

      if (SVGGenerator.svgCache.has(cacheKey)) {
        svgContent = SVGGenerator.svgCache.get(cacheKey)!;
      } else {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", cacheKey, false); // Synchronous request
        xhr.send();

        if (xhr.status !== 200) {
          return this.getFallbackGridSvg(mode);
        }
        svgContent = xhr.responseText;
        SVGGenerator.svgCache.set(cacheKey, svgContent);
      }

      if (useStrictPoints) {
        svgContent = svgContent.replace(
          /<svg([^>]*)>/,
          '<svg$1 class="strict-mode">'
        );
      }

      return svgContent;
    } catch {
      return this.getFallbackGridSvg(mode);
    }
  }

  private getFallbackGridSvg(gridMode: string): string {
    if (gridMode === "box") {
      return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 950 950" xml:space="preserve" class="strict-mode">
<style>
  .box-grid-stroke{stroke:#000;stroke-width:7;stroke-miterlimit:10}
  .normal-hand-point{fill:none}
  .strict-hand-point{fill:currentColor}
</style>
<circle id="center_point" cx="475" cy="475" r="11.2"/>
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

  async generatePropSvg(
    propType: string = "staff",
    color: string
  ): Promise<PropSvgData> {
    const propTypeLower = propType.toLowerCase();
    const path = `${this.assetBasePath}/images/props/animated/${propTypeLower}.svg`;
    const originalSvg = await this.fetchPropSvg(path);
    const coloredSvg = applyColorToSvg(originalSvg, color);
    const { width, height } = this.extractViewBoxDimensions(originalSvg);
    return { svg: coloredSvg, width, height };
  }

  async generateBluePropSvg(
    propType: string = "staff",
    darkMode?: boolean
  ): Promise<PropSvgData> {
    const themeMode =
      darkMode !== undefined
        ? darkMode
          ? "dark"
          : "light"
        : this.getCurrentThemeMode();
    return this.generatePropSvg(
      propType,
      getMotionColor(MotionColor.BLUE, themeMode)
    );
  }

  async generateRedPropSvg(
    propType: string = "staff",
    darkMode?: boolean
  ): Promise<PropSvgData> {
    const themeMode =
      darkMode !== undefined
        ? darkMode
          ? "dark"
          : "light"
        : this.getCurrentThemeMode();
    return this.generatePropSvg(
      propType,
      getMotionColor(MotionColor.RED, themeMode)
    );
  }

  private async fetchPropSvg(path: string): Promise<string> {
    if (SVGGenerator.svgCache.has(path)) {
      return SVGGenerator.svgCache.get(path)!;
    }

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch prop SVG from ${path}: ${response.statusText}`
      );
    }
    const svgText = await response.text();
    SVGGenerator.svgCache.set(path, svgText);
    return svgText;
  }

  private extractViewBoxDimensions(svgText: string): {
    width: number;
    height: number;
  } {
    const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/);
    if (viewBoxMatch?.[1]) {
      const viewBoxValues = viewBoxMatch[1].split(/\s+/).map(Number);
      if (viewBoxValues.length === 4) {
        return { width: viewBoxValues[2]!, height: viewBoxValues[3]! };
      }
    }

    const widthMatch = svgText.match(/width=["']([^"']+)["']/);
    const heightMatch = svgText.match(/height=["']([^"']+)["']/);

    if (widthMatch && heightMatch) {
      return {
        width: parseFloat(widthMatch[1]!),
        height: parseFloat(heightMatch[1]!),
      };
    }

    // Default fallback (staff dimensions)
    return { width: 252.8, height: 77.8 };
  }
}
