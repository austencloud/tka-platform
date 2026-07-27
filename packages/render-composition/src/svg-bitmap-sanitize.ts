/**
 * Sanitize an SVG string for strict bitmap decoders.
 *
 * Letter assets contain a malformed double-encoded style attribute and often
 * omit explicit dimensions. Browser and Node bitmap paths must normalize both
 * quirks before decoding.
 */
export function sanitizeSvgForBitmap(svgString: string): string {
  let processed = svgString;

  processed = processed.replace(
    /\s+style="style=&quot;[^"]*&quot;"/g,
    "",
  );

  if (
    !/<svg[^>]*\bwidth\s*=/.test(processed) ||
    !/<svg[^>]*\bheight\s*=/.test(processed)
  ) {
    const viewBoxMatch = processed.match(/viewBox\s*=\s*["']([^"']+)["']/);
    const viewBoxValue = viewBoxMatch?.[1];
    if (viewBoxValue) {
      const parts = viewBoxValue.split(/\s+/).map(Number);
      const width = parts[2] || 100;
      const height = parts[3] || 100;
      processed = processed.replace(
        /<svg/,
        `<svg width="${width}" height="${height}"`,
      );
    } else {
      processed = processed.replace(
        /<svg/,
        '<svg width="100" height="100"',
      );
    }
  }

  return processed;
}
