/**
 * TKA Theme System
 *
 * This module integrates the @austencloud/theme package with TKA-specific
 * configuration (color palettes, storage key, prop colors).
 *
 * ## Usage
 *
 * Initialize once on app startup:
 * ```typescript
 * import { initializeTkaTheme } from '$lib/shared/theme';
 * initializeTkaTheme();
 * ```
 *
 * Then use theme functions:
 * ```typescript
 * import { applyThemeForBackground, getThemeMode, isLightMode } from '$lib/shared/theme';
 * applyThemeForBackground(BackgroundType.COSMIC);
 * if (isLightMode()) { ... }
 * ```
 */

export {
  initializeTkaTheme,
  applyThemeForBackground,
  applyTkaPropColors,
  applyThemeFromColors,
  ensureThemeApplied,
  getThemeMode,
  isLightMode,
  isDarkMode,
  onThemeModeChange,
} from "./config/tka-theme-config";

// Re-export types from the package
export type {
  ThemeMode,
  GlassMorphismTheme,
  MatteTheme,
  DangerTheme,
} from "@austencloud/theme";

// Re-export theme generation functions for advanced use
export {
  calculateLuminance,
  calculateGradientLuminance,
  generateGlassMorphismTheme,
  generateMatteTheme,
  generateDangerTheme,
  extractAccentColor,
} from "@austencloud/theme";
