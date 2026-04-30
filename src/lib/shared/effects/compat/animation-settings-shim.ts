/**
 * Compatibility shim: animation-settings-state (trail appearance)
 * → canonical EffectsConfig trails intent.
 *
 * PHASE A ONLY. Deleted in Phase B.
 *
 * TrackingMode note: the TrackingMode enum (from TrailTypes.ts) uses string
 * literal values that are already the canonical TrailsIntent strings:
 *   TrackingMode.LEFT_END  = "left_end"
 *   TrackingMode.RIGHT_END = "right_end"
 *   TrackingMode.BOTH_ENDS = "both_ends"
 * No translation table is needed - the value is passed through directly.
 */

import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import type { EffectsConfigState } from "../state/effects-config-state.svelte";
import type { TrailsIntent } from "../domain/EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

function snapshotTrailsFromAnimationSettings(): TrailsIntent {
  const t = animationSettings.trail;

  // TrackingMode enum values are already the canonical string literals
  // ("left_end" | "right_end" | "both_ends"), so the cast is safe.
  const trackingMode = (t.trackingMode as unknown) as TrailsIntent["trackingMode"];

  return {
    trackingMode: trackingMode ?? DEFAULT_EFFECTS_CONFIG.trails.trackingMode,
    thickness: t.lineWidth ?? DEFAULT_EFFECTS_CONFIG.trails.thickness,
    brightness: t.maxOpacity ?? DEFAULT_EFFECTS_CONFIG.trails.brightness,
    blueColor: t.blueColor ?? DEFAULT_EFFECTS_CONFIG.trails.blueColor,
    redColor: t.redColor ?? DEFAULT_EFFECTS_CONFIG.trails.redColor,
    rainbow: false,
  };
}

/**
 * Seed a fresh EffectsConfigState's trails field from animationSettings.
 * Call once after creating the state, before mounting the 3D viewer.
 */
export function seedTrailsFromAnimationSettings(state: EffectsConfigState): void {
  state.updateTrails(snapshotTrailsFromAnimationSettings());
}

/**
 * Bind a live listener. Returns a no-op disposer because
 * animation-settings-state uses Svelte 5 runes without an observer API -
 * callers must wrap this in a consumer-side $effect that re-calls
 * seedTrailsFromAnimationSettings when rune fields change.
 */
export function bindAnimationSettingsToEffectsConfig(state: EffectsConfigState): () => void {
  seedTrailsFromAnimationSettings(state);
  return () => { /* noop - caller must use $effect for live sync */ };
}
