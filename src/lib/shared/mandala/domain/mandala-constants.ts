/** Default inward offset from exact tip — creates visible lobes on 0-turn motions */
export const DEFAULT_TIP_INSET_PX = 20;

/** Points sampled per beat per tip. Adaptive: multiplied by ceil(turns) for high-turn motions */
export const BASE_SAMPLES_PER_BEAT = 64;

/** Grid radius in mandala coordinate space */
export const MANDALA_GRID_RADIUS = 80;

/** SVG viewBox size (square) */
export const MANDALA_DEFAULT_SIZE = 500;

/** TKA canonical colors */
export const BLUE_STROKE = "#2e3192";
export const RED_STROKE = "#ed1c24";
export const BLUE_FILL = "rgba(46, 49, 146, 0.2)";
export const RED_FILL = "rgba(237, 28, 36, 0.2)";

/**
 * Grid radius in the animation engine's coordinate space (prop-local units).
 * This is the distance from center to cardinal grid points in a 950px viewBox.
 * Also equals staff half-length (staff tip dx=150).
 * Tip offsets are scaled by (MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS) to fit
 * the mandala's coordinate space.
 */
export const ENGINE_GRID_RADIUS = 150;
