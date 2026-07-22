import { getContext, setContext } from "svelte";

import type { AdaptiveQualityState } from "../state/adaptive-quality-state.svelte";

const KEY = Symbol("adaptive-3d-quality");

export function setAdaptiveQualityContext(state: AdaptiveQualityState): void {
  setContext(KEY, state);
}

export function tryGetAdaptiveQualityContext():
  | AdaptiveQualityState
  | undefined {
  return getContext<AdaptiveQualityState | undefined>(KEY);
}
