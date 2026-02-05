/**
 * Animation timing constants
 * Centralized timing values for consistent animation behavior
 */

/**
 * Delay before loading animation to allow Drawer slide animation to complete
 */
export const ANIMATION_LOAD_DELAY_MS = 320;

/**
 * Delay before auto-starting animation after load
 */
export const ANIMATION_AUTO_START_DELAY_MS = 100;

/**
 * Delay before rendering frame during video export
 */
export const VIDEO_FRAME_RENDER_DELAY_MS = 50;

/**
 * Delay before initial frame capture during video export
 */
export const VIDEO_INITIAL_CAPTURE_DELAY_MS = 100;

/**
 * Delay before closing export dialog after successful export
 */
export const VIDEO_EXPORT_SUCCESS_DELAY_MS = 1500;

/**
 * Default frames per second for video export
 * 50 FPS provides smooth animation for MP4/WebM
 */
export const VIDEO_EXPORT_FPS = 50;

/**
 * Number of frames to capture per animation beat
 * 50 frames per beat at 50 FPS = 1 second per beat at 1x speed
 */
export const VIDEO_FRAMES_PER_BEAT = 50;
