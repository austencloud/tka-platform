import { getContext, setContext } from 'svelte';
import type { DrillDownState } from '../state/deck-drilldown-state.svelte';

const KEY = Symbol('deck-drilldown');

export function setDrillDownContext(state: DrillDownState) {
	setContext(KEY, state);
}

export function getDrillDownContext(): DrillDownState {
	return getContext<DrillDownState>(KEY);
}
