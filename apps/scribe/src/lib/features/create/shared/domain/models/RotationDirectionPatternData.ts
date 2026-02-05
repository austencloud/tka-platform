/**
 * Rotation Direction Pattern Domain Models
 *
 * Data structures for storing and applying rotation direction patterns.
 * Rotation direction patterns capture the rotation direction (CW/CCW/none) per beat
 * and can be saved/applied to transform sequences.
 *
 * Key difference from Turn Patterns:
 * - Turn patterns modify the NUMBER of turns (0, 1, 2, fl, etc.)
 * - Rotation direction patterns modify the DIRECTION of rotation (CW vs CCW)
 * - This tool NEVER adds or removes turns - only changes direction where rotation exists
 */

import type { Timestamp } from "firebase/firestore";

/**
 * Rotation direction value type
 * - "cw" = clockwise rotation
 * - "ccw" = counter-clockwise rotation
 * - "none" = no rotation (float, static@0, dash@0)
 */
export type RotationDirectionValue = "cw" | "ccw" | "none";

/**
 * Single entry in a rotation direction pattern - captures direction for one beat
 */
export interface RotationDirectionPatternEntry {
  /** 0-based index into the sequence steps array */
  readonly stepIndex: number;
  /** Blue motion rotation direction, or null if no blue motion on this beat */
  readonly blue: RotationDirectionValue | null;
  /** Red motion rotation direction, or null if no red motion on this beat */
  readonly red: RotationDirectionValue | null;
}

/**
 * Complete rotation direction pattern stored in Firebase
 */
export interface RotationDirectionPattern {
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
  /** Rotation direction values for each beat */
  readonly entries: readonly RotationDirectionPatternEntry[];
}

/**
 * Data for creating a new rotation direction pattern (before Firebase assigns ID)
 */
export interface RotationDirectionPatternCreateData {
  readonly name: string;
  readonly userId: string;
  readonly stepCount: number;
  readonly entries: readonly RotationDirectionPatternEntry[];
}

/**
 * Type guard to check if a value is a valid RotationDirectionValue
 */
export function isRotationDirectionValue(
  value: unknown
): value is RotationDirectionValue {
  return value === "cw" || value === "ccw" || value === "none";
}

/**
 * Type guard to check if an object is a valid RotationDirectionPatternEntry
 */
export function isRotationDirectionPatternEntry(
  obj: unknown
): obj is RotationDirectionPatternEntry {
  if (typeof obj !== "object" || obj === null) return false;
  const entry = obj as Record<string, unknown>;
  return (
    typeof entry.stepIndex === "number" &&
    (entry.blue === null || isRotationDirectionValue(entry.blue)) &&
    (entry.red === null || isRotationDirectionValue(entry.red))
  );
}

/**
 * Type guard to check if an object is a valid RotationDirectionPattern
 */
export function isRotationDirectionPattern(
  obj: unknown
): obj is RotationDirectionPattern {
  if (typeof obj !== "object" || obj === null) return false;
  const pattern = obj as Record<string, unknown>;
  return (
    typeof pattern.id === "string" &&
    typeof pattern.name === "string" &&
    typeof pattern.userId === "string" &&
    typeof pattern.stepCount === "number" &&
    Array.isArray(pattern.entries) &&
    pattern.entries.every(isRotationDirectionPatternEntry)
  );
}

/**
 * Validate that a pattern can be applied to a sequence with the given beat count
 */
export function validatePatternForSequence(
  pattern: RotationDirectionPattern,
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
 * Format a rotation direction value for display
 * - "cw" → "CW"
 * - "ccw" → "CC"
 * - "none" → "--"
 * - null → "-"
 */
export function formatRotationValue(
  value: RotationDirectionValue | null
): string {
  if (value === null) return "-";
  if (value === "cw") return "CW";
  if (value === "ccw") return "CC";
  return "--";
}
