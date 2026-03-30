/**
 * Shared preset types for the unified effects panel.
 *
 * Each effect type (Fire, Charcoal, LED, Trails) has 4 visual presets
 * shown as quick-select options before the user taps "Customize".
 */

import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";

export interface EffectPreset {
  id: string;
  name: string;
  /** CSS color for the preview dot, or "rainbow" for special conic-gradient visual */
  previewColor: string;
  /** Optional second color for dual-dot previews (e.g. "Prop Colors") */
  previewColor2?: string;
  /** Apply this preset's settings to the visibility manager */
  apply: (vm: AnimationVisibilityStateManager) => void;
}

export interface EffectPresetGroup {
  effectType: string;
  presets: EffectPreset[];
  /** One-line summary of current settings for display below presets */
  getSummary: (vm: AnimationVisibilityStateManager) => string;
}
