/**
 * Musical Position Calculator
 *
 * Calculates the musical position of beats based on their durations.
 * Supports two display modes:
 * - Decimal mode: "1", "1.25", "1.5", "2", etc.
 * - Musician mode: "1", "1e", "1&", "1a", "2", etc.
 *
 * Assumes 4 subdivisions per beat (standard 16th note subdivision in 4/4).
 */

import type { BeatData } from "../../domain/models/BeatData";

/** Number of subdivisions per beat (standard 16th notes in 4/4) */
export const SUBDIVISIONS_PER_BEAT = 4;

/**
 * Calculate the cumulative subdivision index for a beat
 * @param beatIndex - 0-based index in the beats array
 * @param beats - Array of beat data
 * @returns The subdivision index where this beat starts (0-based)
 */
export function calculateSubdivisionIndex(
  beatIndex: number,
  beats: readonly BeatData[]
): number {
  let total = 0;
  for (let i = 0; i < beatIndex && i < beats.length; i++) {
    const duration = beats[i].duration ?? 1;
    total += duration * SUBDIVISIONS_PER_BEAT;
  }
  return Math.round(total); // Round to handle floating point imprecision
}

/**
 * Format a subdivision index as a decimal position
 * @param subdivisionIndex - The subdivision index (0-based)
 * @returns Formatted string like "1", "1.25", "1.5", "2", etc.
 */
export function formatPositionDecimal(subdivisionIndex: number): string {
  const beat = Math.floor(subdivisionIndex / SUBDIVISIONS_PER_BEAT) + 1;
  const subdivision = subdivisionIndex % SUBDIVISIONS_PER_BEAT;

  if (subdivision === 0) {
    return beat.toString();
  }

  // Convert subdivision to decimal: 1 → .25, 2 → .5, 3 → .75
  const decimal = (subdivision / SUBDIVISIONS_PER_BEAT) * 100;

  // Format without trailing zeros
  if (decimal === 25) return `${beat}.25`;
  if (decimal === 50) return `${beat}.5`;
  if (decimal === 75) return `${beat}.75`;

  // Fallback for unexpected values
  return `${beat}.${decimal}`;
}

/**
 * Format a subdivision index as musical notation
 * @param subdivisionIndex - The subdivision index (0-based)
 * @returns Formatted string like "1", "1e", "1&", "1a", "2", etc.
 */
export function formatPositionNotation(subdivisionIndex: number): string {
  const beat = Math.floor(subdivisionIndex / SUBDIVISIONS_PER_BEAT) + 1;
  const subdivision = subdivisionIndex % SUBDIVISIONS_PER_BEAT;

  // Standard subdivision notation: 1 e & a
  const suffixes = ["", "e", "&", "a"];

  return `${beat}${suffixes[subdivision]}`;
}

/**
 * Format a subdivision index based on the current mode
 * @param subdivisionIndex - The subdivision index (0-based)
 * @param musicianMode - Whether to use musician notation (true) or decimal (false)
 * @returns Formatted position string
 */
export function formatPosition(
  subdivisionIndex: number,
  musicianMode: boolean
): string {
  return musicianMode
    ? formatPositionNotation(subdivisionIndex)
    : formatPositionDecimal(subdivisionIndex);
}

/**
 * Calculate all beat positions for a sequence
 * @param beats - Array of beat data
 * @param musicianMode - Whether to use musician notation
 * @returns Array of formatted position strings, one per beat
 */
export function calculateAllPositions(
  beats: readonly BeatData[],
  musicianMode: boolean
): string[] {
  return beats.map((_, index) => {
    const subdivisionIndex = calculateSubdivisionIndex(index, beats);
    return formatPosition(subdivisionIndex, musicianMode);
  });
}
