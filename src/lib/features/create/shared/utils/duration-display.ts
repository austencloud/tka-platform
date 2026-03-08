/**
 * Duration Display Utilities
 * Formats duration values as decimals with × suffix (1×, 1.25×, 2×, etc.)
 * Minimum duration is 1.0 (square pictograph). Durations only extend wider.
 */

/**
 * Format a duration value for display using decimals
 * @param duration - Duration value (1.0 to 4.0)
 * @returns Formatted string like "1×", "1.25×", "2×", etc.
 */
export function formatDurationDisplay(duration: number): string {
  // Format as decimal, remove trailing zeros, add × suffix
  const formatted = Number.isInteger(duration)
    ? duration.toString()
    : duration.toFixed(2).replace(/\.?0+$/, "");

  return `${formatted}×`;
}

/**
 * Parse a formatted duration string back to a number
 * Useful for testing or if we ever need to parse user input
 * @param formatted - Formatted string like "1.5×" or "2×"
 * @returns Duration value or null if unparseable
 */
export function parseDurationDisplay(formatted: string): number | null {
  // Remove the × suffix
  const withoutSuffix = formatted.replace("×", "").trim();

  // Parse as decimal number
  const parsed = parseFloat(withoutSuffix);

  // Validate it's a valid number
  if (isNaN(parsed) || parsed < 1.0) {
    return null;
  }

  return parsed;
}
