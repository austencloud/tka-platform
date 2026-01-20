/**
 * Camera Choreography Domain Model
 *
 * Defines keyframe-based camera movement tied to sequence playback.
 * Camera positions can follow performers or be fixed in space.
 */

/**
 * 3D position for camera
 */
export interface CameraPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Camera interpolation mode between keyframes
 */
export type CameraInterpolation =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "cubic-bezier";

/**
 * A single camera keyframe defining camera state at a point in time
 */
export interface CameraKeyframe {
  id: string;

  // Timing (beat-based for sync with sequence)
  stepNumber: number;
  stepOffset: number; // Fraction within beat (0-1)

  // Camera state
  position: CameraPosition;
  target: CameraPosition; // lookAt point
  fov?: number; // Field of view in degrees (default 60)

  // Transition to next keyframe
  interpolation: CameraInterpolation;

  // Optional: follow a performer
  followPerformer?: number; // Index of performer to follow (-1 or undefined = none)
  followOffset?: CameraPosition; // Offset from performer position
}

/**
 * Complete camera choreography definition
 */
export interface CameraChoreography {
  id: string;
  name: string;
  description?: string;

  // Keyframes sorted by beat time
  keyframes: CameraKeyframe[];

  // Default camera when no keyframes active or before first keyframe
  defaultPosition: CameraPosition;
  defaultTarget: CameraPosition;
  defaultFov: number;

  // Metadata
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: string;
}

/**
 * Current camera state (output of choreographer)
 */
export interface CameraState {
  position: CameraPosition;
  target: CameraPosition;
  fov: number;
  isAnimating: boolean;
  currentKeyframeId?: string;
  nextKeyframeId?: string;
  progress: number; // 0-1 progress between keyframes
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new camera keyframe
 */
export function createCameraKeyframe(
  stepNumber: number,
  position: CameraPosition,
  target: CameraPosition,
  options: Partial<Omit<CameraKeyframe, "id" | "stepNumber" | "position" | "target">> = {}
): CameraKeyframe {
  return {
    id: `keyframe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stepNumber,
    stepOffset: options.stepOffset ?? 0,
    position: { ...position },
    target: { ...target },
    fov: options.fov ?? 60,
    interpolation: options.interpolation ?? "ease-in-out",
    followPerformer: options.followPerformer,
    followOffset: options.followOffset ? { ...options.followOffset } : undefined,
  };
}

/**
 * Create a new camera choreography
 */
export function createCameraChoreography(
  name: string,
  defaultPosition: CameraPosition,
  defaultTarget: CameraPosition,
  options: Partial<Omit<CameraChoreography, "id" | "name" | "defaultPosition" | "defaultTarget" | "keyframes">> = {}
): CameraChoreography {
  return {
    id: `choreography-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: options.description,
    keyframes: [],
    defaultPosition: { ...defaultPosition },
    defaultTarget: { ...defaultTarget },
    defaultFov: options.defaultFov ?? 60,
    createdAt: options.createdAt ?? new Date(),
    updatedAt: options.updatedAt,
    createdBy: options.createdBy,
  };
}

/**
 * Create default camera state
 */
export function createDefaultCameraState(
  choreography?: CameraChoreography
): CameraState {
  if (choreography) {
    return {
      position: { ...choreography.defaultPosition },
      target: { ...choreography.defaultTarget },
      fov: choreography.defaultFov,
      isAnimating: false,
      progress: 0,
    };
  }

  // Fallback defaults in meters (standard perspective view)
  return {
    position: { x: 0, y: 1.0, z: 3.0 },  // 1m up, 3m back
    target: { x: 0, y: 0.5, z: 0 },       // Looking at 0.5m height (waist)
    fov: 60,
    isAnimating: false,
    progress: 0,
  };
}

// ============================================
// Interpolation Functions
// ============================================

/**
 * Easing functions for camera transitions
 */
export const easingFunctions: Record<CameraInterpolation, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => t * (2 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  "cubic-bezier": (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

/**
 * Interpolate between two camera positions
 */
export function lerpCameraPosition(
  from: CameraPosition,
  to: CameraPosition,
  t: number
): CameraPosition {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

/**
 * Interpolate between two camera states
 */
export function lerpCameraState(
  from: CameraKeyframe,
  to: CameraKeyframe,
  rawProgress: number
): Partial<CameraState> {
  const easing = easingFunctions[to.interpolation] ?? easingFunctions.linear;
  const t = easing(Math.max(0, Math.min(1, rawProgress)));

  return {
    position: lerpCameraPosition(from.position, to.position, t),
    target: lerpCameraPosition(from.target, to.target, t),
    fov: (from.fov ?? 60) + ((to.fov ?? 60) - (from.fov ?? 60)) * t,
  };
}

/**
 * Get the beat time (stepNumber + stepOffset) for a keyframe
 */
export function getKeyframeStepTime(keyframe: CameraKeyframe): number {
  return keyframe.stepNumber + keyframe.stepOffset;
}

/**
 * Sort keyframes by beat time
 */
export function sortKeyframesByTime(keyframes: CameraKeyframe[]): CameraKeyframe[] {
  return [...keyframes].sort((a, b) => getKeyframeStepTime(a) - getKeyframeStepTime(b));
}

/**
 * Find keyframes surrounding a given beat time
 */
export function findSurroundingKeyframes(
  keyframes: CameraKeyframe[],
  stepTime: number
): { previous: CameraKeyframe | null; next: CameraKeyframe | null } {
  const sorted = sortKeyframesByTime(keyframes);

  let previous: CameraKeyframe | null = null;
  let next: CameraKeyframe | null = null;

  for (const kf of sorted) {
    const kfTime = getKeyframeStepTime(kf);
    if (kfTime <= stepTime) {
      previous = kf;
    } else {
      next = kf;
      break;
    }
  }

  return { previous, next };
}
