/**
 * Global Arrow Adjustment Domain Model
 *
 * Represents a user-defined arrow position adjustment that applies globally
 * to all pictographs matching the same key (gridMode, oriKey, letter, turnsTuple, arrowKey).
 *
 * These adjustments are stored in Firestore and override the static JSON special placements.
 */

import type { Timestamp } from "firebase/firestore";

/**
 * A single global arrow adjustment entry
 */
export interface GlobalArrowAdjustment {
  /** Grid mode: "diamond" or "box" */
  readonly gridMode: string;

  /** Orientation key: "from_layer1", "from_layer2", etc. */
  readonly oriKey: string;

  /** Letter identifier: "A", "G", "W", "Λ", etc. */
  readonly letter: string;

  /** Turns tuple: "(2, 0.5)", "(s, 1, 1)", etc. */
  readonly turnsTuple: string;

  /** Arrow identifier: "blue", "red", "pro", "anti", etc. */
  readonly arrowKey: string;

  /** X-axis adjustment in pixels */
  readonly adjustmentX: number;

  /** Y-axis adjustment in pixels */
  readonly adjustmentY: number;

  /** When this adjustment was last modified */
  readonly updatedAt: Timestamp;

  /** Email of the admin who made the adjustment */
  readonly updatedBy: string;
}

/**
 * Data required to create or update a global adjustment
 */
export interface GlobalArrowAdjustmentInput {
  readonly gridMode: string;
  readonly oriKey: string;
  readonly letter: string;
  readonly turnsTuple: string;
  readonly arrowKey: string;
  readonly adjustmentX: number;
  readonly adjustmentY: number;
}

/**
 * Composite key for looking up adjustments
 */
export interface GlobalAdjustmentKey {
  readonly gridMode: string;
  readonly oriKey: string;
  readonly letter: string;
  readonly turnsTuple: string;
  readonly arrowKey: string;
}

/**
 * Generate a string key from adjustment key components
 */
export function generateAdjustmentKeyString(key: GlobalAdjustmentKey): string {
  return `${key.gridMode}|${key.oriKey}|${key.letter}|${key.turnsTuple}|${key.arrowKey}`;
}

/**
 * Parse a string key back into components
 */
export function parseAdjustmentKeyString(
  keyString: string
): GlobalAdjustmentKey | null {
  const parts = keyString.split("|");
  if (parts.length !== 5) {
    return null;
  }
  const [gridMode, oriKey, letter, turnsTuple, arrowKey] = parts;
  if (!gridMode || !oriKey || !letter || !turnsTuple || !arrowKey) {
    return null;
  }
  return {
    gridMode,
    oriKey,
    letter,
    turnsTuple,
    arrowKey,
  };
}
