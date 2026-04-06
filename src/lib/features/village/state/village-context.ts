import { getContext, setContext } from "svelte";
import type { VillageState } from "./village-state.svelte";
import type { VillageVisualState } from "./village-visual-state.svelte";

const VILLAGE_CONTEXT_KEY = "village-state";
const VILLAGE_VISUAL_CONTEXT_KEY = "village-visual-state";

export function setVillageContext(state: VillageState): void {
	setContext(VILLAGE_CONTEXT_KEY, state);
}

export function getVillageContext(): VillageState {
	return getContext<VillageState>(VILLAGE_CONTEXT_KEY);
}

export function setVillageVisualContext(state: VillageVisualState): void {
	setContext(VILLAGE_VISUAL_CONTEXT_KEY, state);
}

export function getVillageVisualContext(): VillageVisualState {
	return getContext<VillageVisualState>(VILLAGE_VISUAL_CONTEXT_KEY);
}
