/**
 * Public Page Background Configuration
 *
 * Background picker data and localStorage persistence for public pages
 * (landing, about, privacy, terms, etc.).
 */

import { browser } from "$app/environment";
import { BackgroundType } from "@austencloud/backgrounds";

/**
 * Animated background options for public pages.
 * All public pages use the same list for consistency.
 */
export const ANIMATED_BACKGROUNDS = [
  { type: BackgroundType.NIGHT_SKY, icon: "fa-moon", label: "Night Sky" },
  { type: BackgroundType.SNOWFALL, icon: "fa-snowflake", label: "Snowfall" },
  { type: BackgroundType.DEEP_OCEAN, icon: "fa-water", label: "Deep Ocean" },
  { type: BackgroundType.EMBER_GLOW, icon: "fa-fire", label: "Ember Glow" },
  { type: BackgroundType.CHERRY_BLOSSOM, icon: "fa-spa", label: "Cherry Blossom" },
  { type: BackgroundType.FIREFLY_FOREST, icon: "fa-tree", label: "Firefly Forest" },
  { type: BackgroundType.AUTUMN_DRIFT, icon: "fa-leaf", label: "Autumn" },
  { type: BackgroundType.PRIDE, icon: "fa-rainbow", label: "Pride" },
  { type: BackgroundType.CELESTIAL, icon: "fa-cloud-sun", label: "Celestial" },
] as const;

export type AnimatedBackground = (typeof ANIMATED_BACKGROUNDS)[number];

const STORAGE_KEY = "tka-public-theme-index";

/** Get the saved theme index from localStorage, or 0 (Night Sky) as default */
export function getPublicThemeIndex(): number {
  if (!browser) return 0;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const index = parseInt(stored, 10);
      if (!isNaN(index) && index >= 0 && index < ANIMATED_BACKGROUNDS.length) {
        return index;
      }
    }
  } catch {
    // localStorage might be unavailable
  }

  return 0;
}

/** Save the theme index to localStorage */
export function savePublicThemeIndex(index: number): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    // localStorage might be unavailable
  }
}

/** Get the next theme index (wrapping around) */
export function getNextThemeIndex(currentIndex: number): number {
  return (currentIndex + 1) % ANIMATED_BACKGROUNDS.length;
}
