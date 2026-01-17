/**
 * Public Page Theme Persistence
 *
 * Stores the user's selected background theme for public pages (landing, about, privacy, etc.)
 * in localStorage. This is separate from the main app's theme settings.
 */

import { browser } from "$app/environment";
import { ANIMATED_BACKGROUNDS } from "./animated-backgrounds";

const STORAGE_KEY = "tka-public-theme-index";

/**
 * Get the saved theme index from localStorage, or return 0 (Night Sky) as default
 */
export function getPublicThemeIndex(): number {
  if (!browser) return 0;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const index = parseInt(stored, 10);
      // Validate the index is within bounds
      if (!isNaN(index) && index >= 0 && index < ANIMATED_BACKGROUNDS.length) {
        return index;
      }
    }
  } catch {
    // localStorage might be unavailable (private browsing, etc.)
  }

  return 0; // Default to first background (Night Sky)
}

/**
 * Save the theme index to localStorage
 */
export function savePublicThemeIndex(index: number): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    // localStorage might be unavailable
  }
}

/**
 * Get the next theme index (wrapping around)
 */
export function getNextThemeIndex(currentIndex: number): number {
  return (currentIndex + 1) % ANIMATED_BACKGROUNDS.length;
}
