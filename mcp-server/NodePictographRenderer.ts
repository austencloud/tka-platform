/**
 * Node.js Pictograph Renderer
 *
 * Pure Node.js renderer that generates PNG images without any browser dependencies.
 *
 * Strategy:
 * 1. Use createNodePictographPreparer() to get positioned SVG content
 * 2. Composite all SVG elements (grid, props, arrows) into one master SVG
 * 3. Use @resvg/resvg-js to convert SVG → PNG
 *
 * This is the future-proof approach - no Playwright, no browser, just pure Node.js.
 */

import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";
import { createNodePictographPreparer } from "../scripts/node/create-node-pictograph-preparer";
import type { PictographData } from "../src/lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreparedRenderData } from "../src/lib/shared/pictograph/shared/domain/models/PreparedPictographData";
import { GridMode } from "../src/lib/shared/pictograph/grid/domain/enums/grid-enums";

// Constants matching the SVG system
const VIEWBOX_SIZE = 950;
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;

interface RenderOptions {
  darkMode?: boolean;
  size?: number;
  showLetter?: boolean;
}

export class NodePictographRenderer {
  private preparer: ReturnType<typeof createNodePictographPreparer>;
  private gridCache = new Map<string, string>();

  constructor() {
    this.preparer = createNodePictographPreparer();
  }

  /**
   * Render a pictograph to PNG buffer
   */
  async renderToPng(
    pictographData: PictographData,
    options: RenderOptions = {}
  ): Promise<Buffer> {
    const svg = await this.renderToSvg(pictographData, options);
    return this.svgToPng(svg, options.size || 400);
  }

  /**
   * Render a pictograph to base64-encoded PNG
   */
  async renderToBase64(
    pictographData: PictographData,
    options: RenderOptions = {}
  ): Promise<string> {
    const png = await this.renderToPng(pictographData, options);
    return png.toString("base64");
  }

