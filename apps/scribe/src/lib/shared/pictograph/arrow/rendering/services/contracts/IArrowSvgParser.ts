/**
 * SVG Parser Interface
 */

import type { SVGDimensions } from "../../../../shared/domain/models/svg-models";

export interface IArrowSvgParser {
  /**
   * Parse SVG content and extract dimensions and center point
   */
  parseArrowSvg(svgText: string): SVGDimensions;

  /**
   * Extract SVG content (everything inside the <svg> tags)
   */
  extractSvgContent(svgText: string): string;
}
