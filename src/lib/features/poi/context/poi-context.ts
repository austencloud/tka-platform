import { getContext, setContext } from "svelte";
import type { PoiState } from "../state/poi-state.svelte";

const KEY = Symbol("poi");

export function setPoiContext(state: PoiState): void {
  setContext(KEY, state);
}

export function getPoiContext(): PoiState {
  return getContext<PoiState>(KEY);
}
