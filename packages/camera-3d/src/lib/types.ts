export enum CameraMode {
  ORBIT = "orbit",
  FIRST_PERSON = "first_person",
  THIRD_PERSON = "third_person",
}

/**
 * Keep a persisted camera preference inside the modes a destination supports.
 *
 * A destination that only exposes first person must not wake up in a stale
 * orbit preference. In game scenes that is more than a camera mismatch: orbit
 * mode deliberately disables character movement.
 */
export function resolveAllowedCameraMode(
  preferred: CameraMode,
  allowedModes?: readonly CameraMode[]
): CameraMode {
  if (!allowedModes || allowedModes.length === 0) return preferred;
  return allowedModes.includes(preferred) ? preferred : allowedModes[0]!;
}

export function getNextCameraMode(current: CameraMode): CameraMode {
  switch (current) {
    case CameraMode.ORBIT:
      return CameraMode.THIRD_PERSON;
    case CameraMode.THIRD_PERSON:
      return CameraMode.FIRST_PERSON;
    case CameraMode.FIRST_PERSON:
      return CameraMode.ORBIT;
  }
}

export function isGameMode(mode: CameraMode): boolean {
  return mode === CameraMode.THIRD_PERSON || mode === CameraMode.FIRST_PERSON;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  yaw: number;
  pitch: number;
}

export interface CameraState {
  mode: CameraMode;
  position: Vector3;
  rotation: Rotation;
  target: Vector3 | null;
  isTransitioning: boolean;
  transitionProgress: number;
}

export interface CameraConfig {
  eyeHeight: number;
  mouseSensitivity: number;
  lookAngleLimitDown: number;
  lookAngleLimitUp: number;
  distance: number;
  height: number;
  positionDamping: number;
  minPitch: number;
  maxPitch: number;
  blendDuration: number;
  fovTransition: boolean;
  fovFirstPerson: number;
  fovThirdPerson: number;
}

export interface PhysicsProvider {
  movePlayer(desiredMovement: Vector3, deltaTime: number): void;
  getPlayerPosition(): Vector3;
  isGrounded(): boolean;
  getVelocity(): Vector3;
  applyRootMotion?(worldDelta: { x: number; z: number }): void;
  teleport?(position: Vector3): void;
  toggleNoclip?(): boolean;
  isNoclipEnabled?(): boolean;
  setNoclip?(enabled: boolean): void;
  setCrouch?(crouching: boolean): void;
}

export interface AvatarState {
  position: { x: number; y?: number; z: number };
  facingAngle: number;
  isMoving: boolean;
  isCrouching?: boolean;
  moveDirection?: { x: number; z: number };
  setMoveInput: (input: { x: number; z: number }) => void;
  updateMovement: (delta: number, cameraAngle: number) => void;
  setFacingAngle: (angle: number) => void;
  snapFacingAngle?: (angle: number) => void;
  updateLocomotion?: (delta: number) => void;
}

export interface UnifiedCameraConfig {
  lookSensitivity?: number;
  thirdPerson?: {
    distance?: number;
    height?: number;
    lookAtHeight?: number;
    minPitch?: number;
    maxPitch?: number;
  };
  firstPerson?: {
    height?: number;
    forwardOffset?: number;
    minPitch?: number;
    maxPitch?: number;
  };
  orbit?: {
    minDistance?: number;
    maxDistance?: number;
    minPitch?: number;
    maxPitch?: number;
    dragSensitivity?: number;
    zoomSpeed?: number;
    height?: number;
  };
  movement?: {
    walkSpeed?: number;
    sprintMultiplier?: number;
    jumpForce?: number;
    gravity?: number;
  };
}

export interface CameraPreset {
  name: string;
  position: Vector3;
  rotation: Rotation;
  fov?: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  eyeHeight: 1.6,
  mouseSensitivity: 0.002,
  lookAngleLimitDown: -Math.PI / 2 + 0.1,
  lookAngleLimitUp: Math.PI / 2 - 0.1,
  distance: 3.0,
  height: 2.0,
  positionDamping: 0.1,
  minPitch: -0.2,
  maxPitch: 1.2,
  blendDuration: 0.3,
  fovTransition: true,
  fovFirstPerson: 75,
  fovThirdPerson: 60,
};
