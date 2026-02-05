/**
 * Public Page Background Configuration (Landing - standalone)
 *
 * Background picker data and localStorage persistence.
 * Ported from scribe's public-page-backgrounds.ts without $app/environment dependency.
 */

import { BackgroundType } from "@austencloud/backgrounds";

export const ANIMATED_BACKGROUNDS = [
  { type: BackgroundType.NIGHT_SKY, icon: "fa-moon", label: "Night Sky" },
  { type: BackgroundType.SNOWFALL, icon: "fa-snowflake", label: "Snowfall" },
  { type: BackgroundType.DEEP_OCEAN, icon: "fa-water", label: "Deep Ocean" },
  { type: BackgroundType.EMBER_GLOW, icon: "fa-fire", label: "Ember Glow" },
  { type: BackgroundType.SAKURA_DRIFT, icon: "fa-spa", label: "Cherry Blossom" },
  { type: BackgroundType.FIREFLY_FOREST, icon: "fa-tree", label: "Firefly Forest" },
  { type: BackgroundType.AUTUMN_DRIFT, icon: "fa-leaf", label: "Autumn" },
  { type: BackgroundType.PRIDE, icon: "fa-rainbow", label: "Pride" },
] as const;

export type AnimatedBackground = (typeof ANIMATED_BACKGROUNDS)[number];

const STORAGE_KEY = "tka-public-theme-index";

export function getPublicThemeIndex(): number {
  if (typeof window === "undefined") return 0;

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

export function savePublicThemeIndex(index: number): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    // localStorage might be unavailable
  }
}
