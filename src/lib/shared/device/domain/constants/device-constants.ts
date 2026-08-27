// Enable debug logging via URL parameter (e.g., ?debug=foldable)
export const DEBUG_MODE =
  typeof window !== "undefined" &&
  window.location.search.includes("debug=foldable");

// BREAKPOINTS - Single source of truth for all device size thresholds
// Every file that checks viewport width against a device category MUST
// import from here. Grep for raw pixel values (768, 1024, etc.) to find
// violations.

export const BREAKPOINTS = {
  /** Below this = small mobile (tiny phones, foldable cover screens) */
  SMALL_MOBILE: 480,
  /** Below this = mobile phone */
  MOBILE: 768,
  /** Below this = portrait mobile for nav purposes */
  PORTRAIT_MOBILE: 600,
  /** Below this = tablet; at or above = desktop */
  DESKTOP: 1024,
  /** Above this = large desktop */
  LARGE_DESKTOP: 1440,
} as const;

/**
 * Shortest viewport side (CSS px) required to host the 3D sequence viewer.
 * Gates the 3D animation pane off phones while keeping it on large screens,
 * unfolded foldables, tablets, and desktop. Measured against `min(width, height)`
 * so it's orientation-proof (an iPhone in landscape stays excluded).
 *
 * Chosen at 600: safely ABOVE every phone's short side (~450 max — iPhone 15 Pro
 * Max landscape is 932×430) and BELOW a Z Fold 6 unfolded short side (~680, see
 * `FOLDABLE_DEVICE_SPECS.zfold6` below: width 800–850 × height 680–750). A 700px
 * threshold would wrongly exclude the unfolded Z Fold 6.
 */
export const MIN_3D_VIEWPORT_PX = 600;

export const LANDSCAPE_THRESHOLDS = {
  /** Aspect ratio above this in landscape = phone-like proportions */
  WIDE_ASPECT_RATIO: 1.7,
  /** Height at or below this in landscape = phone/small tablet */
  MAX_PHONE_HEIGHT: 600,
} as const;

// Device specification configuration
// NOTE: Keep these dimensions updated as new devices are released or tested
export const FOLDABLE_DEVICE_SPECS = {
  zfold3: {
    models: ["SM-F926"],
    foldedDimensions: {
      width: { min: 350, max: 400 },
      height: { min: 800, max: 900 },
    },
    unfoldedDimensions: {
      width: { min: 700, max: 800 },
      height: { min: 800, max: 900 },
    },
  },
  zfold4: {
    models: ["SM-F936"],
    foldedDimensions: {
      width: { min: 350, max: 400 },
      height: { min: 800, max: 900 },
    },
    unfoldedDimensions: {
      width: { min: 700, max: 800 },
      height: { min: 800, max: 900 },
    },
  },
  zfold5: {
    models: ["SM-F946"],
    foldedDimensions: {
      width: { min: 350, max: 400 },
      height: { min: 800, max: 900 },
    },
    unfoldedDimensions: {
      width: { min: 700, max: 820 },
      height: { min: 800, max: 920 },
    },
  },
  zfold6: {
    models: ["SM-F956"], // Example model, update if needed
    foldedDimensions: {
      width: { min: 350, max: 410 },
      height: { min: 800, max: 950 },
    }, // Estimated
    unfoldedDimensions: {
      width: { min: 800, max: 850 },
      height: { min: 680, max: 750 },
    }, // Based on previous user log
  },
  // Add other known foldable specs here (e.g., Pixel Fold)
};
