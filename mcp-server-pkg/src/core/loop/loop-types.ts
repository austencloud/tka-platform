/**
 * LOOP (Linked Orbital Offset Pattern) Type Definitions for MCP Server
 *
 * Ported from the main app's circular-models.ts.
 * LOOPs are TKA's algorithmic extension patterns that transform sequences.
 */

/**
 * LOOP Type Enum
 * Defines the different types of Linked Orbital Offset Patterns
 */
export enum LOOPType {
  /** Strict rotated - rotates positions around the grid */
  ROTATED = "rotated",

  /** Strict mirrored - mirrors positions vertically */
  MIRRORED = "mirrored",

  /** Strict swapped - swaps blue and red attributes */
  SWAPPED = "swapped",

  /** Strict inverted - uses inverted letters (opposite motion types) */
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

  /** Rewound - appends reversed sequence to double length */
  REWOUND = "rewound",
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
 * LOOP User-friendly labels
 * Maps LOOP types to display names for UI
 */
export const LOOP_TYPE_LABELS: Record<LOOPType, string> = {
  [LOOPType.ROTATED]: "Rotated",
  [LOOPType.MIRRORED]: "Mirrored",
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
  [LOOPType.REWOUND]: "Rewound",
};

/**
 * LOOP descriptions for each type
 */
export const LOOP_TYPE_DESCRIPTIONS: Record<LOOPType, string> = {
  [LOOPType.ROTATED]: "Rotates positions around the grid",
  [LOOPType.MIRRORED]: "Mirrors positions vertically",
  [LOOPType.SWAPPED]: "Swaps blue and red props",
  [LOOPType.INVERTED]: "Inverts motion directions",
  [LOOPType.SWAPPED_INVERTED]: "Swaps colors with inverted motion",
  [LOOPType.ROTATED_INVERTED]: "Rotates with inverted motion",
  [LOOPType.MIRRORED_SWAPPED]: "Mirrors with color swap",
  [LOOPType.MIRRORED_INVERTED]: "Mirrors with inverted motion",
  [LOOPType.ROTATED_SWAPPED]: "Rotates with color swap",
  [LOOPType.MIRRORED_ROTATED]: "Combines mirroring and rotation",
  [LOOPType.MIRRORED_INVERTED_ROTATED]: "Mirror, invert, and rotate",
  [LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED]: "All four transformations combined",
  [LOOPType.REWOUND]: "Appends reversed sequence to double length",
};

/**
 * LOOP option structure for validation results
 */
export interface LOOPOption {
  loopType: LOOPType;
  name: string;
  description: string;
}

/**
 * LOOP validation result
 */
export interface LOOPValidationResult {
  available: LOOPOption[];
  unavailable: Array<LOOPOption & { reason?: string }>;
}

/**
 * All supported LOOP types in display order
 */
export const ALL_LOOP_TYPES: LOOPType[] = [
  LOOPType.ROTATED,
  LOOPType.MIRRORED,
  LOOPType.SWAPPED,
  LOOPType.INVERTED,
  LOOPType.SWAPPED_INVERTED,
  LOOPType.ROTATED_INVERTED,
  LOOPType.MIRRORED_SWAPPED,
  LOOPType.MIRRORED_INVERTED,
  LOOPType.ROTATED_SWAPPED,
  LOOPType.MIRRORED_ROTATED,
  LOOPType.MIRRORED_INVERTED_ROTATED,
  LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
  LOOPType.REWOUND,
];

/**
 * Phase 1 supported LOOP types (for this initial implementation)
 */
export const SUPPORTED_LOOP_TYPES: LOOPType[] = [
  LOOPType.REWOUND,
  LOOPType.ROTATED,
];
