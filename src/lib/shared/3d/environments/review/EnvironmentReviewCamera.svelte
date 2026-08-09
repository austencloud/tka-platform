<script lang="ts">
  /** Shared fixed-shot and first-person camera for environment review routes. */
  import { T } from "@threlte/core";
  import {
    CAMERA_DEFAULTS,
    CameraMode,
    UnifiedCameraController,
    createKinematicPhysicsProvider,
    createViewerCameraPlayerState,
  } from "@austencloud/camera-3d";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import {
    DEFAULT_ENVIRONMENT_REVIEW_BOUNDS,
    resolveEnvironmentReviewWalkPose,
    type EnvironmentReviewBounds,
    type EnvironmentReviewCameraPreset,
  } from "./environment-review-camera";

  interface Props {
    destinationId: string;
    preset: EnvironmentReviewCameraPreset;
    walk?: boolean;
    walkBounds?: EnvironmentReviewBounds;
    maxOrbitDistance?: number;
  }

  let {
    destinationId,
    preset,
    walk = false,
    walkBounds = DEFAULT_ENVIRONMENT_REVIEW_BOUNDS,
    maxOrbitDistance = 70,
  }: Props = $props();

  const walkPose = resolveEnvironmentReviewWalkPose(preset);
  const cameraPlayer = createViewerCameraPlayerState({
    spawnX: walkPose.playerPosition.x,
    spawnY: walkPose.playerPosition.y,
    spawnZ: walkPose.playerPosition.z,
    initialFacing: walkPose.yaw,
  });
  const physicsProvider = createKinematicPhysicsProvider(
    cameraPlayer.avatarState.position as { x: number; y: number; z: number },
    {
      groundY: walkPose.playerPosition.y,
      bounds: walkBounds,
    }
  );
  const destinationDefaults = { [destinationId]: CameraMode.FIRST_PERSON };
</script>

{#if walk}
  <T.PerspectiveCamera
    makeDefault
    position={[preset.position[0], preset.position[1], preset.position[2]]}
    fov={preset.fov}
  />
  <UnifiedCameraController
    {destinationId}
    avatarState={cameraPlayer.avatarState}
    {physicsProvider}
    enabled
    initialYaw={walkPose.yaw}
    initialPitch={walkPose.pitch}
    allowedModes={[CameraMode.FIRST_PERSON]}
    disableModeToggle
    {destinationDefaults}
    moveSpeed={CAMERA_DEFAULTS.WALK_SPEED}
    sprintMultiplier={CAMERA_DEFAULTS.SPRINT_MULTIPLIER}
    jumpForce={CAMERA_DEFAULTS.JUMP_VELOCITY}
    gravity={CAMERA_DEFAULTS.GRAVITY}
  />
{:else}
  <T.PerspectiveCamera
    makeDefault
    position={[preset.position[0], preset.position[1], preset.position[2]]}
    fov={preset.fov}
  >
    <OrbitControls
      enableDamping
      target={[preset.target[0], preset.target[1], preset.target[2]]}
      minDistance={2}
      maxDistance={maxOrbitDistance}
      maxPolarAngle={Math.PI / 2 + 0.04}
    />
  </T.PerspectiveCamera>
{/if}
