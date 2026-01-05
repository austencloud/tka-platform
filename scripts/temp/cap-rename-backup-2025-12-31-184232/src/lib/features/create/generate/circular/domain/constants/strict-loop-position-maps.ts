/**
 * Position and Location Maps for Strict LOOP Variations
 *
 * These maps define transformations for:
 * - STRICT_MIRRORED: Vertical mirroring of positions and locations
 * - STRICT_SWAPPED: Color swapping position transformations
 * - STRICT_INVERTED: Letter complementarity mappings
 *
 * Note: STRICT_ROTATED uses different maps defined in circular-position-maps.ts
 */

import {
  GridPosition,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Vertical Mirror Position Map
 * Mirrors positions vertically across the center horizontal axis
 * Used by STRICT_MIRRORED LOOP type
 *
 * Examples:
 * - ALPHA2 (SW-NE) ↔ ALPHA8 (SE-NW) - diagonals flip
 * - ALPHA3 (W-E) ↔ ALPHA7 (E-W) - horizontals swap
 * - ALPHA1 (S-N) → ALPHA1 - vertical stays same
 * - GAMMA1 (W-N) ↔ GAMMA9 (E-N) - gammas cross-mirror
 */
export const VERTICAL_MIRROR_POSITION_MAP: Record<GridPosition, GridPosition> =
  {
    // Alpha group - vertical axis symmetry
    [GridPosition.ALPHA1]: GridPosition.ALPHA1, // S-N → S-N (on axis)
    [GridPosition.ALPHA2]: GridPosition.ALPHA8, // SW-NE → SE-NW
    [GridPosition.ALPHA3]: GridPosition.ALPHA7, // W-E → E-W
    [GridPosition.ALPHA4]: GridPosition.ALPHA6, // NW-SE → NE-SW
    [GridPosition.ALPHA5]: GridPosition.ALPHA5, // N-S → N-S (on axis)
    [GridPosition.ALPHA6]: GridPosition.ALPHA4, // NE-SW → NW-SE
    [GridPosition.ALPHA7]: GridPosition.ALPHA3, // E-W → W-E
    [GridPosition.ALPHA8]: GridPosition.ALPHA2, // SE-NW → SW-NE

    // Beta group - same sides stay same
    [GridPosition.BETA1]: GridPosition.BETA1, // N-N → N-N (on axis)
    [GridPosition.BETA2]: GridPosition.BETA8, // NE-NE → NW-NW
    [GridPosition.BETA3]: GridPosition.BETA7, // E-E → W-W
    [GridPosition.BETA4]: GridPosition.BETA6, // SE-SE → SW-SW
    [GridPosition.BETA5]: GridPosition.BETA5, // S-S → S-S (on axis)
    [GridPosition.BETA6]: GridPosition.BETA4, // SW-SW → SE-SE
    [GridPosition.BETA7]: GridPosition.BETA3, // W-W → E-E
    [GridPosition.BETA8]: GridPosition.BETA2, // NW-NW → NE-NE

    // Gamma group - cross-mirror pattern
    [GridPosition.GAMMA1]: GridPosition.GAMMA9, // W-N ↔ E-N
    [GridPosition.GAMMA2]: GridPosition.GAMMA16, // NW-NE ↔ NE-NW
    [GridPosition.GAMMA3]: GridPosition.GAMMA15, // N-E ↔ N-W
    [GridPosition.GAMMA4]: GridPosition.GAMMA14, // NE-SE ↔ NW-SW
    [GridPosition.GAMMA5]: GridPosition.GAMMA13, // E-S ↔ W-S
    [GridPosition.GAMMA6]: GridPosition.GAMMA12, // SE-SW ↔ SW-SE
    [GridPosition.GAMMA7]: GridPosition.GAMMA11, // S-W ↔ S-E
    [GridPosition.GAMMA8]: GridPosition.GAMMA10, // SW-NW ↔ SE-NE
    [GridPosition.GAMMA9]: GridPosition.GAMMA1, // E-N ↔ W-N
    [GridPosition.GAMMA10]: GridPosition.GAMMA8, // SE-NE ↔ SW-NW
    [GridPosition.GAMMA11]: GridPosition.GAMMA7, // S-E ↔ S-W
    [GridPosition.GAMMA12]: GridPosition.GAMMA6, // SW-SE ↔ SE-SW
    [GridPosition.GAMMA13]: GridPosition.GAMMA5, // W-S ↔ E-S
    [GridPosition.GAMMA14]: GridPosition.GAMMA4, // NW-SW ↔ NE-SE
    [GridPosition.GAMMA15]: GridPosition.GAMMA3, // N-W ↔ N-E
    [GridPosition.GAMMA16]: GridPosition.GAMMA2, // NE-NW ↔ NW-NE
  };

/**
 * Vertical Mirror Location Map
 * Mirrors hand locations vertically (flips east/west)
 * Used by STRICT_MIRRORED for transforming motion end locations
 *
 * Examples:
 * - E (east) ↔ W (west)
 * - NE (northeast) ↔ NW (northwest)
 * - N (north) → N (stays on vertical axis)
 * - S (south) → S (stays on vertical axis)
 */
export const VERTICAL_MIRROR_LOCATION_MAP: Record<GridLocation, GridLocation> =
  {
    [GridLocation.NORTH]: GridLocation.NORTH, // On axis - no change
    [GridLocation.SOUTH]: GridLocation.SOUTH, // On axis - no change
    [GridLocation.EAST]: GridLocation.WEST, // Flip east/west
    [GridLocation.WEST]: GridLocation.EAST, // Flip west/east
    [GridLocation.NORTHEAST]: GridLocation.NORTHWEST, // Flip NE/NW
    [GridLocation.NORTHWEST]: GridLocation.NORTHEAST, // Flip NW/NE
    [GridLocation.SOUTHEAST]: GridLocation.SOUTHWEST, // Flip SE/SW
    [GridLocation.SOUTHWEST]: GridLocation.SOUTHEAST, // Flip SW/SE
  };

/**
 * Horizontal Mirror Position Map
 * Mirrors positions horizontally (flips north/south)
 * Used for the Flip transform
 *
 * Examples:
 * - ALPHA1 (S-N) ↔ ALPHA5 (N-S) - verticals flip
 * - ALPHA3 (W-E) → ALPHA3 (W-E) - horizontals stay same
 * - GAMMA1 (W-N) ↔ GAMMA13 (W-S) - north becomes south
 */
export const HORIZONTAL_MIRROR_POSITION_MAP: Record<
  GridPosition,
  GridPosition
> = {
  // Alpha group - horizontal axis symmetry
  [GridPosition.ALPHA1]: GridPosition.ALPHA5, // S-N ↔ N-S
  [GridPosition.ALPHA2]: GridPosition.ALPHA4, // SW-NE ↔ NW-SE
  [GridPosition.ALPHA3]: GridPosition.ALPHA3, // W-E → W-E (on axis)
  [GridPosition.ALPHA4]: GridPosition.ALPHA2, // NW-SE ↔ SW-NE
  [GridPosition.ALPHA5]: GridPosition.ALPHA1, // N-S ↔ S-N
  [GridPosition.ALPHA6]: GridPosition.ALPHA8, // NE-SW ↔ SE-NW
  [GridPosition.ALPHA7]: GridPosition.ALPHA7, // E-W → E-W (on axis)
  [GridPosition.ALPHA8]: GridPosition.ALPHA6, // SE-NW ↔ NE-SW

  // Beta group - north/south pairs swap
  [GridPosition.BETA1]: GridPosition.BETA5, // N-N ↔ S-S
  [GridPosition.BETA2]: GridPosition.BETA4, // NE-NE ↔ SE-SE
  [GridPosition.BETA3]: GridPosition.BETA3, // E-E → E-E (on axis)
  [GridPosition.BETA4]: GridPosition.BETA2, // SE-SE ↔ NE-NE
  [GridPosition.BETA5]: GridPosition.BETA1, // S-S ↔ N-N
  [GridPosition.BETA6]: GridPosition.BETA8, // SW-SW ↔ NW-NW
  [GridPosition.BETA7]: GridPosition.BETA7, // W-W → W-W (on axis)
  [GridPosition.BETA8]: GridPosition.BETA6, // NW-NW ↔ SW-SW

  // Gamma group - north/south flip pattern
  [GridPosition.GAMMA1]: GridPosition.GAMMA13, // W-N ↔ W-S
  [GridPosition.GAMMA2]: GridPosition.GAMMA12, // NW-NE ↔ SW-SE
  [GridPosition.GAMMA3]: GridPosition.GAMMA11, // N-E ↔ S-E
  [GridPosition.GAMMA4]: GridPosition.GAMMA10, // NE-SE ↔ SE-NE
  [GridPosition.GAMMA5]: GridPosition.GAMMA9, // E-S ↔ E-N
  [GridPosition.GAMMA6]: GridPosition.GAMMA16, // SE-SW ↔ NE-NW
  [GridPosition.GAMMA7]: GridPosition.GAMMA15, // S-W ↔ N-W
  [GridPosition.GAMMA8]: GridPosition.GAMMA14, // SW-NW ↔ NW-SW
  [GridPosition.GAMMA9]: GridPosition.GAMMA5, // E-N ↔ E-S
  [GridPosition.GAMMA10]: GridPosition.GAMMA4, // SE-NE ↔ NE-SE
  [GridPosition.GAMMA11]: GridPosition.GAMMA3, // S-E ↔ N-E
  [GridPosition.GAMMA12]: GridPosition.GAMMA2, // SW-SE ↔ NW-NE
  [GridPosition.GAMMA13]: GridPosition.GAMMA1, // W-S ↔ W-N
  [GridPosition.GAMMA14]: GridPosition.GAMMA8, // NW-SW ↔ SW-NW
  [GridPosition.GAMMA15]: GridPosition.GAMMA7, // N-W ↔ S-W
  [GridPosition.GAMMA16]: GridPosition.GAMMA6, // NE-NW ↔ SE-SW
};

/**
 * Horizontal Mirror Location Map
 * Mirrors hand locations horizontally (flips north/south)
 * Used for the Flip transform
 *
 * Examples:
 * - N (north) ↔ S (south)
 * - NE (northeast) ↔ SE (southeast)
 * - E (east) → E (stays on horizontal axis)
 * - W (west) → W (stays on horizontal axis)
 */
export const HORIZONTAL_MIRROR_LOCATION_MAP: Record<
  GridLocation,
  GridLocation
> = {
  [GridLocation.NORTH]: GridLocation.SOUTH, // Flip north/south
  [GridLocation.SOUTH]: GridLocation.NORTH, // Flip south/north
  [GridLocation.EAST]: GridLocation.EAST, // On axis - no change
  [GridLocation.WEST]: GridLocation.WEST, // On axis - no change
  [GridLocation.NORTHEAST]: GridLocation.SOUTHEAST, // Flip NE/SE
  [GridLocation.SOUTHEAST]: GridLocation.NORTHEAST, // Flip SE/NE
  [GridLocation.NORTHWEST]: GridLocation.SOUTHWEST, // Flip NW/SW
  [GridLocation.SOUTHWEST]: GridLocation.NORTHWEST, // Flip SW/NW
};

/**
 * Swapped Position Map
 * Maps positions to their color-swapped equivalents
 * Used by STRICT_SWAPPED LOOP type
 *
 * Pattern:
 * - Alpha: 180° rotation (cross-pattern)
 * - Beta: No change (same positions stay same)
 * - Gamma: Complex cross-swap pattern
 */
export const SWAPPED_POSITION_MAP: Record<GridPosition, GridPosition> = {
  // Alpha group - 180° swap pattern
  [GridPosition.ALPHA1]: GridPosition.ALPHA5, // S-N ↔ N-S
  [GridPosition.ALPHA2]: GridPosition.ALPHA6, // SW-NE ↔ NE-SW
  [GridPosition.ALPHA3]: GridPosition.ALPHA7, // W-E ↔ E-W
  [GridPosition.ALPHA4]: GridPosition.ALPHA8, // NW-SE ↔ SE-NW
  [GridPosition.ALPHA5]: GridPosition.ALPHA1, // N-S ↔ S-N
  [GridPosition.ALPHA6]: GridPosition.ALPHA2, // NE-SW ↔ SW-NE
  [GridPosition.ALPHA7]: GridPosition.ALPHA3, // E-W ↔ W-E
  [GridPosition.ALPHA8]: GridPosition.ALPHA4, // SE-NW ↔ NW-SE

  // Beta group - no change (both hands same location)
  [GridPosition.BETA1]: GridPosition.BETA1, // N-N → N-N
  [GridPosition.BETA2]: GridPosition.BETA2, // NE-NE → NE-NE
  [GridPosition.BETA3]: GridPosition.BETA3, // E-E → E-E
  [GridPosition.BETA4]: GridPosition.BETA4, // SE-SE → SE-SE
  [GridPosition.BETA5]: GridPosition.BETA5, // S-S → S-S
  [GridPosition.BETA6]: GridPosition.BETA6, // SW-SW → SW-SW
  [GridPosition.BETA7]: GridPosition.BETA7, // W-W → W-W
  [GridPosition.BETA8]: GridPosition.BETA8, // NW-NW → NW-NW

  // Gamma group - cross-swap pattern
  [GridPosition.GAMMA1]: GridPosition.GAMMA15, // W-N ↔ N-W
  [GridPosition.GAMMA2]: GridPosition.GAMMA16, // NW-NE ↔ NE-NW
  [GridPosition.GAMMA3]: GridPosition.GAMMA9, // N-E ↔ E-N
  [GridPosition.GAMMA4]: GridPosition.GAMMA10, // NE-SE ↔ SE-NE
  [GridPosition.GAMMA5]: GridPosition.GAMMA11, // E-S ↔ S-E
  [GridPosition.GAMMA6]: GridPosition.GAMMA12, // SE-SW ↔ SW-SE
  [GridPosition.GAMMA7]: GridPosition.GAMMA13, // S-W ↔ W-S
  [GridPosition.GAMMA8]: GridPosition.GAMMA14, // SW-NW ↔ NW-SW
  [GridPosition.GAMMA9]: GridPosition.GAMMA3, // E-N ↔ N-E
  [GridPosition.GAMMA10]: GridPosition.GAMMA4, // SE-NE ↔ NE-SE
  [GridPosition.GAMMA11]: GridPosition.GAMMA5, // S-E ↔ E-S
  [GridPosition.GAMMA12]: GridPosition.GAMMA6, // SW-SE ↔ SE-SW
  [GridPosition.GAMMA13]: GridPosition.GAMMA7, // W-S ↔ S-W
  [GridPosition.GAMMA14]: GridPosition.GAMMA8, // NW-SW ↔ SW-NW
  [GridPosition.GAMMA15]: GridPosition.GAMMA1, // N-W ↔ W-N
  [GridPosition.GAMMA16]: GridPosition.GAMMA2, // NE-NW ↔ NW-NE
};

/**
 * Inverted Letter Map
 * Maps letters to their inverted pairs (opposite motion types)
 * Used by STRICT_INVERTED LOOP type
 *
 * Pattern:
 * - Most letters pair with adjacent letter (A↔B, D↔E, etc.)
 * - Some letters are self-inverted (C, F, I, etc.)
 * - Greek letters follow similar pairing rules
 */
export const INVERTED_LETTER_MAP: Record<string, string> = {
  // Basic alphabet pairs
  A: "B",
  B: "A",
  C: "C", // Self-inverted
  D: "E",
  E: "D",
  F: "F", // Self-inverted
  G: "H",
  H: "G",
  I: "I", // Self-inverted
  J: "K",
  K: "J",
  L: "L", // Self-inverted
  M: "N",
  N: "M",
  O: "O", // Self-inverted
  P: "Q",
  Q: "P",
  R: "R", // Self-inverted
  S: "T",
  T: "S",
  U: "V",
  V: "U",
  W: "X",
  X: "W",
  Y: "Z",
  Z: "Y",

  // Greek letters
  Σ: "Δ",
  Δ: "Σ",
  θ: "Ω",
  Ω: "θ",
  Φ: "Φ", // Self-inverted
  Ψ: "Ψ", // Self-inverted
  Λ: "Λ", // Self-inverted
  α: "α", // Self-inverted
  β: "β", // Self-inverted
  γ: "γ", // Self-inverted

  // Dash variations
  "W-": "X-",
  "X-": "W-",
  "Y-": "Z-",
  "Z-": "Y-",
  "Σ-": "Δ-",
  "Δ-": "Σ-",
  "θ-": "Ω-",
  "Ω-": "θ-",
  "Φ-": "Φ-", // Self-inverted
  "Ψ-": "Ψ-", // Self-inverted
  "Λ-": "Λ-", // Self-inverted
};

/**
 * Get inverted letter for a given letter
 * @throws Error if letter not found in map
 */
export function getInvertedLetter(letter: string): string {
  const inverted = INVERTED_LETTER_MAP[letter];

  if (!inverted) {
    throw new Error(`No inverted letter mapping found for letter: ${letter}`);
  }

  return inverted;
}

/**
 * Alpha-Beta Counterpart Letter Map
 * Maps letters that share a common gamma endpoint but differ in the other section (α↔β).
 * Also called "Cross-Section Complementary" relationships.
 *
 * Pattern:
 * - Letters ending at gamma from different origins: Σ↔θ (α→γ ↔ β→γ), Δ↔Ω (α→γ ↔ β→γ)
 * - Letters starting from gamma to different destinations: W↔Y (γ→α ↔ γ→β), X↔Z (γ→α ↔ γ→β)
 *
 * This differs from standard inversion (pro↔anti) - these pairs share the same rotation
 * but swap their alpha/beta relationship while both involving gamma.
 */
export const ALPHA_BETA_COUNTERPART_LETTER_MAP: Record<string, string> = {
  // Type 2 Shift letters sharing gamma endpoint
  // Origin swap (both end at gamma, start from α vs β)
  Σ: "θ", // α→γ ↔ β→γ
  θ: "Σ", // β→γ ↔ α→γ
  Δ: "Ω", // α→γ ↔ β→γ (anti versions)
  Ω: "Δ", // β→γ ↔ α→γ

  // Destination swap (both start at gamma, end at α vs β)
  W: "Y", // γ→α ↔ γ→β
  Y: "W", // γ→β ↔ γ→α
  X: "Z", // γ→α ↔ γ→β (anti versions)
  Z: "X", // γ→β ↔ γ→α

  // Type 3 Cross-Shift dash variants follow same pattern
  "Σ-": "θ-",
  "θ-": "Σ-",
  "Δ-": "Ω-",
  "Ω-": "Δ-",
  "W-": "Y-",
  "Y-": "W-",
  "X-": "Z-",
  "Z-": "X-",
};

/**
 * Compound Letter Map
 * Maps letters that form compound pairs - letters that combine to create circular motion.
 * These pairs complete each other to return to starting position.
 *
 * Two categories:
 * 1. Alpha↔Beta transitions (opposite section directions)
 * 2. Gamma internal pairs (γ→γ with complementary quarter-opp motions)
 */
export const COMPOUND_LETTER_MAP: Record<string, string> = {
  // Type 1 Dual-Shift compound pairs (β↔α transitions)
  D: "J", // β→α (Tog-Opp, isolation) ↔ α→β (Split-Opp, isolation) - "Disco Jam"
  J: "D",
  E: "K", // β→α (Tog-Opp, antispin) ↔ α→β (Split-Opp, antispin) - "Exploding Kitten"
  K: "E",
  F: "L", // β→α (Tog-Opp, hybrid) ↔ α→β (Split-Opp, hybrid) - "Fruity Loops"
  L: "F",

  // Gamma internal compound pairs (γ→γ Quarter-Opp complementary motions)
  M: "P", // γ→γ isolation ↔ γ→γ isolation - "Magic Potion"
  P: "M",
  N: "Q", // γ→γ antispin ↔ γ→γ antispin - "Never Quit"
  Q: "N",
  O: "R", // γ→γ hybrid ↔ γ→γ hybrid - "Open Road"
  R: "O",

  // Type 4 Dash compound pairs (β↔α transitions via dash)
  Φ: "Ψ", // β→α (Dash) ↔ α→β (Dash)
  Ψ: "Φ",
};

/**
 * Letter Transformation Types
 * Used for algorithmic detection and generation
 */
export enum LetterTransformationType {
  INVERSION = "inversion", // Pro ↔ Anti (A↔B, Σ↔Δ)
  COMPOUND = "compound", // Section transition pairs (D↔J, M↔P)
  ALPHA_BETA_COUNTERPART = "alpha_beta_counterpart", // Gamma endpoint sharing (Σ↔θ, W↔Y)
}

/**
 * Get alpha-beta counterpart letter for a given letter
 * Returns the letter that shares the same gamma endpoint but swaps α↔β
 */
export function getAlphaBetaCounterpart(letter: string): string | null {
  return ALPHA_BETA_COUNTERPART_LETTER_MAP[letter] ?? null;
}

/**
 * Get compound pair letter for a given letter
 * Returns the letter that forms a compound pair (α↔β transition pair or γ internal pair)
 */
export function getCompoundLetter(letter: string): string | null {
  return COMPOUND_LETTER_MAP[letter] ?? null;
}

/**
 * Check if two letters have a specific transformation relationship
 */
export function hasTransformationRelationship(
  letter1: string,
  letter2: string,
  type: LetterTransformationType
): boolean {
  switch (type) {
    case LetterTransformationType.INVERSION:
      return INVERTED_LETTER_MAP[letter1] === letter2;
    case LetterTransformationType.COMPOUND:
      return COMPOUND_LETTER_MAP[letter1] === letter2;
    case LetterTransformationType.ALPHA_BETA_COUNTERPART:
      return ALPHA_BETA_COUNTERPART_LETTER_MAP[letter1] === letter2;
    default:
      return false;
  }
}

/**
 * Get all transformation relationships between two letters
 * Returns array of transformation types that apply to this letter pair
 */
export function getLetterRelationships(
  letter1: string,
  letter2: string
): LetterTransformationType[] {
  const relationships: LetterTransformationType[] = [];

  if (INVERTED_LETTER_MAP[letter1] === letter2) {
    relationships.push(LetterTransformationType.INVERSION);
  }
  if (COMPOUND_LETTER_MAP[letter1] === letter2) {
    relationships.push(LetterTransformationType.COMPOUND);
  }
  if (ALPHA_BETA_COUNTERPART_LETTER_MAP[letter1] === letter2) {
    relationships.push(LetterTransformationType.ALPHA_BETA_COUNTERPART);
  }

  return relationships;
}

/**
 * Get all letters that have a specific transformation relationship with the given letter
 */
export function getRelatedLetters(
  letter: string,
  type: LetterTransformationType
): string | null {
  switch (type) {
    case LetterTransformationType.INVERSION:
      return INVERTED_LETTER_MAP[letter] ?? null;
    case LetterTransformationType.COMPOUND:
      return COMPOUND_LETTER_MAP[letter] ?? null;
    case LetterTransformationType.ALPHA_BETA_COUNTERPART:
      return ALPHA_BETA_COUNTERPART_LETTER_MAP[letter] ?? null;
    default:
      return null;
  }
}

/**
 * Analyze beat pair letters and return their transformation relationships
 * Useful for polyrhythmic LOOP analysis
 */
export function analyzeBeatPairTransformation(
  letter1: string,
  letter2: string
): {
  relationships: LetterTransformationType[];
  isInverted: boolean;
  isCompound: boolean;
  isAlphaBetaCounterpart: boolean;
} {
  const relationships = getLetterRelationships(letter1, letter2);
  return {
    relationships,
    isInverted: relationships.includes(LetterTransformationType.INVERSION),
    isCompound: relationships.includes(LetterTransformationType.COMPOUND),
    isAlphaBetaCounterpart: relationships.includes(
      LetterTransformationType.ALPHA_BETA_COUNTERPART
    ),
  };
}

/**
 * Validation Sets for Strict LOOP Types
 * These define which (start_position, end_position) pairs are valid for each LOOP type
 */

/**
 * Mirrored LOOP validation set
 * Valid when: vertical_mirror(start_pos) === end_pos
 */
export const MIRRORED_LOOP_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(
    ([start, end]) => `${start},${end}`
  )
);

