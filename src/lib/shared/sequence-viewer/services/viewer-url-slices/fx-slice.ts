/**
 * fx slice — effects config <-> URL payload.
 * Capture: per-top-level-key diff vs DEFAULT_EFFECTS_CONFIG (null at defaults).
 * Seed: merge onto factory defaults (the sender diffed against them).
 */
import type { EffectsConfig } from "$lib/shared/effects/domain/effects-config";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { deepEqual } from "../viewer-url-state-codec";

export interface FxSlicePayload {
  active?: string;
  tuning?: Record<string, unknown>;
}

export function captureFxSlice(state: EffectsConfigState): FxSlicePayload | null {
  const snap = state.snapshot();
  const tuning: Record<string, unknown> = {};

  for (const key of Object.keys(DEFAULT_EFFECTS_CONFIG) as (keyof EffectsConfig)[]) {
    if (key === "activeEffect") continue;
    if (!deepEqual(snap[key], DEFAULT_EFFECTS_CONFIG[key])) {
      tuning[key] = snap[key];
    }
  }

  const payload: FxSlicePayload = {};
  if (snap.activeEffect !== DEFAULT_EFFECTS_CONFIG.activeEffect) {
    payload.active = snap.activeEffect as string;
  }
  if (Object.keys(tuning).length > 0) payload.tuning = tuning;

  return Object.keys(payload).length > 0 ? payload : null;
}

export function seedFromFxSlice(payload: FxSlicePayload): EffectsConfig {
  const seed = structuredClone(DEFAULT_EFFECTS_CONFIG) as EffectsConfig;
  if (payload.tuning) Object.assign(seed, payload.tuning);
  if (payload.active) {
    (seed as { activeEffect: unknown }).activeEffect = payload.active;
  }
  return seed;
}
