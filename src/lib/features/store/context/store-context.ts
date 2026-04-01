import { getContext, setContext } from "svelte";
import type { StoreState } from "../state/store-state.svelte";

const STORE_CONTEXT_KEY = Symbol("store-context");

export interface StoreContext {
  state: StoreState;
}

export function setStoreContext(ctx: StoreContext) {
  setContext(STORE_CONTEXT_KEY, ctx);
}

export function getStoreContext(): StoreContext {
  return getContext<StoreContext>(STORE_CONTEXT_KEY);
}
