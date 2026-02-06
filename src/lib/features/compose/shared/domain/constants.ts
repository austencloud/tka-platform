/**
 * Animation constants for the Pictograph Animator
 * Centralizes all hardcoded values for better maintainability
 */

export const ANIMATION_CONSTANTS = {
  // Canvas and rendering
  DEFAULT_CANVAS_RADIUS: 200,
  DEFAULT_PROP_SCALE: 0.4,
  DEFAULT_PATH_RADIUS_RATIO: 0.4,
  DEFAULT_CANVAS_WIDTH: 500,
  DEFAULT_CANVAS_HEIGHT: 500,

  // Diamond Grid System
  GRID_VIEWBOX_SIZE: 950,
  GRID_CENTER: 475,
  GRID_HALFWAY_POINT_OFFSET: 151.5, // Distance from center to grid halfway point

  // Animation timing
  DEFAULT_ANIMATION_SPEED: 1.0,
  MIN_ANIMATION_SPEED: 0.1,
  MAX_ANIMATION_SPEED: 3.0,
  SPEED_STEP: 0.1,

  // Staff rendering (new SVG-based staff)
  STAFF_VIEWBOX_WIDTH: 252.8,
  STAFF_VIEWBOX_HEIGHT: 77.8,
  STAFF_CENTER_X: 126.4,
  STAFF_CENTER_Y: 38.9,
  STAFF_WIDTH: 80,
  STAFF_HEIGHT: 80,
  STAFF_THICKNESS: 5,
  STAFF_BORDER_RADIUS: 2,
  CENTER_DOT_RADIUS: 4,

  // Grid rendering
  GRID_STROKE_WIDTH: 1,
  GRID_FONT_SIZE: 14,
  GRID_FONT_FAMILY: "sans-serif",
  GRID_LABEL_OFFSET: 5,

  // Animation loop
  TARGET_FPS: 60,
  FRAME_TIME_MS: 1000 / 60,

  // File processing
  PNG_SIGNATURE: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  METADATA_KEYWORD: "metadata",

  // UI timing
  SUCCESS_MESSAGE_TIMEOUT: 5000,
  ERROR_MESSAGE_TIMEOUT: 10000,

  // Validation
  MAX_SEQUENCE_STEPS: 1000,
  MIN_SEQUENCE_STEPS: 1,
  MAX_BEAT_VALUE: 999,

  // Performance
  RENDER_THROTTLE_MS: 16, // ~60fps
  DEBOUNCE_INPUT_MS: 300,
} as const;

/**
 * Derived constants calculated from base values
 */
export const DERIVED_CONSTANTS = {
  get HALF_CANVAS_WIDTH() {
    return ANIMATION_CONSTANTS.DEFAULT_CANVAS_WIDTH / 2;
  },
  get HALF_CANVAS_HEIGHT() {
    return ANIMATION_CONSTANTS.DEFAULT_CANVAS_HEIGHT / 2;
  },
  get PATH_RADIUS() {
    return (
      ANIMATION_CONSTANTS.DEFAULT_CANVAS_WIDTH *
      ANIMATION_CONSTANTS.DEFAULT_PATH_RADIUS_RATIO
    );
  },
  get STAFF_DRAW_WIDTH() {
    return (
      ANIMATION_CONSTANTS.STAFF_WIDTH * ANIMATION_CONSTANTS.DEFAULT_PROP_SCALE
    );
  },
  get STAFF_DRAW_HEIGHT() {
    return (
      ANIMATION_CONSTANTS.STAFF_HEIGHT * ANIMATION_CONSTANTS.DEFAULT_PROP_SCALE
    );
  },
} as const;

/**
 * Type-safe access to animation constants
 */
export type AnimationConstant = keyof typeof ANIMATION_CONSTANTS;
export type DerivedConstant = keyof typeof DERIVED_CONSTANTS;
import { getMotionColor } from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Color constants for the Pictograph Animator
 * Uses centralized getMotionColor for consistency (dark mode for animation canvas)
 */

export const PROP_COLORS = {
  RED: getMotionColor(MotionColor.RED, "dark"),
  BLUE: getMotionColor(MotionColor.BLUE, "dark"),
} as const;

export const UI_COLORS = {
  PRIMARY: "#2196f3",
  PRIMARY_DARK: "#1976d2",
  SUCCESS: "#4caf50",
  WARNING: "#ff9800",
  ERROR: "#d32f2f",
  BACKGROUND: "#f5f5f5",
  BORDER: "#e0e0e0",
} as const;

export const CANVAS_COLORS = {
  BACKGROUND: "white",
  LABELS: "#666",
} as const;
