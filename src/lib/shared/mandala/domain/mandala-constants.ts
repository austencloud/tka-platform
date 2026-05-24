/** Standardized tip point distance for all mandalas, regardless of prop type.
 * dx=125 is the sweet spot between fan (105) and staff (135). */
export const MANDALA_STANDARD_TIP_DX = 130;

/** Points sampled per beat per tip. Adaptive: multiplied by ceil(turns) for high-turn motions */
export const BASE_SAMPLES_PER_BEAT = 64;

/** Grid radius in mandala coordinate space */
export const MANDALA_GRID_RADIUS = 80;

/** SVG viewBox size (square) */
export const MANDALA_DEFAULT_SIZE = 500;

/**
 * TKA mandala colors - uses --prop-*-text values from background-theme-calculator.
 * These are the readable-on-dark-backgrounds versions of the canonical prop colors.
 * --prop-blue-text: #818cf8, --prop-red-text: #f87171
 */
export const BLUE_STROKE = "#818cf8";
export const RED_STROKE = "#f87171";
export const BLUE_FILL = "rgba(129, 140, 248, 0.2)";
export const RED_FILL = "rgba(248, 113, 113, 0.2)";

/** Purple overlap - Tailwind violet-400, perceptually between blue and red */
export const PURPLE_STROKE = "#a78bfa";
export const PURPLE_FILL = "rgba(167, 139, 250, 0.2)";

/**
 * Mandala palettes that mirror the actual pictograph arrow colors
 * (--dm-motion-blue / --dm-motion-red in app.css). Using these instead of
 * the --prop-*-text values means the mandala's blue and red match what the
 * user sees in the beat cells, instead of drifting toward a softer variant.
 *
 * Dark mode (.dark class): arrows render at #3575E2 / #ED1C24.
 * Light mode: arrows render at #3D44B8 / #DC2626.
 */
export const DARK_MOTION_BLUE_STROKE = "#3575E2";
export const DARK_MOTION_RED_STROKE = "#ED1C24";
export const DARK_MOTION_BLUE_FILL = "rgba(53, 117, 226, 0.2)";
export const DARK_MOTION_RED_FILL = "rgba(237, 28, 36, 0.2)";

export const LIGHT_MOTION_BLUE_STROKE = "#3D44B8";
export const LIGHT_MOTION_RED_STROKE = "#DC2626";
export const LIGHT_MOTION_BLUE_FILL = "rgba(61, 68, 184, 0.2)";
export const LIGHT_MOTION_RED_FILL = "rgba(220, 38, 38, 0.2)";

// Purple overlap stays perceptually midway between blue and red per mode.
export const DARK_MOTION_PURPLE_STROKE = "#a78bfa";
export const DARK_MOTION_PURPLE_FILL = "rgba(167, 139, 250, 0.2)";
export const LIGHT_MOTION_PURPLE_STROKE = "#6d28d9";
export const LIGHT_MOTION_PURPLE_FILL = "rgba(109, 40, 217, 0.2)";

/**
 * Grid radius in the animation engine's coordinate space (prop-local units).
 * This is the distance from center to cardinal grid points in a 950px viewBox.
 * Also equals staff half-length (staff tip dx=150).
 * Tip offsets are scaled by (MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS) to fit
 * the mandala's coordinate space.
 */
export const ENGINE_GRID_RADIUS = 150;

/**
 * Number of frames to skip at the start of rendering (and after seeks/resizes)
 * so props can settle into their correct positions before we start drawing.
 * Matches the warmup strategy used by TrailOverlayCanvas.
 */
export const OVERLAY_WARMUP_FRAMES = 3;

/**
 * Per-frame alpha subtracted from low-alpha pixels during smoothAlphaDecay.
 * Destination-out's multiplicative fade can never reach 0 due to 8-bit integer
 * rounding; constant subtraction guarantees every pixel eventually reaches 0.
 */
export const OVERLAY_ALPHA_DECAY = 2;
