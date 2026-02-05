/**
 * Turn Pattern Domain Models
 *
 * Data structures for storing and applying turn patterns.
 * Turn patterns capture the turn values (rotation amounts) per beat
 * and can be saved/applied to transform sequences.
 */

import type { Timestamp } from "firebase/firestore";

/**
 * Turn value type - can be a number (0, 0.5, 1, etc.) or "fl" for float
 */
export type TurnValue = number | "fl";

/**
 * Single entry in a turn pattern - captures turns for one beat
 */
export interface TurnPatternEntry {
  /** 0-based index into the sequence steps array */
  readonly stepIndex: number;
  /** Blue motion turn value, or null if no blue motion on this beat */
  readonly blue: TurnValue | null;
  /** Red motion turn value, or null if no red motion on this beat */
  readonly red: TurnValue | null;
}

/**
 * Complete turn pattern stored in Firebase
 */
export interface TurnPattern {
  /** Firebase document ID */
  readonly id: string;
  /** User-provided name for the pattern */
  readonly name: string;
  /** Owner's user ID */
  readonly userId: string;
  /** When the pattern was created */
  readonly createdAt: Timestamp;
  /** Number of steps in this pattern (must match target sequence) */
  readonly stepCount: number;
  /** Turn values for each beat */
  readonly entries: readonly TurnPatternEntry[];
}

/**
 * Data for creating a new turn pattern (before Firebase assigns ID)
 */
export interface TurnPatternCreateData {
  readonly name: string;
  readonly userId: string;
  readonly stepCount: number;
  readonly entries: readonly TurnPatternEntry[];
}

/**
 * Type guard to check if a value is a valid TurnValue
 */
export function isTurnValue(value: unknown): value is TurnValue {
  return typeof value === "number" || value === "fl";
}

/**
 * Type guard to check if an object is a valid TurnPatternEntry
 */
export function isTurnPatternEntry(obj: unknown): obj is TurnPatternEntry {
  if (typeof obj !== "object" || obj === null) return false;
  const entry = obj as Record<string, unknown>;
  return (
    typeof entry.stepIndex === "number" &&
    (entry.blue === null || isTurnValue(entry.blue)) &&
    (entry.red === null || isTurnValue(entry.red))
  );
}

/**
 * Type guard to check if an object is a valid TurnPattern
 */
export function isTurnPattern(obj: unknown): obj is TurnPattern {
  if (typeof obj !== "object" || obj === null) return false;
  const pattern = obj as Record<string, unknown>;
  return (
    typeof pattern.id === "string" &&
    typeof pattern.name === "string" &&
    typeof pattern.userId === "string" &&
    typeof pattern.stepCount === "number" &&
    Array.isArray(pattern.entries) &&
    pattern.entries.every(isTurnPatternEntry)
  );
}

/**
 * Validate that a pattern can be applied to a sequence with the given beat count
 */
export function validatePatternForSequence(
  pattern: TurnPattern,
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
 * Format a turn value for display
 */
export function formatTurnValue(value: TurnValue | null): string {
  if (value === null) return "-";
  if (value === "fl") return "fl";
  return value.toString();
}
