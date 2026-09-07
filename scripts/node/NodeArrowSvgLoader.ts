/**
 * Node.js Arrow SVG Loader
 *
 * Simplified version of ArrowSvgLoader for Node.js environments.
 * Uses file system instead of fetch() for loading SVG files.
 *
 * Reuses pure logic services:
 * - IArrowPathResolver (path resolution logic)
 * - IArrowSvgParser (SVG parsing logic)
 * - ISvgColorTransformer (color transformation logic)
 */

import type { IArrowPathResolver } from "../../src/lib/shared/pictograph/arrow/rendering/contracts/IArrowPathResolver";
import type { IArrowSvgParser } from "../../src/lib/shared/pictograph/arrow/rendering/contracts/IArrowSvgParser";
import type { ISvgColorTransformer } from "../../src/lib/shared/pictograph/arrow/rendering/contracts/IArrowSvgColorTransformer";
import type { ArrowPlacementData } from "../../src/lib/shared/pictograph/arrow/positioning/placement/domain/ArrowPlacementData";
import type { ArrowSvgData } from "../../src/lib/shared/pictograph/shared/domain/models/svg-models";
import type {
  IArrowSvgLoader,
  ArrowSvgLoadOptions,
} from "../../src/lib/shared/pictograph/arrow/rendering/services/contracts/IArrowSvgLoader";
import type { MotionData } from "../../src/lib/shared/pictograph/shared/domain/models/MotionData";
import { readFileSync } from "fs";
import { join } from "path";

export class NodeArrowSvgLoader implements IArrowSvgLoader {
  private rawSvgCache = new Map<string, string>(); // path -> raw SVG text
  private transformedSvgCache = new Map<string, ArrowSvgData>(); // path:color:themeMode -> transformed data

  constructor(
    private pathResolver: IArrowPathResolver,
    private svgParser: IArrowSvgParser,
    private colorTransformer: ISvgColorTransformer
  ) {}

  /**
   * Load arrow SVG data with color transformation based on placement data
   * @param options Optional settings including themeMode for color selection
   */
  async loadArrowSvg(
    arrowData: ArrowPlacementData,
    motionData: MotionData,
    options?: ArrowSvgLoadOptions
  ): Promise<ArrowSvgData> {
    const path = this.pathResolver.getArrowPath(arrowData, motionData);

    if (!path) {
      throw new Error("No arrow path available - missing motion data");
    }

    // Use explicit theme mode if provided, default to light
    const themeMode = options?.themeMode ?? "light";

    const transformedCacheKey = `${path}:${motionData.hand}:${themeMode}`;

    // Check transformed cache first
    if (this.transformedSvgCache.has(transformedCacheKey)) {
      return this.transformedSvgCache.get(transformedCacheKey)!;
    }

    // Fetch raw SVG (uses raw cache)
    const originalSvgText = await this.fetchSvgContent(path);

    const parsedSvg = this.svgParser.parseArrowSvg(originalSvgText);

    // Apply color transformation to the SVG
    const coloredSvgText = this.colorTransformer.applyColorToSvg(
      originalSvgText,
      motionData.hand,
      themeMode
    );

    // Extract just the inner SVG content
    const svgContent = this.svgParser.extractSvgContent(coloredSvgText);

    const result: ArrowSvgData = {
      id: `arrow-${Date.now()}`,
      svgContent: svgContent,
      imageSrc: svgContent,
      viewBox: parsedSvg.viewBox || "100 100",
      center: parsedSvg.center ?? undefined,
      dimensions: {
        width: parsedSvg.width || 100,
        height: parsedSvg.height || 100,
        viewBox: parsedSvg.viewBox || "100 100",
        center: parsedSvg.center ?? undefined,
      },
    };

    // Cache transformed result
    this.transformedSvgCache.set(transformedCacheKey, result);

    return result;
  }

  /**
   * Fetch SVG content from file system
   * Converts URL path to file system path and reads the file
   */
  async fetchSvgContent(path: string): Promise<string> {
    // Check raw SVG cache
    if (this.rawSvgCache.has(path)) {
      return this.rawSvgCache.get(path)!;
    }

    try {
      // Convert URL path to file system path
      // /images/arrows/foo.svg → static/images/arrows/foo.svg
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
}
