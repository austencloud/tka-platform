/**
 * Builder Context - Hand Path Builder
 *
 * Sets/gets the builder state via Svelte context so any descendant
 * can consume it without prop drilling.
 */

import { getContext, setContext } from "svelte";
import type { BuilderState } from "../state/builder-state.svelte";

const CONTEXT_KEY = Symbol("hand-path-builder");

export function setBuilderContext(state: BuilderState): void {
  setContext(CONTEXT_KEY, state);
}

export function getBuilderContext(): BuilderState {
  const state = getContext<BuilderState>(CONTEXT_KEY);
  if (!state) {
    throw new Error(
      "[HandPathBuilder] getBuilderContext() called outside a HandPathBuilderLab tree."
    );
  }
  return state;
}
