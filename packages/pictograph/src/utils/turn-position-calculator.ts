/**
 * Turn Position Calculator
 *
 * Calculates X/Y positions for top and bottom turn numbers
 * based on letter dimensions.
 */

export interface Dimensions {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface TurnPositions {
  top: Position;
  bottom: Position;
}

const PADDING_X = 15;
const PADDING_Y = 5;

const DASH_WIDTH = 70;
const DASH_GAP = 10;

export function calculateTurnPositions(
  letterDimensions: Dimensions,
  bottomNumberHeight: number = 45,
  hasDash: boolean = false
): TurnPositions {
  const referenceWidth = hasDash
    ? letterDimensions.width + DASH_GAP + DASH_WIDTH
    : letterDimensions.width;
  const baseX = referenceWidth + PADDING_X;

  const topY = -PADDING_Y;
  const bottomY = letterDimensions.height - bottomNumberHeight + PADDING_Y;

  return {
    top: { x: baseX, y: topY },
    bottom: { x: baseX, y: bottomY },
  };
}
