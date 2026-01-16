/**
 * Duration Display Utilities
 * Formats duration values as user-friendly fractions (¼×, ½×, 1½×, etc.)
 */

/**
 * Format a duration value for display using fractions
 * @param duration - Duration value (0.25 to 4.0)
 * @returns Formatted string like "¼×", "½×", "1×", "1½×", "2×", etc.
 */
export function formatDurationDisplay(duration: number): string {
  // Handle whole numbers
  if (duration === Math.floor(duration)) {
    return `${duration}×`;
  }

  // Separate whole and fractional parts
  const whole = Math.floor(duration);
  const fraction = duration - whole;

  // Map fractional parts to Unicode fractions
  let fractionStr: string;
  if (Math.abs(fraction - 0.25) < 0.001) {
    fractionStr = "¼";
  } else if (Math.abs(fraction - 0.5) < 0.001) {
    fractionStr = "½";
  } else if (Math.abs(fraction - 0.75) < 0.001) {
    fractionStr = "¾";
  } else {
    // Fallback for unexpected values
    fractionStr = fraction.toFixed(2);
  }

  // Combine whole and fraction
  if (whole === 0) {
    return `${fractionStr}×`;
  }
  return `${whole}${fractionStr}×`;
}

/**
 * Parse a formatted duration string back to a number
 * Useful for testing or if we ever need to parse user input
 * @param formatted - Formatted string like "1½×"
 * @returns Duration value or null if unparseable
 */
export function parseDurationDisplay(formatted: string): number | null {
  // Remove the × suffix
  const withoutSuffix = formatted.replace("×", "").trim();

  // Map fraction characters to values
  const fractionMap: Record<string, number> = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
  };

  // Check for pure fraction
  if (fractionMap[withoutSuffix] !== undefined) {
    return fractionMap[withoutSuffix];
  }

  // Check for whole number
  const wholeMatch = withoutSuffix.match(/^(\d+)$/);
  if (wholeMatch) {
    return parseInt(wholeMatch[1], 10);
  }

  // Check for mixed number (e.g., "1½")
  const mixedMatch = withoutSuffix.match(/^(\d+)([¼½¾])$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const fraction = fractionMap[mixedMatch[2]];
    if (fraction !== undefined) {
      return whole + fraction;
    }
  }

  return null;
}
