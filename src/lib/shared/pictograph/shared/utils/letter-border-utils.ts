/**
 * Letter Border Colors
 *
 * Clean utility for getting letter border colors based on the desktop app's
 * PictographBorderManager dual border system.
 */

import {
  getLetterType,
  type Letter,
} from "../../../foundation/domain/models/Letter";
import { LETTER_TYPE_COLORS } from "../domain/constants/pictograph-constants";

/**
 * Letter type border color mapping from desktop app
 * Format: [primary, secondary] for outer and inner borders
 */

/**
 * Get border colors for a letter
 */
export function getLetterBorderColors(letter: Letter | null | undefined) {
  if (!letter) return { primary: "#000000", secondary: "#000000" };

  const letterType = getLetterType(letter);
  const [primary, secondary] = LETTER_TYPE_COLORS[letterType] || [
    "#000000",
    "#000000",
  ];

  return { primary, secondary };
}

/**
 * Get primary border color for a letter
 */
export function getLetterBorderColor(
  letter: Letter | null | undefined
): string {
  return getLetterBorderColors(letter).primary;
}

// Legacy aliases for backward compatibility
export const getLetterBorderColorsSafe = getLetterBorderColors;
export const getLetterBorderColorSafe = getLetterBorderColor;
