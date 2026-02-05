/**
 * Theme Mode State
 *
 * Reactive state that tracks whether the app is in light or dark mode
 * based on the current background luminance. Components can import
 * this to conditionally apply theme-aware styling.
 */

import type { ThemeMode } from "../../settings/utils/background-theme-calculator";

// Reactive state for theme mode - defaults to dark
let currentThemeMode = $state<ThemeMode>("dark");

/**
 * Get the current theme mode reactively
 */
export function getThemeMode(): ThemeMode {
  return currentThemeMode;
}

/**
 * Check if currently in light mode
 */
export function isLightMode(): boolean {
  return currentThemeMode === "light";
}

/**
 * Check if currently in dark mode
 */
export function isDarkMode(): boolean {
  return currentThemeMode === "dark";
}

/**
 * Update the theme mode - called by background-theme-calculator
 * when the background changes
 */
export function setThemeMode(mode: ThemeMode): void {
  currentThemeMode = mode;
}
