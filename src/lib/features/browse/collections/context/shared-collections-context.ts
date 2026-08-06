import { getContext, setContext } from "svelte";
import type { SharedCollectionsState } from "../state/shared-collections-state.svelte";

const SHARED_COLLECTIONS_CONTEXT = Symbol("shared-collections");

export function setSharedCollectionsContext(
  state: SharedCollectionsState
): void {
  setContext(SHARED_COLLECTIONS_CONTEXT, state);
}

export function getSharedCollectionsContext(): SharedCollectionsState {
  const state = getContext<SharedCollectionsState>(SHARED_COLLECTIONS_CONTEXT);
  if (!state) {
    throw new Error("Shared collections context is not available.");
  }
  return state;
}
