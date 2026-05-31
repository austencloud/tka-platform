/**
 * Sanitize an SVG string so the strict XML parser behind
 * createImageBitmap() and `<img src="data:image/svg+xml;...">` decode can read it.
 *
 * The letter glyph SVGs under static/images/letters_trimmed/ ship two quirks:
 *   1. A malformed double-encoded attribute, e.g.
 *      style="style=&quot;enable-background:new 0 0 200.0 100.0&quot;"
 *   2. No explicit width/height (only a viewBox).
 *
 * A lenient HTMLImageElement tolerates both. The strict parser used by
 * createImageBitmap (workers/OffscreenCanvas) and by some data-URL decoders
 * (notably iOS WebKit) rejects the markup, so the glyph silently fails to draw
 * — exactly the "missing glyphs in rendered card images" symptom. Strip the bad
 * attribute and inject dimensions from the viewBox so every decode path agrees.
 *
 * Pure string transform — safe to call on any SVG; a no-op when the markup is
 * already clean.
 */
export function sanitizeSvgForBitmap(svgString: string): string {
  let processed = svgString;

  // Strip malformed double-encoded style attributes found in letter SVGs.
  // The enable-background property is deprecated and safe to remove.
  processed = processed.replace(/\s+style="style=&quot;[^"]*&quot;"/g, "");

  // Ensure explicit width/height (required for intrinsic size by strict parsers).
  if (!/<svg[^>]*\bwidth\s*=/.test(processed) || !/<svg[^>]*\bheight\s*=/.test(processed)) {
    const viewBoxMatch = processed.match(/viewBox\s*=\s*["']([^"']+)["']/);
    const viewBoxValue = viewBoxMatch?.[1];
    if (viewBoxValue) {
      const parts = viewBoxValue.split(/\s+/).map(Number);
      const width = parts[2] || 100;
      const height = parts[3] || 100;
      processed = processed.replace(/<svg/, `<svg width="${width}" height="${height}"`);
    } else {
      processed = processed.replace(/<svg/, '<svg width="100" height="100"');
    }
  }

  return processed;
}
