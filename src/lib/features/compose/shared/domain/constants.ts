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
