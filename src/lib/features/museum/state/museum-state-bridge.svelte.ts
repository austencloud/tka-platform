/**
 * Module-level bridge for sharing museum state between WorldSceneContent (3D)
 * and MuseumDestination (HTML overlays).
 *
 * Only one museum can be active at a time, so a module-level reference is safe.
 */
import type { MuseumState } from "./museum-state.svelte";

let activeMuseumState: MuseumState | null = $state(null);

export function setActiveMuseumState(state: MuseumState | null) {
  activeMuseumState = state;
}

export function getActiveMuseumState(): MuseumState | null {
  return activeMuseumState;
}
