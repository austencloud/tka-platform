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
  // Regex parse (no DOMParser): the composition worker has no DOM and DOMParser
  // is undefined there. Reads the same `viewBox` attribute and `#centerPoint`
  // cx/cy the DOM path used.
  const vbMatch = svgText.match(
    /<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i
  );
  const viewBoxValues = vbMatch
    ? vbMatch[1]!.trim().split(/\s+/)
    : ["0", "0", "100", "100"];
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

  // Find the centerPoint element (id="centerPoint") and read its cx/cy.
  const cpTag = svgText.match(
    /<[^>]*\bid\s*=\s*["']centerPoint["'][^>]*>/i
  );
  if (cpTag) {
    const cxM = cpTag[0].match(/\bcx\s*=\s*["']([^"']+)["']/i);
    const cyM = cpTag[0].match(/\bcy\s*=\s*["']([^"']+)["']/i);
    const rawCenterX = cxM ? parseFloat(cxM[1]!) || center.x : center.x;
    const rawCenterY = cyM ? parseFloat(cyM[1]!) || center.y : center.y;

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
