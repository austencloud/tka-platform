/**
 * Spotlight Constants
 *
 * Constants extracted from spotlight components for centralized management.
 */

export const SPOTLIGHT_CONSTANTS = {
  ANIMATION: {
    FADE_IN_DURATION: 400,
    FADE_OUT_DURATION: 200,
    CONTENT_DELAY: 250,
    BACKDROP_BLUR: 10,
    FADE_IN_EASING: "cubic-bezier(0.4, 0, 0.2, 1)",
    FADE_OUT_EASING: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  TIMING: {
    HINT_HIDE_DELAY: 3000,
    CLOSE_ANIMATION_DELAY: 400,
  },
  KEYBOARD: {
    ESLOOPE_KEY: "Escape",
    ARROW_LEFT: "ArrowLeft",
    ARROW_RIGHT: "ArrowRight",
  },
  ACTIONS: {
    EDIT: "edit",
    SAVE: "save",
    DELETE: "delete",
  },
} as const;
