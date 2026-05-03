/**
 * ICameraChoreographer Contract
 *
 * Service for managing beat-synchronized camera choreography.
 * Handles keyframe interpolation, performer following, and playback integration.
 */

import type {
  CameraKeyframe,
  CameraState,
  CameraPosition,
} from "../../domain/camera-choreography";

/**
 * Performer position provider for follow mode
 */
export interface PerformerPositionProvider {
  getPosition(index: number): CameraPosition | null;
}

/**
 * Callback for camera state changes
 */
export type CameraStateChangeCallback = (state: CameraState) => void;

/**
 * Callback for keyframe events
 */
export type KeyframeEventCallback = (keyframe: CameraKeyframe) => void;

// ICameraChoreographer interface retired — createCameraChoreographer() return type is the contract now.
