import type { ArchiveState } from "./archive-state.svelte";

/**
 * Module-level bridge so ArchiveDestination (HTML overlays)
 * can access the archive state created inside WorldSceneContent (Threlte canvas).
 */
let activeArchiveState = $state<ArchiveState | null>(null);

export function setActiveArchiveState(state: ArchiveState | null) {
	activeArchiveState = state;
}

export function getActiveArchiveState(): ArchiveState | null {
	return activeArchiveState;
}