/**
 * Swapped LOOP validation set
 * Valid when: swapped(start_pos) === end_pos
 */
export const SWAPPED_LOOP_VALIDATION_SET = new Set<string>(
  Object.entries(SWAPPED_POSITION_MAP).map(([start, end]) => `${start},${end}`)
);

/**
 * Mirrored-Swapped LOOP validation set
 * Valid when: swapped(vertical_mirror(start_pos)) === end_pos
 * The end position must reflect BOTH transformations:
 * 1. First mirror (east↔west)
 * 2. Then swap (blue↔red positions)
 */
export const MIRRORED_SWAPPED_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(([start, mirroredEnd]) => {
    // Compose: first mirror, then swap
    const swappedMirroredEnd =
      SWAPPED_POSITION_MAP[mirroredEnd as GridPosition];
    return `${start},${swappedMirroredEnd}`;
  })
);

/**
 * Inverted LOOP validation set
 * Valid when: start_pos === end_pos (returns to starting position)
 */
export const INVERTED_LOOP_VALIDATION_SET = new Set<string>(
  Object.values(GridPosition).map((pos) => `${pos},${pos}`)
);

/**
 * Mirrored-Inverted LOOP validation set
 * Valid when: vertical_mirror(start_pos) === end_pos (same as mirrored)
 * The inverted transformation happens with motion types and letters, but position requirement is same as mirrored
 */
