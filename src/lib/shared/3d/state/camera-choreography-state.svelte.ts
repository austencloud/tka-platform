/**
 * Camera Choreography State
 *
 * Svelte 5 runes-based state for camera choreography.
 * Manages playback integration and provides reactive camera state.
 */

import type {
  CameraChoreography,
  CameraState,
  CameraPosition,
  PerformerPositionProvider,
} from "@austencloud/scene-3d";

import {
  createCameraChoreography,
  createDefaultCameraState,
  createCameraChoreographer,
} from "@austencloud/scene-3d";

/**
 * Create camera choreography state with Svelte 5 reactivity
 */
export function createCameraChoreographyState() {
  // Internal choreographer instance
  const choreographer = createCameraChoreographer();

  // Reactive state
  let isEnabled = $state(false);
  let cameraState = $state<CameraState>(createDefaultCameraState());
  let isRecording = $state(false);

  // Derived state
  const hasChoreography = $derived(choreographer.hasChoreography);
  const keyframeCount = $derived(choreographer.keyframes.length);
  const isAnimating = $derived(cameraState.isAnimating);

  /**
   * Enable/disable choreographed camera (vs orbit controls)
   */
  function setEnabled(enabled: boolean) {
    isEnabled = enabled;
  }

  /**
   * Toggle choreographed camera mode
   */
  function toggle() {
    isEnabled = !isEnabled;
  }

  function loadChoreography(choreography: CameraChoreography) {
    choreographer.loadChoreography(choreography);
    cameraState = choreographer.currentState;
  }

  function clearChoreography() {
    choreographer.clearChoreography();
    cameraState = createDefaultCameraState();
    isEnabled = false;
  }

  /**
   * Create a new empty choreography
   */
  function createNew(name: string) {
    // Default camera position in meters: 3m back, 1m up; looking at 0.5m height
    const choreography = createCameraChoreography(
      name,
      { x: 0, y: 1.0, z: 3.0 },
      { x: 0, y: 0.5, z: 0 }
    );
    choreographer.loadChoreography(choreography);
    cameraState = choreographer.currentState;
  }

  /**
   * Update camera state for current playback position
   * Call this each frame when choreography is enabled
   */
  function updateForStep(
    stepNumber: number,
    stepProgress: number,
    performerProvider?: PerformerPositionProvider
  ) {
    if (!isEnabled || !choreographer.hasChoreography) return;

    cameraState = choreographer.updateForStep(
      stepNumber,
      stepProgress,
      performerProvider
    );
  }

  function addKeyframe(
    stepNumber: number,
    position: CameraPosition,
    target: CameraPosition
  ) {
    choreographer.captureKeyframe(stepNumber, position, target);
  }

  function removeKeyframe(id: string) {
    choreographer.removeKeyframe(id);
  }

  /**
   * Start recording mode (keyframes added on beat changes)
   */
  function startRecording() {
    isRecording = true;
  }

  function stopRecording() {
    isRecording = false;
  }

  function getChoreography(): CameraChoreography | null {
    return choreographer.choreography;
  }

  return {
    // State
    get isEnabled() {
      return isEnabled;
    },
    get cameraState() {
      return cameraState;
    },
    get hasChoreography() {
      return hasChoreography;
    },
    get keyframeCount() {
      return keyframeCount;
    },
    get isAnimating() {
      return isAnimating;
    },
    get isRecording() {
      return isRecording;
    },
    get keyframes() {
      return choreographer.keyframes;
    },
    get activeKeyframe() {
      return choreographer.activeKeyframe;
    },
    get nextKeyframe() {
      return choreographer.nextKeyframe;
    },
    get transitionProgress() {
      return choreographer.transitionProgress;
    },

    // Methods
    setEnabled,
    toggle,
    loadChoreography,
    clearChoreography,
    createNew,
    updateForStep,
    addKeyframe,
    removeKeyframe,
    startRecording,
    stopRecording,
    getChoreography,

    // Direct choreographer access for advanced use
    get choreographer() {
      return choreographer;
    },
  };
}

export type CameraChoreographyState = ReturnType<typeof createCameraChoreographyState>;
