/**
 * Circular Generation Models
 *
 * Type definitions for LOOP (Linked Orbital Offset Pattern) generation.
 * LOOPs are TKA's algorithmic extension patterns that transform sequences.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * LOOP Type Enum
 * Defines the different types of Linked Orbital Offset Patterns
 */
export enum LOOPType {
  /** Rotated - rotates positions around the grid */
  ROTATED = "rotated",

  /** Mirrored - mirrors positions vertically (left ↔ right) */
  MIRRORED = "mirrored",

  /** Flipped - mirrors positions horizontally (north ↔ south) */
  FLIPPED = "flipped",

  /** Swapped - swaps blue and red attributes */
  SWAPPED = "swapped",

  /** Inverted - uses inverted letters (opposite motion types) */
  INVERTED = "inverted",

  /** Swapped inverted - combines swapping with inverted motion */
  SWAPPED_INVERTED = "swapped_inverted",

  /** Rotated inverted - combines rotation with inverted motion */
  ROTATED_INVERTED = "rotated_inverted",

  /** Mirrored swapped - combines mirroring with color swapping */
  MIRRORED_SWAPPED = "mirrored_swapped",

  /** Mirrored inverted - combines mirroring with inverted motion */
  MIRRORED_INVERTED = "mirrored_inverted",

  /** Rotated swapped - combines rotation with color swapping */
  ROTATED_SWAPPED = "rotated_swapped",

  /** Mirrored rotated - combines mirroring with rotation */
  MIRRORED_ROTATED = "mirrored_rotated",

  /** Mirrored inverted rotated - combines all three transformations */
  MIRRORED_INVERTED_ROTATED = "mirrored_inverted_rotated",

  /** Mirrored rotated inverted swapped - combines all four transformations */
  MIRRORED_ROTATED_INVERTED_SWAPPED = "mirrored_rotated_inverted_swapped",

  /** Strict rewound - appends reversed sequence to double length */
  STRICT_REWOUND = "strict_rewound",
}

/**
 * Slice Size
 * Determines how the circle is divided for rotation
 */
export enum SliceSize {
  /** Half rotation - 180° */
  HALVED = "halved",

  /** Quarter rotation - 90° */
  QUARTERED = "quartered",
}

/**
 * LOOP Generation Options
 * Configuration for generating circular words
 */
export interface LOOPGenerationOptions {
  /** Total sequence length (will be multiplied based on slice size) */
  length: number;

  /** LOOP type to apply */
  loopType: LOOPType;

  /** Slice size for rotational LOOPs */
  sliceSize: SliceSize;

  /** Turn intensity (1-3) */
  turnIntensity: number;

  /** Difficulty level (1-3) */
  level: number;

  /** Prop continuity setting */
  propContinuity: "continuous" | "non-continuous";

  /** Grid mode */
  gridMode: "box" | "diamond";
}

/**
 * LOOP Validation Result
 * Result of validating whether a sequence can perform a given LOOP
 */
export interface LOOPValidationResult {
  /** Whether the sequence is valid for the LOOP type */
  isValid: boolean;

  /** Reason for invalidity (if applicable) */
  reason?: string;

  /** Expected end position for the LOOP (if applicable) */
  expectedEndPosition?: GridPosition;
}

/**
 * LOOP User-friendly labels
 * Maps LOOP types to display names for UI
 */
export const LOOP_TYPE_LABELS: Record<LOOPType, string> = {
  [LOOPType.ROTATED]: "Rotated",
  [LOOPType.MIRRORED]: "Mirrored",
  [LOOPType.FLIPPED]: "Flipped",
  [LOOPType.SWAPPED]: "Swapped",
  [LOOPType.INVERTED]: "Inverted",
  [LOOPType.SWAPPED_INVERTED]: "Swapped / Inverted",
  [LOOPType.MIRRORED_SWAPPED]: "Mirrored / Swapped",
  [LOOPType.ROTATED_INVERTED]: "Rotated / Inverted",
  [LOOPType.MIRRORED_INVERTED]: "Mirrored / Inverted",
  [LOOPType.ROTATED_SWAPPED]: "Rotated / Swapped",
  [LOOPType.MIRRORED_ROTATED]: "Mirrored / Rotated",
  [LOOPType.MIRRORED_INVERTED_ROTATED]: "Mir / Comp / Rot",
  [LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED]: "All Four",
  [LOOPType.STRICT_REWOUND]: "Rewound",
};

export const ROTATED_LOOP_TYPES = new Set<LOOPType>([
  LOOPType.ROTATED,
  LOOPType.ROTATED_INVERTED,
  LOOPType.ROTATED_SWAPPED,
  LOOPType.MIRRORED_ROTATED,
  LOOPType.MIRRORED_INVERTED_ROTATED,
  LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
]);
