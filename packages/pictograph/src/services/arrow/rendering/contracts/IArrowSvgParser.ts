import type { SVGDimensions } from "@tka/types";

export interface IArrowSvgParser {
  parseArrowSvg(svgText: string): SVGDimensions;
  extractSvgContent(svgText: string): string;
}
