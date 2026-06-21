/**
 * Curated per-effect tuning knobs surfaced in the 3D viewer FX popover.
 *
 * Only the effects with a LIVE 3D renderer that consumes the tuned value have
 * entries — listing a knob here is a promise that dragging it changes the 3D
 * render. Effects without a 3D renderer (zap/echo/water/…) get no entry.
 *
 * Each knob binds to an EffectsConfig intent field via
 * `config.updateEffect(effectId, { [field]: value })`. Discrete-choice params
 * (LED patternId, trail rainbow/tracking) are NOT sliders and stay as the
 * panel's existing mode-chip controls.
 *
 * Deferred (intentionally absent so we don't ship a dead control):
 *   - Fire "Color" (colorBlend): 3D fire uses discrete color presets, not a
 *     continuous natural↔prop blend. Needs the 3D color-blend path wired first.
 */

import type { EffectId } from "$lib/shared/effects/state/effects-config-state.svelte";

export interface CuratedKnob {
  label: string;
  /** Intent field on the effect's config object. */
  field: string;
  min: number;
  max: number;
  step: number;
  /** Render the value as a percentage (0-1 fields). */
  pct?: boolean;
}

export const CURATED_KNOBS: Partial<Record<EffectId, CuratedKnob[]>> = {
  fire: [
    { label: "Intensity", field: "intensity", min: 0.45, max: 1, step: 0.05, pct: true },
    { label: "Brightness", field: "brightness", min: 0, max: 1, step: 0.05, pct: true },
    { label: "Turbulence", field: "turbulence", min: 0, max: 1, step: 0.05, pct: true },
  ],
  trails: [
    { label: "Thickness", field: "thickness", min: 1, max: 10, step: 0.5 },
    { label: "Brightness", field: "brightness", min: 0.3, max: 1, step: 0.05, pct: true },
  ],
  led: [
    { label: "Brightness", field: "brightness", min: 1, max: 5, step: 1 },
    { label: "Speed", field: "patternSpeed", min: 0.1, max: 5, step: 0.1 },
  ],
  charcoal: [
    { label: "Intensity", field: "intensity", min: 0, max: 1, step: 0.05, pct: true },
    { label: "Spread", field: "spread", min: 0, max: 1, step: 0.05, pct: true },
    { label: "Glow", field: "glow", min: 0, max: 1, step: 0.05, pct: true },
  ],
};

/** Format a knob value for the readout span. */
export function formatKnobValue(knob: CuratedKnob, value: number): string {
  if (knob.pct) return `${Math.round(value * 100)}%`;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
