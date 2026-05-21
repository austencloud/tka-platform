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
  rainbow: "linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%)",
  winter: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  cosmic: "linear-gradient(135deg, #0a0e2c 0%, #1a2040 50%, #2a3060 100%)",
  ocean: "linear-gradient(135deg, #001122 0%, #000c1e 50%, #000511 100%)",
  ember: "linear-gradient(135deg, #1a0a0a 0%, #2d1410 30%, #4a1f1a 60%, #3d1814 100%)",
  blossom: "linear-gradient(135deg, #2a1f2e 0%, #3d2f42 30%, #4a3d52 60%, #362d40 100%)",
  forest: "linear-gradient(180deg, #0a0e18 0%, #0a1612 60%, #0c1a14 85%, #0a1810 100%)",
  autumn: "linear-gradient(180deg, #1a1520 0%, #2d1f28 30%, #3d2a1f 60%, #2a1810 100%)",
  celestial: "linear-gradient(180deg, #2070c8 0%, #4a9ae8 35%, #8dc4e8 70%, #d4c8a0 100%)",
  void: "#000000",
};

const BACKGROUND_ANIMATIONS: Record<string, string> = {
  rainbow: "rainbow-flow",
  winter: "winter",
  cosmic: "star-twinkle",
  ocean: "ocean-flow",
  ember: "ember",
  blossom: "blossom",
  forest: "forest",
  autumn: "autumn",
  celestial: "celestial",
  void: "",
};

function applyBackground(newGradient: string, newAnimation: string): void {
  const body = document.body;

  body.classList.remove(
    "aurora-flow",
    "winter",
    "star-twinkle",
    "ocean-flow",
    "ember",
    "blossom"
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
  backgroundType: BackgroundType
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  try {
    let newGradient: string;

    newGradient = BACKGROUND_GRADIENTS[backgroundType] ?? "";

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
      const backgroundType = (settings.backgroundType ?? BackgroundType.COSMIC) as BackgroundType;
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
      updateBodyBackground(BackgroundType.COSMIC);
      return;
    }

    const settings = JSON.parse(stored) as {
      backgroundType?: BackgroundType;
      backgroundColor?: string;
      gradientColors?: string[];
      gradientDirection?: number;
    };

    let backgroundType = settings.backgroundType ?? BackgroundType.COSMIC;

    const legacyMap: Record<string, BackgroundType> = {
      nightSky: BackgroundType.COSMIC,
      deepOcean: BackgroundType.OCEAN,
      fireflyForest: BackgroundType.FOREST,
      cherryBlossom: BackgroundType.BLOSSOM,
      emberGlow: BackgroundType.EMBER,
      snowfall: BackgroundType.WINTER,
      autumnDrift: BackgroundType.AUTUMN,
      pureBlack: BackgroundType.VOID,
      solidColor: BackgroundType.VOID,
      linearGradient: BackgroundType.COSMIC,
    };
    const legacyMapped = legacyMap[backgroundType as string];
    if (legacyMapped) {
      backgroundType = legacyMapped;
    }

    updateBodyBackground(backgroundType);
  } catch (error) {
    console.warn("[Background] Failed to ensure background applied:", error);
    updateBodyBackground(BackgroundType.COSMIC);
  }
}
