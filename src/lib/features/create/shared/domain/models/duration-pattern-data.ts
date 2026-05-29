/**
 * Duration Pattern Domain Models
 *
 * Data structures for storing and applying duration patterns.
 * Duration patterns capture the duration multiplier for each beat
 * and can be saved/applied to transform sequences.
 *
 * Key difference from Turn Patterns:
 * - Turn patterns modify the NUMBER of turns (0, 1, 2, fl, etc.)
 * - Duration patterns modify the TIME each beat is held (1x, 1.5x, 2x, etc.)
 * - Duration is a step-level property, not per-motion (both hands share the same duration)
 */

import type { Timestamp } from "firebase/firestore";

/**
 * Duration value type - multiplier for beat timing
 * A pictograph is fundamentally square at 1.0×; durations can only extend wider.
 * - 1.0 = normal duration (default, square pictograph)
 * - 1.25 = slightly wider
 * - 1.5 = wider
 * - 2.0 = double width (slow)
 * - 4.0 = quadruple width (very slow)
 */
export type DurationValue = number;

/**
 * Single entry in a duration pattern - captures duration for one beat
 */
export interface DurationPatternEntry {
  /** 0-based index into the sequence steps array */
  readonly stepIndex: number;
  /** Duration multiplier for this beat (1.0 = normal) */
  readonly duration: DurationValue;
}

/**
 * Complete duration pattern stored in Firebase
 */
export interface DurationPattern {
  /** Firebase document ID */
  readonly id: string;
  /** User-provided name for the pattern */
  readonly name: string;
  /** Owner's user ID */
  readonly userId: string;
  /** When the pattern was created (null until Firestore assigns server timestamp) */
  readonly createdAt: Timestamp | null;
  /** Number of steps in this pattern (must match target sequence) */
  readonly stepCount: number;
  /** Duration values for each beat */
  readonly entries: readonly DurationPatternEntry[];
}

/**
 * Data for creating a new duration pattern (before Firebase assigns ID)
 */
export interface DurationPatternCreateData {
  readonly name: string;
  readonly userId: string;
  readonly stepCount: number;
  readonly entries: readonly DurationPatternEntry[];
}

/**
 * Type guard to check if a value is a valid DurationValue
 */
export function isDurationValue(value: unknown): value is DurationValue {
  return typeof value === "number" && value >= 1.0;
}

/**
 * Type guard to check if an object is a valid DurationPatternEntry
 */
export function isDurationPatternEntry(
  obj: unknown
): obj is DurationPatternEntry {
  if (typeof obj !== "object" || obj === null) return false;
  const entry = obj as Record<string, unknown>;
  return (
    typeof entry.stepIndex === "number" && isDurationValue(entry.duration)
  );
}

/**
 * Type guard to check if an object is a valid DurationPattern
 */
export function isDurationPattern(obj: unknown): obj is DurationPattern {
  if (typeof obj !== "object" || obj === null) return false;
  const pattern = obj as Record<string, unknown>;
  return (
    typeof pattern.id === "string" &&
    typeof pattern.name === "string" &&
    typeof pattern.userId === "string" &&
    typeof pattern.stepCount === "number" &&
    Array.isArray(pattern.entries) &&
    pattern.entries.every(isDurationPatternEntry)
  );
}

/**
 * Validate that a pattern can be applied to a sequence with the given beat count
 */
export function validatePatternForSequence(
  pattern: DurationPattern,
  sequenceStepCount: number
): { valid: boolean; error?: string } {
  if (pattern.stepCount !== sequenceStepCount) {
    return {
      valid: false,
      error: `Pattern has ${pattern.stepCount} steps but sequence has ${sequenceStepCount} steps`,
    };
  }
  return { valid: true };
}

/**
 * Format a duration value for display
 * - 1.0 → "100%"
 * - 1.5 → "150%"
 * - 2.0 → "200%"
 * - 4.0 → "400%"
 */
export function formatDurationValue(value: DurationValue): string {
  const percentage = Math.round(value * 100);
  return `${percentage}%`;
}

/**
 * Format a duration value for compact display (beat grid)
 * - 1.0 → "" (empty - default duration, not shown)
 * - 1.25 → "1.25×"
 * - 1.5 → "1.5×"
 * - 2.0 → "2×"
 * - 4.0 → "4×"
 */
export function formatDurationCompact(value: DurationValue): string {
  // Don't show duration for 1 beat (the default/assumption)
  if (value === 1.0) return "";

  // Format as decimal, remove trailing zeros, add × suffix
  const formatted = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.?0+$/, "");

  return `${formatted}×`;
}
