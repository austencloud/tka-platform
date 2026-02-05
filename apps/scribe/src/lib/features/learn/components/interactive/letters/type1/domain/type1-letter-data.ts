/**
 * Type 1 Letter Data - Domain constants for Type 1 (Dual-Shift) letters
 * Based on letter-mappings.json and Level 1 PDF
 *
 * Type 1 letters are characterized by BOTH hands moving from one position to another.
 * Organized by motion pattern: Pro-Pro, Anti-Anti, and Hybrid
 */

import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Type1LetterData } from "../Type1LetterData";

/**
 * Prospin (Pro-Pro) Letters: A, D, G, J, M, P, S
 * Both hands spin in the same direction as their motion path
 */
export const PROSPIN_LETTERS: Type1LetterData[] = [
  {
    letter: Letter.A,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.ALPHA,
    endPositionGroup: GridPositionGroup.ALPHA,
    description: "Alpha to Alpha, both hands prospin",
  },
  {
    letter: Letter.D,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.BETA,
    endPositionGroup: GridPositionGroup.ALPHA,
    description: "Beta to Alpha, both hands prospin",
  },
  {
    letter: Letter.G,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.BETA,
    endPositionGroup: GridPositionGroup.BETA,
    description: "Beta to Beta, both hands prospin",
  },
  {
    letter: Letter.J,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.ALPHA,
    endPositionGroup: GridPositionGroup.BETA,
    description: "Alpha to Beta, both hands prospin",
  },
  {
    letter: Letter.M,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, both hands prospin",
  },
  {
    letter: Letter.P,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, both hands prospin",
  },
  {
    letter: Letter.S,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, both hands prospin",
  },
];

/**
 * Antispin (Anti-Anti) Letters: B, E, H, K, N, Q, T
 * Both hands spin opposite to their motion path
 */
export const ANTISPIN_LETTERS: Type1LetterData[] = [
  {
    letter: Letter.B,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.ALPHA,
    endPositionGroup: GridPositionGroup.ALPHA,
    description: "Alpha to Alpha, both hands antispin",
  },
  {
    letter: Letter.E,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.BETA,
    endPositionGroup: GridPositionGroup.ALPHA,
    description: "Beta to Alpha, both hands antispin",
  },
  {
    letter: Letter.H,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.BETA,
    endPositionGroup: GridPositionGroup.BETA,
    description: "Beta to Beta, both hands antispin",
  },
  {
    letter: Letter.K,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.ALPHA,
    endPositionGroup: GridPositionGroup.BETA,
    description: "Alpha to Beta, both hands antispin",
  },
  {
    letter: Letter.N,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, both hands antispin",
  },
  {
    letter: Letter.Q,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, both hands antispin",
  },
  {
    letter: Letter.T,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, both hands antispin",
  },
];

/**
 * Hybrid Letters: C, F, I, L, O, R, U, V
 * Hands spin in different directions (one prospin, one antispin)
 * Most hybrids: blue antispin + red prospin
 * V is the exception: blue prospin + red antispin (reverse hybrid)
 */
export const HYBRID_LETTERS: Type1LetterData[] = [
  {
    letter: Letter.C,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.ALPHA,
    endPositionGroup: GridPositionGroup.ALPHA,
    description: "Alpha to Alpha, blue antispin, red prospin",
  },
  {
    letter: Letter.F,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.BETA,
    endPositionGroup: GridPositionGroup.ALPHA,
    description: "Beta to Alpha, blue antispin, red prospin",
  },
  {
    letter: Letter.I,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.BETA,
    endPositionGroup: GridPositionGroup.BETA,
    description: "Beta to Beta, blue antispin, red prospin",
  },
  {
    letter: Letter.L,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.ALPHA,
    endPositionGroup: GridPositionGroup.BETA,
    description: "Alpha to Beta, blue antispin, red prospin",
  },
  {
    letter: Letter.O,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, blue antispin, red prospin",
  },
  {
    letter: Letter.R,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, blue antispin, red prospin",
  },
  {
    letter: Letter.U,
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.PRO,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, blue antispin, red prospin",
  },
  {
    letter: Letter.V,
    blueMotion: MotionType.PRO,
    redMotion: MotionType.ANTI,
    startPositionGroup: GridPositionGroup.GAMMA,
    endPositionGroup: GridPositionGroup.GAMMA,
    description: "Gamma to Gamma, blue prospin, red antispin (reverse hybrid)",
  },
];

/**
 * All Type 1 letters combined (A-V)
 * Total: 22 letters
 */
export const ALL_TYPE1_LETTERS: Type1LetterData[] = [
  ...PROSPIN_LETTERS,
  ...ANTISPIN_LETTERS,
  ...HYBRID_LETTERS,
];

/**
 * Type 1 alphabet string for display purposes
 */
export const TYPE1_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUV";

/**
 * Motion pattern categories for Type 1 letters
 */
export type MotionPattern = "pro-pro" | "anti-anti" | "hybrid";

/**
 * Get letters by their motion pattern category
 */
export function getLettersByMotionPattern(
  pattern: MotionPattern
): Type1LetterData[] {
  switch (pattern) {
    case "pro-pro":
      return PROSPIN_LETTERS;
    case "anti-anti":
      return ANTISPIN_LETTERS;
    case "hybrid":
      return HYBRID_LETTERS;
  }
}

/**
 * Get the motion pattern for a given letter
 */
export function getMotionPatternForLetter(
  letter: Letter
): MotionPattern | null {
  if (PROSPIN_LETTERS.some((l) => l.letter === letter)) return "pro-pro";
  if (ANTISPIN_LETTERS.some((l) => l.letter === letter)) return "anti-anti";
  if (HYBRID_LETTERS.some((l) => l.letter === letter)) return "hybrid";
  return null;
}
