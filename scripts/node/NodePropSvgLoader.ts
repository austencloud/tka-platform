/**
 * Node.js Prop SVG Loader
 *
 * Simplified version of PropSvgLoader for Node.js environments.
 * Uses file system instead of fetch() for loading SVG files.
 */

import type { MotionData } from "../../src/lib/shared/pictograph/shared/domain/models/MotionData";
import type { PropPlacementData } from "../../src/lib/shared/pictograph/prop/domain/models/PropPlacementData";
import type { PropRenderData } from "../../src/lib/shared/pictograph/prop/domain/models/PropRenderData";
import type {
  IPropSvgLoader,
  PropSvgLoadOptions,
} from "../../src/lib/shared/pictograph/prop/services/contracts/IPropSvgLoader";
import { MotionColor } from "../../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  applyMotionColorToSvg,
  type ThemeMode,
} from "../../src/lib/shared/utils/svg-color-utils";
import { readFileSync } from "fs";
import { join } from "path";

export class NodePropSvgLoader implements IPropSvgLoader {
  private rawSvgCache = new Map<string, string>(); // path -> raw SVG text
  private transformedSvgCache = new Map<string, PropRenderData>(); // path:color:themeMode -> transformed data
  private metadataCache = new Map<
    string,
    {
      viewBox: { width: number; height: number };
      center: { x: number; y: number };
    }
  >();

  /**
   * Load prop SVG data with color transformation
   * @param propData - Prop placement data
   * @param motionData - Motion data including prop type
   * @param useAnimatedVersion - If true, loads {propType}_animated.svg
   * @param options - Optional settings including themeMode for color selection
   */
  async loadPropSvg(
    propData: PropPlacementData,
    motionData: MotionData,
    useAnimatedVersion: boolean = false,
    options?: PropSvgLoadOptions
  ): Promise<PropRenderData> {
    try {
      // Get prop type and color
      const propType = motionData.propType || "staff";
      const color = motionData.color || MotionColor.BLUE;

      // Use explicit theme mode if provided, default to light
      const themeMode = options?.themeMode ?? "light";

      const suffix = useAnimatedVersion ? "_animated" : "";
      const path = `/images/props/pictograph/${propType}${suffix}.svg`;
      const transformedCacheKey = `${path}:${color}:${themeMode}`;

      // Check transformed cache first
      if (this.transformedSvgCache.has(transformedCacheKey)) {
        const cached = this.transformedSvgCache.get(transformedCacheKey)!;
        // Return with updated position/rotation (these are per-instance)
        return {
          ...cached,
          position: { x: propData.positionX, y: propData.positionY },
          rotation: propData.rotationAngle,
        };
      }

      // Fetch raw SVG
      const originalSvgText = await this.fetchSvgContent(path);

      // Parse SVG for viewBox and center
      const { viewBox, center } = this.parsePropSvg(originalSvgText, path);

      // Apply color transformation
      const coloredSvgText = applyMotionColorToSvg(
        originalSvgText,
        color,
        { themeMode }
      );

      // Extract SVG content
      let svgContent = this.extractSvgContent(coloredSvgText);

      // CRITICAL FIX: node-canvas doesn't support inline style attributes
      // Convert style="fill:#color" to direct fill="#color" attributes
      svgContent = svgContent.replace(/style\s*=\s*["']([^"']*)fill\s*:\s*([^;"']+)([^"']*)["']/gi, (match, before, color, after) => {
        const otherStyles = (before + after).trim();
        const fillAttr = `fill="${color.trim()}"`;
        return otherStyles ? `style="${otherStyles}" ${fillAttr}` : fillAttr;
      });

      const result: PropRenderData = {
        position: { x: propData.positionX, y: propData.positionY },
        rotation: propData.rotationAngle,
        svgData: {
          svgContent,
          viewBox,
          center,
        },
        loaded: true,
        error: null,
      };

      // Cache transformed result
      this.transformedSvgCache.set(transformedCacheKey, result);

      return result;
    } catch (error) {
      console.error(`Failed to load prop SVG:`, error);
      return {
        position: { x: propData.positionX, y: propData.positionY },
        rotation: propData.rotationAngle,
        svgData: {
          svgContent: "",
          viewBox: { width: 100, height: 100 },
          center: { x: 50, y: 50 },
        },
        loaded: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch SVG content from file system
   */
  async fetchSvgContent(path: string): Promise<string> {
    // Check raw SVG cache
    if (this.rawSvgCache.has(path)) {
      return this.rawSvgCache.get(path)!;
    }

    try {
      // Convert URL path to file system path
      const relativePath = path.startsWith('/') ? path.slice(1) : path;
      const filePath = join(process.cwd(), 'static', relativePath);

      // Read the SVG file
      const svgText = readFileSync(filePath, 'utf-8');

      // Cache the raw SVG
      this.rawSvgCache.set(path, svgText);

      return svgText;
    } catch (error) {
      throw new Error(`Failed to load SVG from ${path}: ${error}`);
    }
  }

  /**
   * Parse prop SVG to extract viewBox and center
   */
  private parsePropSvg(
    svgText: string,
    path: string
  ): {
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  } {
    // Check metadata cache
    if (this.metadataCache.has(path)) {
      return this.metadataCache.get(path)!;
    }

    // Parse viewBox
    const viewBoxMatch = svgText.match(/viewBox\s*=\s*"([^"]+)"/i);
    let viewBox = { width: 100, height: 100 };
    let center = { x: 50, y: 50 };

    if (viewBoxMatch) {
      const [x, y, width, height] = viewBoxMatch[1]
        .split(/\s+/)
        .map(parseFloat);
      viewBox = { width, height };
      center = { x: width / 2, y: height / 2 };
    }

    const result = { viewBox, center };
    this.metadataCache.set(path, result);

    return result;
  }

  /**
   * Extract SVG content (strip outer <svg> tag)
   */
  private extractSvgContent(svgText: string): string {
    // Remove XML declaration if present
    let content = svgText.replace(/<\?xml[^?]*\?>/g, "");

    // Try to extract content between <svg> tags
    const match = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    if (match) {
      return match[1].trim();
    }

    return content.trim();
  }
}
