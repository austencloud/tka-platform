import { getContext, setContext } from "svelte";
import type { VillageState } from "./village-state.svelte";

const VILLAGE_CONTEXT_KEY = "village-state";

export function setVillageContext(state: VillageState): void {
	setContext(VILLAGE_CONTEXT_KEY, state);
}

export function getVillageContext(): VillageState {
	return getContext<VillageState>(VILLAGE_CONTEXT_KEY);
}
