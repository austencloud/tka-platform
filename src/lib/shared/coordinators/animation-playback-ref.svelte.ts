/**
 * Global reference to Animation Playback Controller
 *
 * This allows keyboard shortcuts to access the playback controller
 * without needing Svelte context.
 *
 * Set by AnimationSheetCoordinator when it mounts, cleared when it unmounts.
 */

import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";

let playbackControllerRef: IAnimationPlaybackController | null = null;

export function setAnimationPlaybackRef(
  controller: IAnimationPlaybackController | null
) {
  playbackControllerRef = controller;
}

export function getAnimationPlaybackRef(): IAnimationPlaybackController | null {
  return playbackControllerRef;
}
