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
    const redY = CENTER_Y - DOT_SPACING / 2; 
    const blueY = CENTER_Y + DOT_SPACING / 2; 

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
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: blueColor,
    });
  } else if (redReversal) {
    dots.push({
      cx: X_POSITION,
      cy: CENTER_Y,
      r: DOT_RADIUS,
      color: redColor,
    });
  }

  return { dots };
}

export function getReversalColors(isDarkMode: boolean): {
  blue: string;
  red: string;
} {
  return {
    blue: isDarkMode ? BLUE_COLOR_DARK : BLUE_COLOR_LIGHT,
    red: isDarkMode ? RED_COLOR_DARK : RED_COLOR_LIGHT,
  };
}
