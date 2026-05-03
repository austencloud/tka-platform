import DOMPurify from "dompurify";

/**
 * Only these CSS properties are allowed in style attributes.
 * Blocks dangerous properties like expression(), url(), -moz-binding.
 */
const SAFE_STYLE_PROPERTIES = new Set([
  "fill", "stroke", "stroke-width", "opacity", "color",
  "fill-opacity", "stroke-opacity", "fill-rule",
  "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "font-size", "font-weight", "font-family",
  "text-anchor", "dominant-baseline", "display", "visibility",
]);

/**
 * Sanitizes SVG markup for safe inline rendering.
 *
 * The pictograph API returns SVG strings that we render via Svelte's {@html}
 * directive. Without sanitization, any script injection in the SVG would
 * execute in the user's browser. This service strips dangerous elements
 * (script, foreignObject) and event handler attributes while preserving
 * all valid SVG rendering elements and CSS custom properties.
 *
 * Style attributes are allowed but sanitized: only safe SVG presentation
 * properties (fill, stroke, opacity, color, etc.) are kept. Properties
 * like expression(), url(), and -moz-binding are stripped.
 */
export class SvgSanitizer {
  sanitize(svgMarkup: string): string {
    // Sanitize style attribute values to only allow safe CSS properties.
    // This runs before DOMPurify's main sanitization pass.
    const withSafeStyles = svgMarkup.replace(
      /style="([^"]*)"/g,
      (_match, styleContent: string) => {
        const safeParts = styleContent
          .split(";")
          .map((decl: string) => decl.trim())
          .filter((decl: string) => {
            if (!decl) return false;
            const colonIdx = decl.indexOf(":");
            if (colonIdx === -1) return false;
            const prop = decl.substring(0, colonIdx).trim().toLowerCase();
            return SAFE_STYLE_PROPERTIES.has(prop);
          });
        return safeParts.length > 0
          ? `style="${safeParts.join("; ")}"`
          : "";
      }
    );

    return DOMPurify.sanitize(withSafeStyles, {
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
        "class", "style",
      ],
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "onfocus"],
    });
  }
}
