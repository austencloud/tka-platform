/**
 * PropSvgUtils - Utilities for loading and coloring prop SVGs
 *
 * Uses the centralized svg-color-utils for color transformation.
 */

import type { MotionColor } from "../../../../pictograph/shared/domain/enums/pictograph-enums";
import { getPropTypeDisplayInfo } from "./PropTypeRegistry";
import type { PropType } from "../../../../pictograph/prop/domain/enums/PropType";
import { applyMotionColorToSvg } from "../../../../utils/svg-color-utils";

// Re-export for backward compatibility
export { applyMotionColorToSvg as applyColorToSvg } from "../../../../utils/svg-color-utils";

export interface ParsedSvgContent {
  content: string;
  viewBox: string;
}

/**
 * Load and parse an SVG for a prop type with the specified color
 */
export async function loadPropSvg(
  propType: PropType,
  color: MotionColor
): Promise<ParsedSvgContent | null> {
  try {
    const displayInfo = getPropTypeDisplayInfo(propType);
    const response = await fetch(displayInfo.image);
    if (!response.ok) return null;

    let svgText = await response.text();
    svgText = applyMotionColorToSvg(svgText, color, {
      transformStroke: true,
      makeClassNamesUnique: true,
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (svgElement) {
      return {
        content: svgElement.innerHTML,
        viewBox: svgElement.getAttribute("viewBox") ?? "0 0 100 100",
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to load prop SVG:", error);
    return null;
  }
}
