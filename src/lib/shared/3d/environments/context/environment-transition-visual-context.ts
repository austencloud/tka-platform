import { getContext, setContext } from "svelte";

import type { EnvironmentTransitionVisualState } from "../state/environment-transition-visual-state.svelte";

const KEY = Symbol("environment-transition-visual");

export function setEnvironmentTransitionVisualContext(
  state: EnvironmentTransitionVisualState
): void {
  setContext(KEY, state);
}

export function getEnvironmentTransitionVisualContext(): EnvironmentTransitionVisualState {
  const state = getContext<EnvironmentTransitionVisualState | undefined>(KEY);
  if (!state) {
    throw new Error("Environment transition visual context is not available");
  }
  return state;
}

export function tryGetEnvironmentTransitionVisualContext():
  | EnvironmentTransitionVisualState
  | undefined {
  return getContext<EnvironmentTransitionVisualState | undefined>(KEY);
}
