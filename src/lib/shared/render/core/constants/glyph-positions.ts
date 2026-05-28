export const TKA_GLYPH = {
  X: 50,
  Y: 800,
  SCALE: 1.0,
} as const;

export const STEP_NUMBER = {
  X: 50,
  Y: 50,
  FONT_SIZE: 100,
  START_FONT_SIZE: 80, 
} as const;

export const DIRECTION_DOT = {
  PADDING: 10,
  SIZE: 25,
} as const;

export const TURN_NUMBER = {
  HEIGHT: 45,
  PADDING_X: 15,
  PADDING_Y: 5,
  WIDTHS: {
    "0.5": 80,
    "1": 30,
    "1.5": 80,
    "2": 30,
    "2.5": 83.67,
    "3": 30,
    "fl": 42.4,
  } as Record<string, number>,
} as const;

export const DASH_SUFFIX = {
  WIDTH: 70,
  HEIGHT: 20,
  GAP: 10,
  RADIUS: 9.5,
  FILL_DARK: "#ffffff",
  FILL_LIGHT: "#231f20",
} as const;

export const TND_GLYPH = {
  WIDTH: 201.24,
  HEIGHT: 133.6,
  OFFSET_PERCENTAGE: 0.04,
} as const;

export const ELEMENTAL_GLYPH = {
  WIDTH: 95,
  HEIGHT: 125,
  OFFSET_PERCENTAGE: 0.04,
} as const;

export const POSITION_GLYPH = {
  Y: 50,
  SCALE_FACTOR: 0.75,
  SPACING: 25,
  ARROW_WIDTH: 88.9,
  ARROW_HEIGHT: 34.8,
  LETTER_DIMENSIONS: {
    alpha: { width: 92.22, height: 100, yOffset: 10.0 },
    beta: { width: 66.05, height: 100, yOffset: 0.0 },
    gamma: { width: 79, height: 100.11, yOffset: 0.0 },
  } as Record<string, { width: number; height: number; yOffset: number }>,
} as const;

/**
 * Reversal indicator positioning
 * Matches ReversalIndicators.svelte EXACTLY
 */
export const REVERSAL_INDICATOR = {
  X_POSITION: 5.5 * 13, 
  DOT_RADIUS: 1.5 * 10, 
  DOT_SPACING: 4.5 * 13, 
  CENTER_Y: 50 * 9.5, 
} as const;
