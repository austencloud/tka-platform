import { getContext, setContext } from "svelte";
import type { DeckReleaserState } from "../state/deck-releaser-state.svelte";

const DECK_RELEASER_CONTEXT_KEY = Symbol("deck-releaser-context");

export interface DeckReleaserContext {
  state: DeckReleaserState;
}

export function setDeckReleaserContext(context: DeckReleaserContext): void {
  setContext(DECK_RELEASER_CONTEXT_KEY, context);
}

export function getDeckReleaserContext(): DeckReleaserContext {
  return getContext<DeckReleaserContext>(DECK_RELEASER_CONTEXT_KEY);
}
