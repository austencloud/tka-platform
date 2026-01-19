/**
 * Background Preloader Utility
 *
 * Handles immediate body background CSS variable updates when background settings change.
 * The BackgroundCanvas component handles the visual crossfade transition.
 */

import { BACKGROUND_GRADIENTS } from "./domain/constants/BackgroundGradients";
import { BackgroundType } from "./domain/enums/background-enums";

// Background animation mapping - same as app.html
const BACKGROUND_ANIMATIONS: Record<BackgroundType, string> = {
  pride: "rainbow-flow",
  snowfall: "snow-fall",
  nightSky: "star-twinkle",
  deepOcean: "deep-ocean-flow",
  emberGlow: "ember-glow",
  sakuraDrift: "cherry-blossom",
  fireflyForest: "firefly-forest",
  autumnDrift: "autumn-drift",
  solidColor: "", // No animation for solid colors
  linearGradient: "", // No animation for gradients
};

export interface CustomBackgroundOptions {
  color?: string;
  colors?: string[];
  direction?: number;
}

/**
 * Build a CSS gradient string from custom options
 */
function buildGradientString(options: CustomBackgroundOptions): string {
  if (options.color) {
    // Solid color - use a solid background
    return options.color;
  }
  if (options.colors && options.colors.length > 0) {
    // Custom gradient
    const direction = options.direction ?? 135;
    return `linear-gradient(${direction}deg, ${options.colors.join(", ")})`;
  }
  return "";
}

/**
 * Apply the background immediately (no transition - canvas handles visual crossfade)
 */
function applyBackground(newGradient: string, newAnimation: string): void {
  const body = document.body;

  // Update body animation class immediately
  body.classList.remove(
    "aurora-flow",
    "snow-fall",
    "star-twinkle",
    "deep-ocean-flow",
    "ember-glow",
    "cherry-blossom"
  );
  if (newAnimation) {
    body.classList.add(newAnimation);
  }

  // Set the CSS variable immediately (canvas handles the visual transition)
  document.documentElement.style.setProperty("--gradient-cosmic", newGradient);
}

/**
 * Updates the body background CSS variables immediately
 * The BackgroundCanvas component handles the visual crossfade transition
 */
export function updateBodyBackground(
  backgroundType: BackgroundType,
  customOptions?: CustomBackgroundOptions
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return; // SSR safety
  }

  try {
    // Determine the gradient to apply
    let newGradient: string;

    if (backgroundType === BackgroundType.SOLID_COLOR && customOptions?.color) {
      newGradient = customOptions.color;
    } else if (
      backgroundType === BackgroundType.LINEAR_GRADIENT &&
      customOptions?.colors
    ) {
      newGradient = buildGradientString(customOptions);
    } else {
      // Predefined background type
      newGradient = BACKGROUND_GRADIENTS[backgroundType];
    }

    if (!newGradient) {
      console.warn("Empty gradient for background type:", backgroundType);
      return;
    }

    const newAnimation = BACKGROUND_ANIMATIONS[backgroundType];
    applyBackground(newGradient, newAnimation);
  } catch (error) {
    console.warn("Failed to update body background:", error);
  }
}

/**
 * Preloads the background from localStorage on app startup
 * This is called by the inline script in app.html
 */
export function preloadBackgroundFromStorage(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return; // SSR safety
  }

  try {
    const settingsKey = "tka-modern-web-settings";
    const stored = localStorage.getItem(settingsKey);

    if (stored) {
      const settings = JSON.parse(stored) as {
        backgroundType?: BackgroundType;
      };
      // Default to SOLID_COLOR to match SettingsState defaults
      const backgroundType = (settings.backgroundType ??
        BackgroundType.SOLID_COLOR) as BackgroundType;
      updateBodyBackground(backgroundType);
    }
  } catch (error) {
    console.warn("Failed to preload background:", error);
  }
}
