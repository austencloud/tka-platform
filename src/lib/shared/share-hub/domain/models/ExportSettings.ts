/**
 * ExportSettings.ts
 *
 * Export settings payload type for Share Hub.
 * Contains format-specific settings for different export types.
 *
 * Domain: Share Hub - Export Types
 */

import type {
  StaticSettings,
  AnimationSettings,
  PerformanceSettings,
} from "../../state/share-hub-state.svelte";

/** Export settings payload - contains format-specific settings */
export interface ExportSettings {
  format: "animation" | "static" | "performance";
  staticSettings?: StaticSettings;
  animationSettings?: AnimationSettings;
  performanceSettings?: PerformanceSettings;
}
