/**
 * Global reference to Animation Playback Controller
 *
 * This allows keyboard shortcuts to access the playback controller
 * without needing Svelte context.
 *
 * Set by AnimationSheetCoordinator when it mounts, cleared when it unmounts.
 */

import type { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
let playbackControllerRef: AnimationPlaybackController | null = null;

export function setAnimationPlaybackRef(
  controller: AnimationPlaybackController | null
) {
  playbackControllerRef = controller;
}

export function getAnimationPlaybackRef(): AnimationPlaybackController | null {
  return playbackControllerRef;
}
