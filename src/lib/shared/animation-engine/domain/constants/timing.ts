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
 * 60 FPS is the standard for high-quality MP4 export
 */
export const VIDEO_EXPORT_FPS = 60;

/**
 * Number of frames to capture per animation beat
 * 60 frames per beat at 60 FPS = 1 second per beat at 1x speed
 */
export const VIDEO_FRAMES_PER_BEAT = 60;

/**
 * Playback speed clamp shared by the engine and every BPM-facing control.
 * speed = bpm / PLAYBACK_BASELINE_BPM, so 0.1–3.0x means 6–180 BPM.
 *
 * Every UI tempo bound MUST derive from these: a control that offers a BPM
 * the engine silently re-clamps becomes a dead button — the readout freezes
 * while clicks keep "succeeding" (the 2026-07 tempo rage-click bug).
 */
export const PLAYBACK_BASELINE_BPM = 60;
export const PLAYBACK_MIN_SPEED = 0.1;
export const PLAYBACK_MAX_SPEED = 3.0;
export const PLAYBACK_MIN_BPM = PLAYBACK_MIN_SPEED * PLAYBACK_BASELINE_BPM;
export const PLAYBACK_MAX_BPM = PLAYBACK_MAX_SPEED * PLAYBACK_BASELINE_BPM;
