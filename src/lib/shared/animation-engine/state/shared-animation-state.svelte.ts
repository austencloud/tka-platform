/**
 * Shared Animation State
 *
 * Minimal global singleton for cross-component animation synchronization.
 * Only exposes the two fields actually read by consumers:
 * - currentStep: used by GlobalStateSyncManager to highlight step grid
 * - isPlaying: used by GlobalStateSyncManager to detect active playback
 *
 * Replaces a full AnimationPanelState singleton that carried persistence
 * effects, observer machinery, and localStorage auto-save for fields
 * that were never read (speed, loop, export settings, etc).
 */

/**
 * Minimal playback state for cross-component synchronization
 */
export interface MinimalPlaybackState {
  readonly currentStep: number;
  readonly isPlaying: boolean;
  setCurrentStep: (step: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

function createMinimalPlaybackState(): MinimalPlaybackState {
  let currentStep = $state(0);
  let isPlaying = $state(false);

  return {
    get currentStep() {
      return currentStep;
    },
    get isPlaying() {
      return isPlaying;
    },
    setCurrentStep: (step: number) => {
      currentStep = step;
    },
    setIsPlaying: (playing: boolean) => {
      isPlaying = playing;
    },
  };
}

/**
 * Global shared animation state instance.
 * Used by Create module's AnimationCoordinator
 * to keep step grid selection in sync with animation playback.
 */
export const sharedAnimationState = createMinimalPlaybackState();
