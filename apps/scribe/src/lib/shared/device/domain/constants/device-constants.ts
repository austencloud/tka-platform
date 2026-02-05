// --- Constants ---
// Enable debug logging via URL parameter (e.g., ?debug=foldable)
export const DEBUG_MODE =
  typeof window !== "undefined" &&
  window.location.search.includes("debug=foldable");

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
