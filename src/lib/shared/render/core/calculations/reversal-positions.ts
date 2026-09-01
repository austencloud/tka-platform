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
    const rightY = CENTER_Y - DOT_SPACING / 2; 
    const leftY = CENTER_Y + DOT_SPACING / 2; 

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
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: leftColor,
    });
  } else if (rightReversal) {
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: rightColor,
    });
  }

  return { dots };
}

export function getReversalColors(isDarkMode: boolean): {
  left: string;
  right: string;
} {
  return {
    left: isDarkMode ? BLUE_COLOR_DARK : BLUE_COLOR_LIGHT,
    right: isDarkMode ? RED_COLOR_DARK : RED_COLOR_LIGHT,
  };
}
