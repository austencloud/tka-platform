/**
 * SVG Parsing Service
 *
 * Handles parsing SVG content to extract viewBox and center points.
 * Extracted from ArrowRenderer to improve modularity and reusability.
 */

import type { SVGDimensions } from "../../../../shared/domain/models/svg-models";

export class ArrowSvgParser {
  /**
   * Parse SVG to get proper dimensions and center point (extracted from Arrow.svelte)
   */
  parseArrowSvg(svgText: string): SVGDimensions {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;

    // Get viewBox dimensions
    const viewBoxValues = svg.getAttribute("viewBox")?.split(/\s+/) || [
      "0",
      "0",
      "100",
      "100",
    ];
    let viewBox = {
      width: parseFloat(viewBoxValues[2] || "100") || 100,
      height: parseFloat(viewBoxValues[3] || "100") || 100,
    };

    // DASH ARROW SCALING FIX
    // Dash arrows have tiny viewBox (34.93 x 8.45) compared to other arrows (~250 x 250)
    // Scale dash arrows to match the size of other arrows for consistent rendering
    const isDashArrow = viewBox.width < 50 && viewBox.height < 50; // Detect dash arrows by small size
    if (isDashArrow) {
      // Scale factor to make dash arrows similar size to other arrows
      const targetSize = 250; // Target size similar to pro/anti arrows
      const currentSize = Math.max(viewBox.width, viewBox.height);
      const scaleFactor = targetSize / currentSize;

      viewBox = {
        width: viewBox.width * scaleFactor,
        height: viewBox.height * scaleFactor,
      };
    }

    // Get center point from SVG (scale center if we scaled the viewBox)
    let center = { x: viewBox.width / 2, y: viewBox.height / 2 };

    try {
      const centerElement = doc.getElementById("centerPoint");
      if (centerElement) {
        const rawCenterX =
          parseFloat(centerElement.getAttribute("cx") || "0") || center.x;
        const rawCenterY =
          parseFloat(centerElement.getAttribute("cy") || "0") || center.y;

        if (isDashArrow) {
          // Scale the center point too if we scaled the viewBox
          const targetSize = 250;
          const originalSize = Math.max(
            parseFloat(viewBoxValues[2] || "100"),
            parseFloat(viewBoxValues[3] || "100")
          );
          const scaleFactor = targetSize / originalSize;
          center = {
            x: rawCenterX * scaleFactor,
            y: rawCenterY * scaleFactor,
          };
        } else {
          center = { x: rawCenterX, y: rawCenterY };
        }
      }
    } catch {
      // SVG center calculation failed, using default center
    }

    return {
      width: viewBox.width,
      height: viewBox.height,
      // Return full 4-value viewBox string "minX minY width height" for Canvas2D rendering
      viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
      center,
    };
  }

  /**
   * Extract SVG content (everything inside the <svg> tags)
   */
  extractSvgContent(svgText: string): string {
    // Check if this is an empty/static SVG (self-closing or width="0")
    const hasWidthZero = svgText.includes('width="0"');

    // Fix: Properly detect self-closing SVG tags (e.g., <svg ... />)
    // Not just any file that contains both "<svg" and "/>" somewhere
    const isSelfClosing = /<svg[^>]*\/>/i.test(svgText);

    if (hasWidthZero || isSelfClosing) {
      // Static arrows are intentionally empty - return empty string
      return "";
    }

    // Extract SVG content (everything inside the <svg> tags)
    // Arrows are already correctly sized for 950x950 coordinate system
    const svgContentMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
    if (!svgContentMatch?.[1]) {
      console.warn("Could not extract SVG content from non-static arrow");
      return svgText;
    }

    return svgContentMatch[1];
  }
}

// Direct singleton export for HMR-friendly imports
export const arrowSvgParser = new ArrowSvgParser();
