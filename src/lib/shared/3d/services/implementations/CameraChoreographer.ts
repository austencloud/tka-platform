/**
 * CameraChoreographer Implementation
 *
 * Manages beat-synchronized camera movement with keyframe interpolation.
 * Uses factory function pattern for per-instance state (not injectable).
 */

import type {
  CameraChoreography,
  CameraKeyframe,
  CameraState,
  CameraPosition,
} from "../../domain/camera-choreography";

import {
  createCameraKeyframe,
  createDefaultCameraState,
  lerpCameraState,
  getKeyframeStepTime,
  sortKeyframesByTime,
  findSurroundingKeyframes,
  lerpCameraPosition,
} from "../../domain/camera-choreography";

import type {
  PerformerPositionProvider,
  CameraStateChangeCallback,
  KeyframeEventCallback,
} from "../contracts/types";

/**
 * Create a CameraChoreographer instance
 */
export function createCameraChoreographer() {
  // Internal state
  let choreography: CameraChoreography | null = null;
  let currentState: CameraState = createDefaultCameraState();
  let activeKeyframe: CameraKeyframe | null = null;
  let nextKeyframe: CameraKeyframe | null = null;
  let transitionProgress = 0;
  let lastReachedKeyframeId: string | null = null;

  // Callbacks
  const stateChangeCallbacks = new Set<CameraStateChangeCallback>();
  const keyframeReachedCallbacks = new Set<KeyframeEventCallback>();

  /**
   * Notify state change subscribers
   */
  function notifyStateChange(): void {
    for (const callback of stateChangeCallbacks) {
      callback(currentState);
    }
  }

  /**
   * Notify keyframe reached subscribers
   */
  function notifyKeyframeReached(keyframe: CameraKeyframe): void {
    for (const callback of keyframeReachedCallbacks) {
      callback(keyframe);
    }
  }

  /**
   * Apply performer follow offset to a position
   */
  function applyFollowOffset(
    keyframe: CameraKeyframe,
    performerProvider: PerformerPositionProvider
  ): { position: CameraPosition; target: CameraPosition } | null {
    if (keyframe.followPerformer === undefined || keyframe.followPerformer < 0) {
      return null;
    }

    const performerPos = performerProvider.getPosition(keyframe.followPerformer);
    if (!performerPos) {
      return null;
    }

    // Default follow offset in meters: 1m up, 2m back
    const offset = keyframe.followOffset ?? { x: 0, y: 1.0, z: 2.0 };

    return {
      position: {
        x: performerPos.x + offset.x,
        y: performerPos.y + offset.y,
        z: performerPos.z + offset.z,
      },
      target: {
        x: performerPos.x,
        y: performerPos.y + 0.5, // Look at performer chest height (0.5m above position)
        z: performerPos.z,
      },
    };
  }

  /**
   * Calculate camera state for a beat time
   */
  function calculateStateForStep(
    stepTime: number,
    performerProvider?: PerformerPositionProvider
  ): CameraState {
    if (!choreography || choreography.keyframes.length === 0) {
      return createDefaultCameraState(choreography ?? undefined);
    }

    const { previous, next } = findSurroundingKeyframes(choreography.keyframes, stepTime);

    // Update active/next keyframe references
    activeKeyframe = previous;
    nextKeyframe = next;

    // Check if we've reached a new keyframe
    if (previous && previous.id !== lastReachedKeyframeId) {
      const prevTime = getKeyframeStepTime(previous);
      if (Math.abs(stepTime - prevTime) < 0.01) {
        lastReachedKeyframeId = previous.id;
        notifyKeyframeReached(previous);
      }
    }

    // No keyframes yet - use default
    if (!previous) {
      if (next) {
        // Before first keyframe - use first keyframe's position
        const followResult = performerProvider
          ? applyFollowOffset(next, performerProvider)
          : null;

        return {
          position: followResult?.position ?? { ...next.position },
          target: followResult?.target ?? { ...next.target },
          fov: next.fov ?? choreography.defaultFov,
          isAnimating: false,
          currentKeyframeId: undefined,
          nextKeyframeId: next.id,
          progress: 0,
        };
      }

      return createDefaultCameraState(choreography);
    }

    // At or past the last keyframe
    if (!next) {
      const followResult = performerProvider
        ? applyFollowOffset(previous, performerProvider)
        : null;

      transitionProgress = 0;

      return {
        position: followResult?.position ?? { ...previous.position },
        target: followResult?.target ?? { ...previous.target },
        fov: previous.fov ?? choreography.defaultFov,
        isAnimating: false,
        currentKeyframeId: previous.id,
        nextKeyframeId: undefined,
        progress: 0,
      };
    }

    // Between two keyframes - interpolate
    const prevTime = getKeyframeStepTime(previous);
    const nextTime = getKeyframeStepTime(next);
    const duration = nextTime - prevTime;

    transitionProgress = duration > 0 ? (stepTime - prevTime) / duration : 0;
    transitionProgress = Math.max(0, Math.min(1, transitionProgress));

    // Get base interpolated state
    const interpolated = lerpCameraState(previous, next, transitionProgress);

    // Apply follow offsets if applicable
    let finalPosition = interpolated.position!;
    let finalTarget = interpolated.target!;

    if (performerProvider) {
      const prevFollow = applyFollowOffset(previous, performerProvider);
      const nextFollow = applyFollowOffset(next, performerProvider);

      if (prevFollow && nextFollow) {
        // Both keyframes follow performers - interpolate between follow positions
        finalPosition = lerpCameraPosition(
          prevFollow.position,
          nextFollow.position,
          transitionProgress
        );
        finalTarget = lerpCameraPosition(
          prevFollow.target,
          nextFollow.target,
          transitionProgress
        );
      } else if (prevFollow) {
        // Transitioning from follow to fixed
        finalPosition = lerpCameraPosition(
          prevFollow.position,
          next.position,
          transitionProgress
        );
        finalTarget = lerpCameraPosition(
          prevFollow.target,
          next.target,
          transitionProgress
        );
      } else if (nextFollow) {
        // Transitioning from fixed to follow
        finalPosition = lerpCameraPosition(
          previous.position,
          nextFollow.position,
          transitionProgress
        );
        finalTarget = lerpCameraPosition(
          previous.target,
          nextFollow.target,
          transitionProgress
        );
      }
    }

    return {
      position: finalPosition,
      target: finalTarget,
      fov: interpolated.fov!,
      isAnimating: transitionProgress > 0 && transitionProgress < 1,
      currentKeyframeId: previous.id,
      nextKeyframeId: next.id,
      progress: transitionProgress,
    };
  }

  // Return the choreographer interface
  const choreographer = {
    // Choreography Management
    loadChoreography(newChoreography: CameraChoreography): void {
      choreography = {
        ...newChoreography,
        keyframes: sortKeyframesByTime(newChoreography.keyframes),
      };
      currentState = createDefaultCameraState(choreography);
      activeKeyframe = null;
      nextKeyframe = null;
      transitionProgress = 0;
      lastReachedKeyframeId = null;
      notifyStateChange();
    },

    clearChoreography(): void {
      choreography = null;
      currentState = createDefaultCameraState();
      activeKeyframe = null;
      nextKeyframe = null;
      transitionProgress = 0;
      lastReachedKeyframeId = null;
      notifyStateChange();
    },

    get choreography() {
      return choreography;
    },

    get hasChoreography() {
      return choreography !== null;
    },

    // Playback Integration
    updateForStep(
      stepNumber: number,
      stepProgress: number,
      performerProvider?: PerformerPositionProvider
    ): CameraState {
      const stepTime = stepNumber + stepProgress;
      currentState = calculateStateForStep(stepTime, performerProvider);
      notifyStateChange();
      return currentState;
    },

    get currentState() {
      return currentState;
    },

    get isAnimating() {
      return currentState.isAnimating;
    },

    // Keyframe Editing
    addKeyframe(keyframe: CameraKeyframe): void {
      if (!choreography) return;

      choreography = {
        ...choreography,
        keyframes: sortKeyframesByTime([...choreography.keyframes, keyframe]),
        updatedAt: new Date(),
      };
    },

    updateKeyframe(id: string, updates: Partial<Omit<CameraKeyframe, "id">>): void {
      if (!choreography) return;

      const index = choreography.keyframes.findIndex((kf) => kf.id === id);
      if (index === -1) return;

      const existing = choreography.keyframes[index]!;
      const updated: CameraKeyframe = {
        ...existing,
        ...updates,
        id: existing.id, // Preserve ID
      };

      const newKeyframes = [...choreography.keyframes];
      newKeyframes[index] = updated;

      choreography = {
        ...choreography,
        keyframes: sortKeyframesByTime(newKeyframes),
        updatedAt: new Date(),
      };
    },

    removeKeyframe(id: string): void {
      if (!choreography) return;

      choreography = {
        ...choreography,
        keyframes: choreography.keyframes.filter((kf) => kf.id !== id),
        updatedAt: new Date(),
      };
    },

    getKeyframe(id: string): CameraKeyframe | null {
      return choreography?.keyframes.find((kf) => kf.id === id) ?? null;
    },

    get keyframes() {
      return choreography?.keyframes ?? [];
    },

    captureKeyframe(
      stepNumber: number,
      currentPosition: CameraPosition,
      currentTarget: CameraPosition
    ): CameraKeyframe {
      const keyframe = createCameraKeyframe(stepNumber, currentPosition, currentTarget);

      if (choreography) {
        this.addKeyframe(keyframe);
      }

      return keyframe;
    },

    // State Queries
    get activeKeyframe() {
      return activeKeyframe;
    },

    get nextKeyframe() {
      return nextKeyframe;
    },

    get transitionProgress() {
      return transitionProgress;
    },

    // Events
    onStateChange(callback: CameraStateChangeCallback): () => void {
      stateChangeCallbacks.add(callback);
      return () => stateChangeCallbacks.delete(callback);
    },

    onKeyframeReached(callback: KeyframeEventCallback): () => void {
      keyframeReachedCallbacks.add(callback);
      return () => keyframeReachedCallbacks.delete(callback);
    },
  };

  return choreographer;
}
