/**
 * ExportSettings.ts
 *
 * Export settings payload type for the export panel.
 * Contains format-specific settings for different export types.
 *
 * Domain: Export Panel - Export Types
 */

import type {
  StaticSettings,
  AnimationSettings,
  PerformanceSettings,
} from "../../state/export-panel-state.svelte";

/** Export settings payload - contains format-specific settings */
export interface ExportSettings {
  format: "animation" | "static" | "performance";
  staticSettings?: StaticSettings;
  animationSettings?: AnimationSettings;
  performanceSettings?: PerformanceSettings;
}