  /**
   * Render a pictograph to complete SVG string
   */
  async renderToSvg(
    pictographData: PictographData,
    options: RenderOptions = {}
  ): Promise<string> {
    const { darkMode = true, showLetter = true } = options;

    // Prepare pictograph data (get arrow/prop positions and SVG content)
    const prepared = await this.preparer.pictographPreparer.prepareSingle(
      pictographData,
      { themeMode: darkMode ? "dark" : "light" }
    );

    const renderData = prepared._prepared;
    if (!renderData) {
      throw new Error("Failed to prepare pictograph data");
    }

    // Build composite SVG
    const svgParts: string[] = [];

    // 1. Background
    const bgColor = darkMode ? "#0a0a0f" : "#ffffff";
    svgParts.push(`<rect width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}" fill="${bgColor}"/>`);

    // 2. Grid
    const gridSvg = this.getGridSvg(renderData.gridMode, darkMode);
    if (gridSvg) {
      svgParts.push(gridSvg);
    }

    // 3. Props
    for (const color of ["blue", "red"]) {
      const propSvg = this.buildPropSvg(renderData, color, darkMode);
      if (propSvg) {
        svgParts.push(propSvg);
      }
    }

    // 4. Arrows
    for (const color of ["blue", "red"]) {
      const arrowSvg = this.buildArrowSvg(renderData, color);
      if (arrowSvg) {
        svgParts.push(arrowSvg);
      }
    }

    // 5. TKA Letter glyph
    if (showLetter && pictographData.letter) {
      const letterSvg = this.getLetterSvg(pictographData.letter, darkMode);
      if (letterSvg) {
        svgParts.push(letterSvg);
      }
    }

    // Wrap in complete SVG document
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}"
     width="${VIEWBOX_SIZE}"
     height="${VIEWBOX_SIZE}">
${svgParts.join("\n")}
</svg>`;

    return svg;
  }

  /**
   * Get grid SVG content
   */
  private getGridSvg(gridMode: GridMode, darkMode: boolean): string {
    const gridType = gridMode === GridMode.BOX ? "box" : "diamond";
    const cacheKey = `${gridType}:${darkMode}`;

    if (this.gridCache.has(cacheKey)) {
      return this.gridCache.get(cacheKey)!;
    }

    try {
      // Load grid SVG from file system
      const gridPath = join(process.cwd(), "static", "images", "grid", `${gridType}_grid.svg`);
      const gridSvg = readFileSync(gridPath, "utf-8");

      // Extract inner content from the grid SVG
      const innerMatch = gridSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let innerContent = innerMatch ? innerMatch[1] : gridSvg;

      // Apply dark mode styling - invert the grid for dark mode
      // Grid SVGs are black on transparent, we need white for dark mode
      let transformedContent: string;
      if (darkMode) {
        // For dark mode, we need to change the stroke/fill colors to white with opacity
        innerContent = innerContent.replace(/stroke\s*=\s*["']#000000["']/gi, 'stroke="#d0d0d0"');
        innerContent = innerContent.replace(/stroke\s*=\s*["']black["']/gi, 'stroke="#d0d0d0"');
        innerContent = innerContent.replace(/fill\s*=\s*["']#000000["']/gi, 'fill="#d0d0d0"');
        innerContent = innerContent.replace(/fill\s*=\s*["']black["']/gi, 'fill="#d0d0d0"');
        // Also handle style attributes
        innerContent = innerContent.replace(/stroke\s*:\s*#000000/gi, "stroke:#d0d0d0");
        innerContent = innerContent.replace(/stroke\s*:\s*black/gi, "stroke:#d0d0d0");
        innerContent = innerContent.replace(/fill\s*:\s*#000000/gi, "fill:#d0d0d0");
        innerContent = innerContent.replace(/fill\s*:\s*black/gi, "fill:#d0d0d0");
        transformedContent = `<g opacity="0.85">${innerContent}</g>`;
      } else {
        // Light mode - grid stays black
        transformedContent = `<g opacity="0.7">${innerContent}</g>`;
      }

      // Apply rotation for box mode
      if (gridMode === GridMode.BOX) {
        const center = VIEWBOX_SIZE / 2;
        transformedContent = `<g transform="rotate(45 ${center} ${center})">${transformedContent}</g>`;
      }

      this.gridCache.set(cacheKey, transformedContent);
      return transformedContent;
    } catch (error) {
      console.error(`Failed to load grid SVG:`, error);
      return "";
    }
  }

  /**
   * Build prop SVG element with transforms
   */
  private buildPropSvg(
    renderData: PreparedRenderData,
    color: string,
    darkMode: boolean
  ): string | null {
    const position = renderData.propPositions[color];
    const assets = renderData.propAssets[color];

    if (!position || !assets?.imageSrc) {
      return null;
    }

    // Parse viewBox
    const viewBoxParts = assets.viewBox.split(" ").map(Number);
    const viewBoxWidth = viewBoxParts[0] || 100;
    const viewBoxHeight = viewBoxParts[1] || 100;

    // Build transform: translate → rotate → translate(-center)
    // This matches the Canvas2DDirectRenderer transform order
    const transforms = [
      `translate(${position.x}, ${position.y})`,
      `rotate(${position.rotation})`,
      `translate(${-assets.center.x}, ${-assets.center.y})`,
    ];

    // Wrap prop SVG content in a group with transforms
    return `<g transform="${transforms.join(" ")}">
  <svg width="${viewBoxWidth}" height="${viewBoxHeight}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
    ${assets.imageSrc}
  </svg>
</g>`;
  }

  /**
   * Build arrow SVG element with transforms
   */
  private buildArrowSvg(renderData: PreparedRenderData, color: string): string | null {
    const position = renderData.arrowPositions[color];
    const assets = renderData.arrowAssets[color];
    const shouldMirror = renderData.arrowMirroring[color] ?? false;

    if (!position || !assets?.imageSrc) {
      return null;
    }

    // Get dimensions from the viewBox object
    const viewBoxWidth = assets.viewBox.width || 100;
    const viewBoxHeight = assets.viewBox.height || 100;

    // Parse full viewBox to get origin offset
    let viewBoxMinX = 0,
      viewBoxMinY = 0;
    if (assets.viewBox.fullViewBox) {
      const parts = assets.viewBox.fullViewBox.split(/\s+/);
      viewBoxMinX = parseFloat(parts[0] || "0") || 0;
      viewBoxMinY = parseFloat(parts[1] || "0") || 0;
    }

    // Calculate center in image coordinates
    // The center from ArrowSvgParser is in SVG coordinates.
    // For positioning: pixelCenter = svgCenter - viewBoxOrigin
    const centerX = (assets.center?.x ?? viewBoxWidth / 2) - viewBoxMinX;
    const centerY = (assets.center?.y ?? viewBoxHeight / 2) - viewBoxMinY;

    // Build transform chain: translate → rotate → mirror → translate(-center)
    const transforms = [
      `translate(${position.x}, ${position.y})`,
      `rotate(${position.rotation})`,
    ];

    if (shouldMirror) {
      transforms.push(`scale(-1, 1)`);
    }

    transforms.push(`translate(${-centerX}, ${-centerY})`);

    // Construct the full viewBox string
    const fullViewBox = assets.viewBox.fullViewBox || `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

