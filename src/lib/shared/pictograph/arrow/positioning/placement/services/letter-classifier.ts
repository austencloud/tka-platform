/**
 * Letter Classifier
 *
 * Determines letter types and orientation characteristics for special placement logic.
 */

import type { PictographData } from "../../../../shared/domain/models/pictograph-data";

const HYBRID_LETTERS = [
  "C",
  "F",
  "I",
  "L",
  "O",
  "R",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "W-",
  "X-",
  "Y-",
  "Z-",
  "Σ",
  "Δ",
  "Θ",
  "Ω",
  "Σ-",
  "Δ-",
  "Θ-",
  "Ω-",
  "Φ",
  "Ψ",
  "Λ",
];

const IN = "in";
const OUT = "out";

/**
 * Check if letter is HYBRID (uses motion type keys for special placement)
 */
export function isHybridLetter(letter: string): boolean {
  return HYBRID_LETTERS.includes(letter);
}

/**
 * Check if pictograph starts from standard orientation (both motions same layer)
 */
export function startsFromStandardOrientation(pictographData: PictographData): boolean {
  try {
    const leftMotion = pictographData.motions.left;
    const rightMotion = pictographData.motions.right;

    if (!leftMotion || !rightMotion) {
      return true; // Default to standard
    }

    const leftStart = leftMotion.startOrientation || "";
    const rightStart = rightMotion.startOrientation || "";

    // Standard if both are layer1 (IN/OUT) or both are layer2 (CLOCK/COUNTER)
    const leftLayer1 = [IN, OUT].includes(leftStart);
    const rightLayer1 = [IN, OUT].includes(rightStart);

    return leftLayer1 === rightLayer1; // Same layer = standard orientation
  } catch {
    return true; // Default to standard
  }
}
