// src/lib/features/choreo-card/context/deck-browse-context.ts

import { getContext, setContext } from 'svelte';
import type { DeckBrowseState } from '../state/deck-browse-state.svelte';

const KEY = Symbol('deck-browse');

export function setBrowseContext(state: DeckBrowseState): void {
  setContext(KEY, state);
}

export function getBrowseContext(): DeckBrowseState {
  return getContext<DeckBrowseState>(KEY);
}
