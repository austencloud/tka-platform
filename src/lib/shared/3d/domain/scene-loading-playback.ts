export interface SceneLoadingPlaybackTransition {
  held: boolean;
  syncTo: boolean | null;
}

/**
 * Hold the shared clock behind the first-load curtain, then restore it once.
 * `syncTo` is desired state, not a user toggle, so hosts can keep it out of the
 * intent counter while retaining a truthful semantic playback event.
 */
export function sceneLoadingPlaybackTransition(input: {
  sceneReady: boolean;
  isPlaying: boolean;
  held: boolean;
}): SceneLoadingPlaybackTransition {
  if (input.sceneReady && input.held) {
    return { held: false, syncTo: true };
  }
  if (!input.sceneReady && input.isPlaying && !input.held) {
    return { held: true, syncTo: false };
  }
  return { held: input.held, syncTo: null };
}
