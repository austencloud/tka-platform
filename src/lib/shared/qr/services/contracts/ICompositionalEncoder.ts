/**
 * Compositional Sequence Encoding Contracts
 *
 * Instead of encoding all 16 beats of a rotated LOOP,
 * encodes just the seed (4 beats) + a recipe tag.
 * The decoder reconstructs the full sequence using existing LOOP executors.
 *
 * Domain: QR - Compositional Encoding
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Compact tags for LOOP types in recipe encoding.
 * Keys must match the LOOPType enum values exactly (snake_case strings).
 */
export const LOOP_TYPE_TAGS: Record<string, string> = {
  strict_rotated: "sr",
  strict_mirrored: "sm",
  strict_flipped: "sf",
  strict_swapped: "ss",
  strict_inverted: "si",
  // Audit fix #2: the enum value is "strict_rewound", not "rewound"
  strict_rewound: "rw",
} as const;

/** Reverse lookup: tag -> loopType string */
export const TAG_TO_LOOP_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(LOOP_TYPE_TAGS).map(([k, v]) => [v, k])
);

/** Recipe prefix that signals compositional encoding (after the s~ inline prefix) */
export const RECIPE_PREFIX = "r:";

export interface ICompositionalEncoder {
  /**
   * Try to encode a sequence compositionally.
   * Returns the recipe string if the sequence qualifies, null if it doesn't.
   * Qualification: LOOP detected + round-trip verification passes.
   */
  tryEncode(
    flatEncoded: string,
    sequence: SequenceData
  ): Promise<string | null>;
}

export interface ICompositionalDecoder {
  /**
   * Decode a recipe-encoded string back to flat encoded format.
   * Verifies hash after reconstruction.
   * Throws if hash verification fails.
   */
  decode(recipeEncoded: string): Promise<string>;

  /** Check if a string uses recipe encoding. */
  isRecipeEncoded(encoded: string): boolean;
}
