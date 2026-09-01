/**
 * Reversal position calculator
 *
 * Calculates the positions of reversal indicator dots based on
 * which props have reversals (left, right, or both).
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
 * @param leftReversal - Whether left motion has a reversal
 * @param rightReversal - Whether right motion has a reversal
 * @param isDarkMode - Whether to use dark mode colors
 * @returns Object with array of dot positions (may be empty)
 */
export function calculateReversalPositions(
  leftReversal: boolean,
  rightReversal: boolean,
  isDarkMode: boolean
): ReversalPositions {
  if (!leftReversal && !rightReversal) {
    return { dots: [] };
  }

  const leftColor = isDarkMode ? BLUE_COLOR_DARK : BLUE_COLOR_LIGHT;
  const rightColor = isDarkMode ? RED_COLOR_DARK : RED_COLOR_LIGHT;

  const { X_POSITION, DOT_RADIUS, DOT_SPACING, CENTER_Y } = REVERSAL_INDICATOR;

  const dots: ReversalDotPosition[] = [];

  if (leftReversal && rightReversal) {
    // Both reversals: stack vertically
    // RED on top (center - spacing/2), BLUE on bottom (center + spacing/2)
    const rightY = CENTER_Y - DOT_SPACING / 2; // 475 - 29.25 = 445.75
    const leftY = CENTER_Y + DOT_SPACING / 2; // 475 + 29.25 = 504.25

    dots.push({
      cx: X_POSITION,
      cy: rightY,
      r: DOT_RADIUS,
      color: rightColor,
    });

    dots.push({
      cx: X_POSITION,
      cy: leftY,
      r: DOT_RADIUS,
      color: leftColor,
    });
  } else if (leftReversal) {
    // Only left reversal: centered
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: leftColor,
    });
  } else if (rightReversal) {
    // Only right reversal: centered
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: rightColor,
    });
  }

  return { dots };
}

/**
 * Useful when you need the colors but not the positions.
 */
export function getReversalColors(isDarkMode: boolean): {
  left: string;
  right: string;
} {
  return {
    left: isDarkMode ? BLUE_COLOR_DARK : BLUE_COLOR_LIGHT,
    right: isDarkMode ? RED_COLOR_DARK : RED_COLOR_LIGHT,
  };
}
