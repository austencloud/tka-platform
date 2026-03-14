/**
 * Sanitizes SVG markup for safe inline rendering via {@html}.
 * Allows SVG elements and attributes but blocks script injection.
 */
export interface ISvgSanitizer {
  sanitize(svgMarkup: string): string;
}
