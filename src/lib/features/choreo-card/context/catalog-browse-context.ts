import { getContext, setContext } from 'svelte';
import type { CatalogBrowseState } from '../state/catalog-browse-state.svelte';

const KEY = Symbol('catalog-browse');

export function setBrowseContext(state: CatalogBrowseState): void {
  setContext(KEY, state);
}

export function getBrowseContext(): CatalogBrowseState {
  return getContext<CatalogBrowseState>(KEY);
}
