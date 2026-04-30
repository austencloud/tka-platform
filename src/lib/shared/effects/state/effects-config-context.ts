import { getContext, setContext } from "svelte";
import type { EffectsConfigState } from "./effects-config-state.svelte";

const EFFECTS_CONFIG_CONTEXT_KEY = Symbol("effects-config-state");

export function setEffectsConfigContext(state: EffectsConfigState): EffectsConfigState {
  setContext(EFFECTS_CONFIG_CONTEXT_KEY, state);
  return state;
}

/**
 * Returns the effects config state from context.
 * Returns null if no ancestor has called setEffectsConfigContext -
 * callers decide whether to fall through to a default or throw.
 */
export function getEffectsConfigContext(): EffectsConfigState | null {
  return getContext<EffectsConfigState | null>(EFFECTS_CONFIG_CONTEXT_KEY) ?? null;
}
