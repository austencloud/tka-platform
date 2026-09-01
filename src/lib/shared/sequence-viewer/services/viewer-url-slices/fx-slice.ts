/**
 * fx slice — effects config <-> URL payload.
 * Capture: per-top-level-key diff vs DEFAULT_EFFECTS_CONFIG (null at defaults).
 * Seed: merge onto factory defaults (the sender diffed against them).
 *
 * Active-effect baseline: the renderer keys off the tipEffectMap wildcard;
 * `activeEffect` mirrors it for UI selection, and the legacy VM migration
 * (`migrateFromVmStorageOnce`) re-derives activeEffect from the wildcard on
 * boot. A factory-fresh instance therefore holds "trails" (the default
 * wildcard) in browsers with an `animation-visibility-settings` entry, while
 * DEFAULT_EFFECTS_CONFIG.activeEffect says "none". Diffing against the raw
 * constant would stamp `fx=trails` onto every untouched viewer, so this slice
 * diffs the EFFECTIVE active effect (wildcard ?? activeEffect) against the
 * derived default, and treats activeEffect + tipEffectMap as one quantity.
 */
import type { EffectsConfig } from "$lib/shared/effects/domain/effects-config";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { deepEqual } from "../viewer-url-state-codec";

export interface FxSlicePayload {
  active?: string;
  tuning?: Record<string, unknown>;
}

type TipEffectMap = EffectsConfig["tipEffectMap"];

function effectiveActive(config: {
  activeEffect: EffectsConfig["activeEffect"];
  tipEffectMap: TipEffectMap;
}): string {
  const wildcard = (
    config.tipEffectMap as Record<string, { effect?: unknown } | undefined>
  )["*"];
  return (wildcard?.effect as string | undefined) ?? (config.activeEffect as string);
}

/** The tipEffectMap `setActiveEffect` writes for a given active effect. */
function canonicalTipMap(active: string): TipEffectMap {
  return (active === "none" ? {} : { "*": { effect: active } }) as TipEffectMap;
}

const DEFAULT_EFFECTIVE_ACTIVE = effectiveActive(DEFAULT_EFFECTS_CONFIG);

export function captureFxSlice(state: EffectsConfigState): FxSlicePayload | null {
  const snap = state.snapshot();
  const active = effectiveActive(snap);
  const tuning: Record<string, unknown> = {};

  for (const key of Object.keys(DEFAULT_EFFECTS_CONFIG) as (keyof EffectsConfig)[]) {
    if (key === "activeEffect") continue;
    if (key === "tipEffectMap") {
      // Redundant with `active` in canonical form; only exotic legacy
      // per-tip maps ride in tuning.
      if (!deepEqual(snap.tipEffectMap, canonicalTipMap(active))) {
        tuning.tipEffectMap = snap.tipEffectMap;
      }
      continue;
    }
    if (!deepEqual(snap[key], DEFAULT_EFFECTS_CONFIG[key])) {
      tuning[key] = snap[key];
    }
  }

  const payload: FxSlicePayload = {};
  if (active !== DEFAULT_EFFECTIVE_ACTIVE) {
    payload.active = active;
  }
  if (Object.keys(tuning).length > 0) payload.tuning = tuning;

  return Object.keys(payload).length > 0 ? payload : null;
}

export function seedFromFxSlice(payload: FxSlicePayload): EffectsConfig {
  const seed = structuredClone(DEFAULT_EFFECTS_CONFIG) as EffectsConfig;
  const active = payload.active ?? DEFAULT_EFFECTIVE_ACTIVE;
  (seed as { activeEffect: unknown }).activeEffect = active;
  seed.tipEffectMap = canonicalTipMap(active);
  if (payload.tuning) Object.assign(seed, payload.tuning);
  return seed;
}
