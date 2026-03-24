import { getContext, setContext } from "svelte";
import type { FestivalState } from "../state/festival-state.svelte";

const FESTIVAL_CONTEXT_KEY = Symbol("festival-context");

export interface FestivalContext {
  state: FestivalState;
}

export function setFestivalContext(ctx: FestivalContext): void {
  setContext(FESTIVAL_CONTEXT_KEY, ctx);
}

export function getFestivalContext(): FestivalContext {
  return getContext<FestivalContext>(FESTIVAL_CONTEXT_KEY);
}
