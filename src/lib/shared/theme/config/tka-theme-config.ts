/**
 * TKA Theme Configuration
 *
 * Configures the @austencloud/theme package with TKA-specific:
 * - Storage key for localStorage
 * - Color palettes for each background type
 * - Domain-specific prop colors
 *
 * Call `initializeTkaTheme()` once on app startup.
 */

import {
  setStorageKey,
  setThemeColorPalette,
  applyThemeFromColors,
} from "@austencloud/theme";
import { BackgroundType } from "@austencloud/backgrounds";

/**
 * Theme colors for each background type
 * Format: [dark1, dark2, accent, accentLight?]
 * - First colors are for luminance calculation
 * - Middle/later colors are extracted as accent for buttons and interactive elements
 */
const BACKGROUND_THEME_COLORS: Record<BackgroundType, string[]> = {
  [BackgroundType.PRIDE]: ["#8b1c1c", "#6b6b00", "#f43f5e", "#fda4af"],
  [BackgroundType.SNOWFALL]: ["#1e3a5f", "#3b82f6", "#93c5fd"],
  [BackgroundType.NIGHT_SKY]: ["#1e1b4b", "#4338ca", "#818cf8"],
  [BackgroundType.DEEP_OCEAN]: ["#0c4a6e", "#0891b2", "#22d3ee"],
  [BackgroundType.EMBER_GLOW]: ["#7c2d12", "#ea580c", "#fb923c"],
  [BackgroundType.CHERRY_BLOSSOM]: ["#831843", "#db2777", "#f9a8d4"],
  [BackgroundType.FIREFLY_FOREST]: ["#0d3320", "#166534", "#22c55e", "#bef264"],
  [BackgroundType.AUTUMN_DRIFT]: ["#92400e", "#d97706", "#dc2626", "#78350f"],
  // Solid/gradient: dark backgrounds but vibrant indigo accent for visibility
  [BackgroundType.SOLID_COLOR]: ["#18181b", "#6366f1", "#818cf8"],
  [BackgroundType.LINEAR_GRADIENT]: ["#0d1117", "#6366f1", "#a78bfa"],
  [BackgroundType.CELESTIAL]: ["#0a1a4a", "#b89050", "#ffd080", "#ffe0a0"],
};

/**
 * Initialize theme system with TKA-specific configuration
 * Call this once on app startup (in +layout.svelte or root component)
 */
export function initializeTkaTheme(): void {
  // Set TKA-specific storage key
  setStorageKey("tka-modern-web-settings");

  // Register all background type palettes
  for (const [bgType, colors] of Object.entries(BACKGROUND_THEME_COLORS)) {
    setThemeColorPalette(bgType, colors);
  }
}

/**
 * Apply theme based on BackgroundType
 * Convenience function that looks up theme colors and applies them
 */
export function applyThemeForBackground(backgroundType: BackgroundType): void {
  const themeColors = BACKGROUND_THEME_COLORS[backgroundType];
  if (themeColors) {
    applyThemeFromColors(undefined, themeColors);
  }
}

/**
 * Apply domain-specific prop colors to document root
 * These are constant colors that don't change with background.
 */
export function applyTkaPropColors(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Domain-specific prop colors (constant)
  root.style.setProperty("--prop-blue", "#2e3192");
  root.style.setProperty("--prop-blue-bg", "rgba(46, 49, 146, 0.15)");
  root.style.setProperty("--prop-blue-border", "rgba(46, 49, 146, 0.4)");
  root.style.setProperty("--prop-blue-text", "#818cf8");
  root.style.setProperty("--prop-red", "#ed1c24");
  root.style.setProperty("--prop-red-bg", "rgba(237, 28, 36, 0.15)");
  root.style.setProperty("--prop-red-border", "rgba(237, 28, 36, 0.4)");
  root.style.setProperty("--prop-red-text", "#f87171");
}

// Re-export common functions for convenience
export {
  applyThemeFromColors,
  ensureThemeApplied,
  getThemeMode,
  isLightMode,
  isDarkMode,
  onThemeModeChange,
} from "@austencloud/theme";
