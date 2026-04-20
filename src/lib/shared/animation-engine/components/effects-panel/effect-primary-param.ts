/**
 * Primary-parameter adapter for the mobile Effects strips layout.
 *
 * Each effect exposes one dominant scalar that the mobile panel surfaces
 * as a primary slider (beneath the preset strip). The adapter is a pure
 * data structure — no Svelte, no VM. Phase 2 will extend it with a 3D
 * branch once the 3D renderer shares this state.
 *
 * All params map to existing properties on EffectsConfigState
 * (src/lib/shared/effects/domain/EffectsConfig.ts).
 */

import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

export interface PrimaryParamSpec {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly get: (state: EffectsConfigState) => number;
  readonly set: (state: EffectsConfigState, value: number) => void;
}

const fmt2 = (v: number) => v.toFixed(2);
const fmtInt = (v: number) => String(Math.round(v));

export const PRIMARY_PARAMS: Record<string, PrimaryParamSpec> = {
  trails: {
    label: "Thickness",
    min: 1,
    max: 12,
    step: 1,
    format: fmtInt,
    get: (s) => s.trails.thickness,
    set: (s, v) => s.updateTrails({ thickness: Math.round(v) }),
  },
  fire: {
    label: "Intensity",
    min: 0.45,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.fire.intensity,
    set: (s, v) => s.updateFire({ intensity: v }),
  },
  led: {
    label: "Brightness",
    min: 1,
    max: 5,
    step: 1,
    format: fmtInt,
    get: (s) => s.led.brightness,
    set: (s, v) => s.updateLed({ brightness: Math.round(v) }),
  },
  charcoal: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.charcoal.intensity,
    set: (s, v) => s.updateCharcoal({ intensity: v }),
  },
  zap: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.zap.intensity,
    set: (s, v) => s.updateZap({ intensity: v }),
  },
  sparkles: {
    label: "Rate",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.sparkles.rate,
    set: (s, v) => s.updateSparkles({ rate: v }),
  },
  echo: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.echo.intensity,
    set: (s, v) => s.updateEcho({ intensity: v }),
  },
  bloom: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.bloom.intensity,
    set: (s, v) => s.updateBloom({ intensity: v }),
  },
  water: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.water.intensity,
    set: (s, v) => s.updateWater({ intensity: v }),
  },
  bubbles: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.bubbles.intensity,
    set: (s, v) => s.updateBubbles({ intensity: v }),
  },
  petals: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.petals.intensity,
    set: (s, v) => s.updatePetals({ intensity: v }),
  },
  smoke: {
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt2,
    get: (s) => s.smoke.intensity,
    set: (s, v) => s.updateSmoke({ intensity: v }),
  },
};

export function getPrimaryParam(effectId: string, state: EffectsConfigState): number {
  const spec = PRIMARY_PARAMS[effectId];
  if (!spec) throw new Error(`No primary param registered for effect "${effectId}"`);
  return spec.get(state);
}

export function setPrimaryParam(
  effectId: string,
  state: EffectsConfigState,
  value: number,
): void {
  const spec = PRIMARY_PARAMS[effectId];
  if (!spec) throw new Error(`No primary param registered for effect "${effectId}"`);
  spec.set(state, value);
}
