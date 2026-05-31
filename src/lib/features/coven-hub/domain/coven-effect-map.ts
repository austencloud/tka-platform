import type { TipEffectMap, EffectType } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";

const VALID = new Set<string>(EFFECTS.map((e) => e.id));

/**
 * Build a wildcard TipEffectMap for one coven. Seed coven (null) and unknown
 * ids fall back to "led" — the registry ids are 1:1 with EffectType, so a
 * known id passes straight through.
 */
export function buildTipEffectMap(effectId: string | null): TipEffectMap {
  const effect = (effectId && VALID.has(effectId) ? effectId : "led") as EffectType;
  return { "*": { effect } };
}
