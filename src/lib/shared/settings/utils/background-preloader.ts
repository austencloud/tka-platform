/**
 * Background Preloader Utility
 *
 * Handles immediate body background CSS variable updates when background settings change.
 * The BackgroundHost component handles the visual crossfade transition via canvas.
 * This utility handles the body CSS fallback (visible during canvas loading).
 */

import { BackgroundType } from "@austencloud/backgrounds";

/** CSS fallback gradients per background type (shown before canvas loads) */
const BACKGROUND_GRADIENTS: Record<string, string> = {
  pride: "linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%)",
  snowfall: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  nightSky: "linear-gradient(135deg, #0a0e2c 0%, #1a2040 50%, #2a3060 100%)",
  deepOcean: "linear-gradient(135deg, #001122 0%, #000c1e 50%, #000511 100%)",
  emberGlow: "linear-gradient(135deg, #1a0a0a 0%, #2d1410 30%, #4a1f1a 60%, #3d1814 100%)",
  cherryBlossom: "linear-gradient(135deg, #2a1f2e 0%, #3d2f42 30%, #4a3d52 60%, #362d40 100%)",
  fireflyForest: "linear-gradient(180deg, #0a0e18 0%, #0a1612 60%, #0c1a14 85%, #0a1810 100%)",
  autumnDrift: "linear-gradient(180deg, #1a1520 0%, #2d1f28 30%, #3d2a1f 60%, #2a1810 100%)",
  celestial: "linear-gradient(135deg, #0a1a4a 0%, #b89050 40%, #e8dcc8 100%)",
  solidColor: "",
  linearGradient: "",
};

const BACKGROUND_ANIMATIONS: Record<string, string> = {
  pride: "rainbow-flow",
  snowfall: "snow-fall",
  nightSky: "star-twinkle",
  deepOcean: "deep-ocean-flow",
  emberGlow: "ember-glow",
  cherryBlossom: "cherry-blossom",
  fireflyForest: "firefly-forest",
  autumnDrift: "autumn-drift",
  celestial: "",
  solidColor: "",
  linearGradient: "",
};

export interface CustomBackgroundOptions {
  color?: string;
  colors?: string[];
  direction?: number;
}

function buildGradientString(options: CustomBackgroundOptions): string {
  if (options.color) return options.color;
  if (options.colors && options.colors.length > 0) {
    const direction = options.direction ?? 135;
    return `linear-gradient(${direction}deg, ${options.colors.join(", ")})`;
  }
  return "";
}

function applyBackground(newGradient: string, newAnimation: string): void {
  const body = document.body;

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

  document.documentElement.style.setProperty("--gradient-cosmic", newGradient);
}

/**
 * Updates the body background CSS variables immediately.
 * The BackgroundHost component handles the visual crossfade transition.
 */
export function updateBodyBackground(
  backgroundType: BackgroundType,
  customOptions?: CustomBackgroundOptions
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  try {
    let newGradient: string;

    if (backgroundType === BackgroundType.SOLID_COLOR && customOptions?.color) {
      newGradient = customOptions.color;
    } else if (
      backgroundType === BackgroundType.LINEAR_GRADIENT &&
      customOptions?.colors
    ) {
      newGradient = buildGradientString(customOptions);
    } else {
      newGradient = BACKGROUND_GRADIENTS[backgroundType] ?? "";
    }

    if (!newGradient) return;

    const newAnimation = BACKGROUND_ANIMATIONS[backgroundType] ?? "";
    applyBackground(newGradient, newAnimation);
  } catch (error) {
    console.warn("Failed to update body background:", error);
  }
}

/**
 * Preloads the background from localStorage on app startup.
 */
export function preloadBackgroundFromStorage(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;

  try {
    const stored = localStorage.getItem("tka-modern-web-settings");
    if (stored) {
      const settings = JSON.parse(stored) as { backgroundType?: BackgroundType };
      const backgroundType = (settings.backgroundType ?? BackgroundType.NIGHT_SKY) as BackgroundType;
      updateBodyBackground(backgroundType);
    }
  } catch (error) {
    console.warn("Failed to preload background:", error);
  }
}

/**
 * Ensure the body background CSS variable is applied based on localStorage settings.
 */
export function ensureBackgroundApplied(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;

  try {
    const stored = localStorage.getItem("tka-modern-web-settings");

    if (!stored) {
      updateBodyBackground(BackgroundType.NIGHT_SKY);
      return;
    }

    const settings = JSON.parse(stored) as {
      backgroundType?: BackgroundType;
      backgroundColor?: string;
      gradientColors?: string[];
      gradientDirection?: number;
    };

    let backgroundType = settings.backgroundType ?? BackgroundType.NIGHT_SKY;

    // Migration: treat old default (solidColor + black) as nightSky
    if (
      backgroundType === BackgroundType.SOLID_COLOR &&
      (!settings.backgroundColor || settings.backgroundColor === "#000000")
    ) {
      backgroundType = BackgroundType.NIGHT_SKY;
    }

    const customOptions: CustomBackgroundOptions = {};
    if (backgroundType === BackgroundType.SOLID_COLOR && settings.backgroundColor) {
      customOptions.color = settings.backgroundColor;
    } else if (backgroundType === BackgroundType.LINEAR_GRADIENT) {
      if (settings.gradientColors) customOptions.colors = settings.gradientColors;
      if (settings.gradientDirection !== undefined) customOptions.direction = settings.gradientDirection;
    }

    updateBodyBackground(backgroundType, customOptions);
  } catch (error) {
    console.warn("[Background] Failed to ensure background applied:", error);
    updateBodyBackground(BackgroundType.NIGHT_SKY);
  }
}
