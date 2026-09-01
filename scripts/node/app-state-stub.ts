/**
 * Node.js Stub for app-state.svelte.ts
 *
 * Provides mock implementations of app state functions for Node.js CLI tools.
 * These return sensible defaults since we don't have Firebase or user sessions.
 */

import { GridMode } from "../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "../../src/lib/shared/pictograph/prop/domain/enums/PropType";

// Default settings for Node.js - matches what the browser uses as defaults
const DEFAULT_SETTINGS = {
  gridMode: GridMode.DIAMOND,
  backgroundType: "solid",
  backgroundQuality: "medium",
  backgroundEnabled: false,
  backgroundColor: "#000000",
  leftPropType: PropType.STAFF,
  rightPropType: PropType.STAFF,
};

/**
 * Get app settings (returns defaults for Node.js)
 */
export function getSettings() {
  return DEFAULT_SETTINGS;
}

/**
 * Check if in preview mode (always false for Node.js)
 */
export function isSettingsPreviewMode(): boolean {
  return false;
}

/**
 * Performance metrics (stub)
 */
export function getPerformanceMetrics() {
  return {
    initializationTime: 0,
    lastRenderTime: 0,
    memoryUsage: 0,
  };
}

/**
 * App ready state (always true for Node.js)
 */
export function getIsReady() {
  return true;
}

/**
 * Can use app (always true for Node.js)
 */
export function getCanUseApp() {
  return true;
}
