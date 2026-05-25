/**
 * Shared preset types for the unified effects panel.
 *
 * Each effect type (Fire, Charcoal, LED, Trails) has 4 visual presets
 * shown as quick-select options before the user taps "Customize".
 */

import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

export interface EffectPreset {
  id: string;
  name: string;
  /** CSS color for the preview dot, or "rainbow" for special conic-gradient visual */
  previewColor: string;
  /** Optional second color for dual-dot previews (e.g. "Prop Colors") */
  previewColor2?: string;
  /**
   * Apply this preset's settings.
   * Captured by EffectsPanel via getContext at init time - Svelte 5 forbids
   * getContext() inside event handlers, so presets must NOT call it themselves.
   */
  apply: (state: EffectsConfigState) => void;
}

export interface EffectPresetGroup {
  effectType: string;
  presets: EffectPreset[];
  /** One-line summary of current settings. Same context rules as `apply`. */
  getSummary: (state: EffectsConfigState) => string;
}
