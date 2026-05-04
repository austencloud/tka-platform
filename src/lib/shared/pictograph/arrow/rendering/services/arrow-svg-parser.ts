/**
 * SVG Parsing Service
 *
 * Handles parsing SVG content to extract viewBox and center points.
 */

import type { SVGDimensions } from "../../../shared/domain/models/svg-models";

/**
 * Parse SVG to get proper dimensions and center point (extracted from Arrow.svelte)
 */
export function parseArrowSvg(svgText: string): SVGDimensions {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;

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
  const isDashArrow = viewBox.width < 50 && viewBox.height < 50;
  if (isDashArrow) {
    const targetSize = 250;
    const currentSize = Math.max(viewBox.width, viewBox.height);
    const scaleFactor = targetSize / currentSize;
    viewBox = {
      width: viewBox.width * scaleFactor,
      height: viewBox.height * scaleFactor,
    };
  }

  let center = { x: viewBox.width / 2, y: viewBox.height / 2 };

  try {
    const centerElement = doc.getElementById("centerPoint");
    if (centerElement) {
      const rawCenterX =
        parseFloat(centerElement.getAttribute("cx") || "0") || center.x;
      const rawCenterY =
        parseFloat(centerElement.getAttribute("cy") || "0") || center.y;

      if (isDashArrow) {
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
    viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
    center,
  };
}

/**
 * Extract SVG content (everything inside the <svg> tags)
 */
export function extractSvgContent(svgText: string): string {
  const hasWidthZero = svgText.includes('width="0"');
  const isSelfClosing = /<svg[^>]*\/>/i.test(svgText);

  if (hasWidthZero || isSelfClosing) {
    return "";
  }

  const svgContentMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!svgContentMatch?.[1]) {
    console.warn("Could not extract SVG content from non-static arrow");
    return svgText;
  }

  return svgContentMatch[1];
}
