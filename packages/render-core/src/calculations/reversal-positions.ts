/**
 * Reversal position calculator
 *
 * Calculates the positions of reversal indicator dots based on
 * which props have reversals (blue, red, or both).
 *
 * This is the SINGLE SOURCE OF TRUTH for reversal positioning.
 * Both Canvas2DDirectRenderer and MCP standalone-renderer use these values.
 */

import { REVERSAL_INDICATOR } from "../constants/glyph-positions.js";
import { BLUE_COLOR_DARK, BLUE_COLOR_LIGHT, RED_COLOR_DARK, RED_COLOR_LIGHT } from "../constants/viewbox.js";


export interface ReversalDotPosition {
  cx: number;
  cy: number;
  r: number;
  color: string;
}

export interface ReversalPositions {
  dots: ReversalDotPosition[];
}


/**
 * Calculate reversal indicator positions.
 *
 * Positioning rules (from ReversalIndicators.svelte):
 * - Single reversal: dot is centered vertically (at CENTER_Y)
 * - Both reversals: RED on top, BLUE on bottom, spaced by DOT_SPACING
 * - All dots are at X_POSITION (left edge)
 * @param blueReversal - Whether blue motion has a reversal
 * @param redReversal - Whether red motion has a reversal
 * @param isDarkMode - Whether to use dark mode colors
 * @returns Object with array of dot positions (may be empty)
 */
export function calculateReversalPositions(
  blueReversal: boolean,
  redReversal: boolean,
  isDarkMode: boolean
): ReversalPositions {
  if (!blueReversal && !redReversal) {
    return { dots: [] };
  }

  const blueColor = isDarkMode ? BLUE_COLOR_DARK : BLUE_COLOR_LIGHT;
  const redColor = isDarkMode ? RED_COLOR_DARK : RED_COLOR_LIGHT;

  const { X_POSITION, DOT_RADIUS, DOT_SPACING, CENTER_Y } = REVERSAL_INDICATOR;

  const dots: ReversalDotPosition[] = [];

  if (blueReversal && redReversal) {
    // Both reversals: stack vertically
    // RED on top (center - spacing/2), BLUE on bottom (center + spacing/2)
    const redY = CENTER_Y - DOT_SPACING / 2; // 475 - 29.25 = 445.75
    const blueY = CENTER_Y + DOT_SPACING / 2; // 475 + 29.25 = 504.25

    dots.push({
      cx: X_POSITION,
      cy: redY,
      r: DOT_RADIUS,
      color: redColor,
    });

    dots.push({
      cx: X_POSITION,
      cy: blueY,
      r: DOT_RADIUS,
      color: blueColor,
    });
  } else if (blueReversal) {
    // Only blue reversal: centered
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: blueColor,
    });
  } else if (redReversal) {
    // Only red reversal: centered
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: redColor,
    });
  }

  return { dots };
}

/**
 * Useful when you need the colors but not the positions.
 */
export function getReversalColors(isDarkMode: boolean): {
  blue: string;
  red: string;
} {
  return {
    blue: isDarkMode ? BLUE_COLOR_DARK : BLUE_COLOR_LIGHT,
    red: isDarkMode ? RED_COLOR_DARK : RED_COLOR_LIGHT,
  };
}