    return `<g transform="${transforms.join(" ")}">
  <svg width="${viewBoxWidth}" height="${viewBoxHeight}" viewBox="${fullViewBox}" overflow="visible">
    ${assets.imageSrc}
  </svg>
</g>`;
  }

  /**
   * Get letter SVG content
   */
  private getLetterSvg(letter: string, darkMode: boolean): string | null {
    try {
      // Map Greek letters to file names
      const letterFileMap: Record<string, string> = {
        α: "alpha",
        β: "beta",
        γ: "gamma",
        Γ: "Gamma",
        Δ: "Delta",
        Θ: "Theta",
        Λ: "Lambda",
        Σ: "Sigma",
        Φ: "Phi",
        Ψ: "Psi",
        Ω: "Omega",
        W: "W-",
        "-": "dash",
      };

      let fileName = letterFileMap[letter] || letter;
      const letterPath = join(
        process.cwd(),
        "static",
        "images",
        "letters",
        "Type1",
        `${fileName}.svg`
      );

      const letterSvg = readFileSync(letterPath, "utf-8");

      // Parse viewBox to get dimensions
      const viewBoxMatch = letterSvg.match(/viewBox\s*=\s*"([^"]+)"/i);
      let width = 100,
        height = 100;
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
        width = parts[2] || 100;
        height = parts[3] || 100;
      }

      // Extract inner content
      const innerMatch = letterSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let innerContent = innerMatch ? innerMatch[1] : letterSvg;

      // Apply dark mode color inversion (letter SVGs are black by default)
      if (darkMode) {
        innerContent = innerContent.replace(/fill\s*=\s*["']#000000["']/gi, 'fill="#e6e6e6"');
        innerContent = innerContent.replace(/fill\s*=\s*["']black["']/gi, 'fill="#e6e6e6"');
        innerContent = innerContent.replace(/fill\s*:\s*#000000/gi, "fill:#e6e6e6");
        innerContent = innerContent.replace(/fill\s*:\s*black/gi, "fill:#e6e6e6");
      }

      return `<g transform="translate(${TKA_GLYPH_X}, ${TKA_GLYPH_Y})">
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${innerContent}
  </svg>
</g>`;
    } catch (error) {
      console.error(`Failed to load letter SVG for "${letter}":`, error);
      // Fallback to text element
      const textColor = darkMode ? "#e6e6e6" : "#000000";
      return `<text x="${TKA_GLYPH_X}" y="${TKA_GLYPH_Y + 80}" font-family="Georgia, serif" font-size="100" font-weight="bold" fill="${textColor}">${letter}</text>`;
    }
  }

  /**
   * Convert SVG string to PNG buffer using resvg-js
   */
  private svgToPng(svg: string, size: number): Buffer {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: size,
      },
      font: {
        // Load system fonts for text fallback
        loadSystemFonts: true,
      },
    });

    const pngData = resvg.render();
    return Buffer.from(pngData.asPng());
  }
}

// Singleton instance
let rendererInstance: NodePictographRenderer | null = null;

export function getNodePictographRenderer(): NodePictographRenderer {
  if (!rendererInstance) {
    rendererInstance = new NodePictographRenderer();
  }
  return rendererInstance;
}
