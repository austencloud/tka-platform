/**
 * App Mode State - Svelte 5 Runes
 *
 * Manages application mode transitions and info page state.
 * Handles the transition between info page and main app.
 */

import { browser } from "$app/environment";
import {
  DEFAULT_INFO_BACKGROUND,
  INFO_BACKGROUND_KEY,
} from "./app-state-constants";
import type { InfoBackground } from "./app-state-types";

// Load from localStorage
function loadInfoBackground(): InfoBackground {
  if (!browser) return DEFAULT_INFO_BACKGROUND;

  try {
    const stored = localStorage.getItem(INFO_BACKGROUND_KEY);
    if (stored && ["deepOcean", "snowfall", "nightSky"].includes(stored)) {
      return stored as InfoBackground;
    }
  } catch (error) {
    console.warn("Failed to load info background from localStorage:", error);
  }

  return DEFAULT_INFO_BACKGROUND;
}

// Reactive state
const appModeState = $state({
  infoBackground: loadInfoBackground(),
  isTransitioning: false,
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Set the info page background
 */
export function setInfoBackground(background: InfoBackground): void {
  appModeState.infoBackground = background;

  if (browser) {
    try {
      localStorage.setItem(INFO_BACKGROUND_KEY, background);
    } catch (error) {
      console.warn("Failed to save info background to localStorage:", error);
    }
  }
}

/**
 * Get the current info background
 */
export function getInfoBackground(): InfoBackground {
  return appModeState.infoBackground;
}

/**
 * Check if currently transitioning between modes
 */
export function isTransitioning(): boolean {
  return appModeState.isTransitioning;
}