export const MIRRORED_INVERTED_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(
    ([start, end]) => `${start},${end}`
  )
);

/**
 * Import rotation maps for composed validation sets
 */
import {
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
  HALF_POSITION_MAP,
} from "./circular-position-maps";

/**
 * Rotated-Swapped LOOP validation set (Quartered - 90° rotations)
 * Valid when: end_pos === SWAPPED(ROTATED(start_pos))
 * The end position must reflect BOTH transformations:
 * 1. First rotate 90° (CW or CCW)
 * 2. Then swap (blue↔red positions)
 *
 * Example: gamma11 (Red@E, Blue@S)
 * - Pure rotation 90° CW → gamma13 (Red@S, Blue@W)
 * - Rotated + Swapped → gamma7 (Red@W, Blue@S) - the swap of gamma13
 */
export const ROTATED_SWAPPED_QUARTERED_VALIDATION_SET = new Set<string>([
  // Clockwise rotation then swap
  ...Object.entries(QUARTER_POSITION_MAP_CW).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd as GridPosition];
    return `${start},${swappedRotatedEnd}`;
  }),
  // Counter-clockwise rotation then swap
  ...Object.entries(QUARTER_POSITION_MAP_CCW).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd as GridPosition];
    return `${start},${swappedRotatedEnd}`;
  }),
]);

/**
 * Rotated-Swapped LOOP validation set (Halved - 180° rotations)
 * Valid when: end_pos === SWAPPED(ROTATED_180(start_pos))
 */
export const ROTATED_SWAPPED_HALVED_VALIDATION_SET = new Set<string>(
  Object.entries(HALF_POSITION_MAP).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd as GridPosition];
    return `${start},${swappedRotatedEnd}`;
  })
);
