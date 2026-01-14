/**
 * Global State Sync Manager
 *
 * Syncs local component state to global application state.
 * Handles: panel open state, layout state, animation beat number.
 */

import {
  setAnyPanelOpen,
  setSideBySideLayout,
} from "$lib/shared/application/state/animation-visibility-state.svelte";
import { sharedAnimationState } from "$lib/shared/animation-engine/state/shared-animation-state.svelte";
import type { PanelCoordinationState } from "../panel-coordination-state.svelte";

export interface GlobalStateSyncConfig {
  panelState: PanelCoordinationState;
  getShouldUseSideBySideLayout: () => boolean;
  setAnimatingBeatNumber: (beat: number | null) => void;
}

export function createGlobalStateSyncEffects(
  config: GlobalStateSyncConfig
): () => void {
  const { panelState, getShouldUseSideBySideLayout, setAnimatingBeatNumber } =
    config;

  const cleanup = $effect.root(() => {
    // Sync panel and layout states to global state
    $effect(() => {
      setAnyPanelOpen(panelState.isAnyPanelOpen);
      setSideBySideLayout(getShouldUseSideBySideLayout());
    });

    // Sync animating beat number from shared animation state
    // Only show the word label glow effect while animation is actively playing
    // When stopped/paused, clear the highlight so it doesn't persist after closing the drawer
    $effect(() => {
      if (sharedAnimationState.isPlaying) {
        const currentBeat = sharedAnimationState.currentBeat;
        setAnimatingBeatNumber(Math.floor(currentBeat));
      } else {
        setAnimatingBeatNumber(null);
      }
    });
  });

  return cleanup;
}
