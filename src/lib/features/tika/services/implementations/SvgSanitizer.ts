import DOMPurify from "dompurify";
import type { ISvgSanitizer } from "../contracts/ISvgSanitizer";

/**
 * Sanitizes SVG markup for safe inline rendering.
 *
 * The pictograph API returns SVG strings that we render via Svelte's {@html}
 * directive. Without sanitization, any script injection in the SVG would
 * execute in the user's browser. This service strips dangerous elements
 * (script, foreignObject) and attributes (onclick, onload) while preserving
 * all valid SVG rendering elements and CSS custom properties.
 */
export class SvgSanitizer implements ISvgSanitizer {
  sanitize(svgMarkup: string): string {
    return DOMPurify.sanitize(svgMarkup, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ["use"],
      ADD_ATTR: [
        "viewBox", "xmlns", "xmlns:xlink",
        "d", "cx", "cy", "r", "x", "y", "x1", "y1", "x2", "y2",
        "width", "height", "rx", "ry",
        "fill", "stroke", "stroke-width", "opacity",
        "fill-opacity", "stroke-opacity", "fill-rule",
        "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
        "stroke-miterlimit",
        "text-anchor", "dominant-baseline",
        "font-size", "font-weight", "font-family",
        "transform", "preserveAspectRatio",
        "marker-end", "refX", "refY",
        "markerWidth", "markerHeight", "orient",
        "role", "aria-label", "aria-hidden",
        "class",
      ],
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "onfocus", "style"],
    });
  }
}
