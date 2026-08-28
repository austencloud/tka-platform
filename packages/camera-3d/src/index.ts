// Types
export {
  CameraMode,
  getNextCameraMode,
  isGameMode,
  resolveAllowedCameraMode,
  DEFAULT_CAMERA_CONFIG,
} from "./lib/types";

export type {
  Vector3,
  Rotation,
  CameraState,
  CameraConfig,
  PhysicsProvider,
  AvatarState,
  UnifiedCameraConfig,
  CameraPreset,
} from "./lib/types";

// Constants
export { CAMERA_DEFAULTS } from "./lib/constants";
export {
  CLEAN_FLY_INTERACTION,
  flushFlyInteraction,
  markFlyInteractionDirty,
} from "./lib/fly-interaction-dirty";
export type {
  FlyInteractionDirtyState,
  FlyInteractionKind,
} from "./lib/fly-interaction-dirty";
export { normalizeCameraFrameDelta } from "./lib/frame-delta";
export { resolveThrelteContextValue } from "./lib/threlte-context-value";

// Components
export { default as UnifiedCameraController } from "./lib/components/UnifiedCameraController.svelte";

// State management
export { createCameraPreferences } from "./lib/camera-preferences.svelte";
export type { CameraPreferences } from "./lib/camera-preferences.svelte";
export { getRecordingState } from "./lib/recording-state.svelte";
export { createViewerCameraPlayerState } from "./lib/viewer-camera-player-state.svelte";
export type { ViewerCameraPlayerOptions } from "./lib/viewer-camera-player-state.svelte";

// Physics providers
export { createFlycamPhysicsProvider } from "./lib/flycam-physics-provider";
export { createKinematicPhysicsProvider } from "./lib/kinematic-physics-provider";
export type { KinematicConfig } from "./lib/kinematic-physics-provider";

// Input capabilities
export { createInputCapabilities } from "./lib/input-capabilities";
export type { InputCapabilities } from "./lib/input-capabilities";

// Framework-agnostic controller
export { CameraMovementController } from "./lib/services/CameraMovementController";
export type {
  MovementInput,
  LookInput,
  CameraMovementState,
  CameraMovementConfig,
} from "./lib/services/CameraMovementController";
