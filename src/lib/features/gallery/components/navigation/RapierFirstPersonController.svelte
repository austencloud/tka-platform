<script lang="ts">
  /**
   * RapierFirstPersonController
   *
   * Physics-based FPS controller using Rapier character controller.
   * Uses shared 3D primitives for input and camera handling.
   *
   * Shared primitives used:
   * - AdaptiveInputProvider: Unified keyboard/touch/pointer lock input
   * - CameraController: Camera rotation with behaviors
   * - VirtualJoystick: Touch movement control
   *
   * Gallery-specific features:
   * - Rapier physics for movement/collision
   * - Room graph navigation
   * - Multiplayer sync callbacks
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import { PerspectiveCamera, Vector3 } from "three";
  import type { GalleryLayout } from "../../domain/models/GalleryLayout";
  import {
    PLAYER_EYE_HEIGHT,
    PLAYER_MOVE_SPEED,
    LOOK_ANGLE_LIMIT,
    SPRINT_MULTIPLIER,
  } from "../../domain/constants/gallery-dimensions";
  import { CameraMode } from "$lib/shared/3d-core/camera/types";
  import { cameraPreferences } from "$lib/shared/3d-core/camera/camera-preferences.svelte";
  import {
    createPhysicsWorldState,
    initPhysicsWorld,
    disposePhysicsWorld,
  } from "$lib/shared/3d-core/physics/rapier-world";
  import {
    createPlayerController,
    disposePlayerController,
    movePlayer,
  } from "$lib/shared/3d-core/physics/player-controller";
  import type { PhysicsWorldState, PlayerControllerState } from "$lib/shared/3d-core/physics/types";
  import { findRoomAtPointWithHint } from "../../domain/models/RoomGraph";
  import {
    createGalleryWallColliders,
    createGalleryFloorCollider,
    removeColliders,
  } from "../../services/implementations/GalleryPhysicsColliderGenerator";
  import type RAPIER from "@dimforge/rapier3d-compat";

  // Shared 3D primitives
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import { AdaptiveInputProvider } from "$lib/shared/3d/input/InputProviderFactory";
  import { CameraController } from "$lib/shared/3d/camera/CameraController";
  import { FirstPersonLook } from "$lib/shared/3d/camera/behaviors/FirstPersonLook";
  import { CameraDamping } from "$lib/shared/3d/camera/behaviors/CameraDamping";
  import { CameraConstraints } from "$lib/shared/3d/camera/behaviors/CameraConstraints";
  import VirtualJoystick from "$lib/shared/components/touch/VirtualJoystick.svelte";

  // Third person camera settings
  const THIRD_PERSON_DISTANCE = 5;
  const THIRD_PERSON_HEIGHT = 2;

  // Gravity constants
  const GRAVITY = 20;
  const TERMINAL_VELOCITY = -50;

  interface Props {
    /** Gallery layout (used for room detection) */
    layout: GalleryLayout;
    /** Current player position (updated by this component) */
    position: { x: number; y: number; z: number };
    /** Current room ID the player is in */
    currentRoomId: string;
    /** Callback when position changes */
    onPositionChange: (pos: { x: number; y: number; z: number }) => void;
    /** Callback when room changes */
    onRoomChange: (roomId: string) => void;
    /** Callback when rotation changes (for multiplayer sync) */
    onRotationChange?: (rotation: { yaw: number; pitch: number }) => void;
    /** Callback when locomotion state changes (for multiplayer avatar animation) */
    onLocomotionChange?: (locomotion: { isMoving: boolean; moveDirection: number; moveSpeed: number }) => void;
    /** Whether controls are enabled */
    enabled?: boolean;
    /** Initial yaw angle (radians) */
    initialYaw?: number;
    /** Field of view in degrees */
    fov?: number;
    /** Mouse sensitivity multiplier */
    mouseSensitivity?: number;
  }

  let {
    layout,
    position,
    currentRoomId,
    onPositionChange,
    onRoomChange,
    onRotationChange,
    onLocomotionChange,
    enabled = true,
    initialYaw = Math.PI,
    fov = 75,
    mouseSensitivity = 1.0,
  }: Props = $props();

  // Shared input capabilities
  const inputCaps = getInputCapabilities();

  // Unified input provider
  let inputProvider: AdaptiveInputProvider | null = null;

  // Camera controller with behaviors
  let cameraController: CameraController | null = null;

  // Camera reference
  let camera = $state<PerspectiveCamera | undefined>(undefined);

  // Physics state
  let physicsState: PhysicsWorldState | null = $state(null);
  let playerController: PlayerControllerState | null = $state(null);
  let wallColliders: RAPIER.Collider[] = [];
  let floorCollider: RAPIER.Collider | null = null;

  // Camera mode (1st person <-> 3rd person with V key)
  let cameraMode = $state<CameraMode>(
    cameraPreferences.getModeForDestination("gallery")
  );

  // Show touch UI when needed
  let showTouchUI = $state(false);

  // Touch joystick input
  let joystickInput = $state({ x: 0, z: 0 });

  // Vertical velocity for gravity
  let verticalVelocity = $state(0);

  // Track initialization
  let initialized = false;

  // Handle joystick input from VirtualJoystick
  function handleJoystickInput(x: number, y: number) {
    joystickInput = { x, z: y };
  }

  // V key handler for camera mode toggle
  function handleKeyDown(e: KeyboardEvent) {
    if (!enabled) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key.toLowerCase() === "v") {
      // Gallery only supports 1st/3rd person (no orbit view)
      const newMode = cameraMode === CameraMode.FIRST_PERSON
        ? CameraMode.THIRD_PERSON
        : CameraMode.FIRST_PERSON;
      cameraPreferences.setModeForDestination("gallery", newMode);
      cameraMode = newMode;
      e.preventDefault();
    }
  }

  // Reusable vectors
  const forward = new Vector3();
  const right = new Vector3();
  const moveDirection = new Vector3();

  // Initialize physics
  onMount(async () => {
    // Initialize input capabilities
    inputCaps.init();

    // Get canvas for input provider
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    // Create unified input provider
    inputProvider = new AdaptiveInputProvider(inputCaps, canvas, {
      lookSensitivity: 0.002 * mouseSensitivity,
      movementDeadzone: 0.15,
      inertiaDecay: 0.92,
    });
    inputProvider.enable();

    // Create camera controller
    cameraController = new CameraController({
      initialYaw: initialYaw,
      initialPitch: 0,
      initialDistance: THIRD_PERSON_DISTANCE,
    });

    // Add first-person look behavior
    cameraController.addBehavior(new FirstPersonLook({
      sensitivity: 1.0,
      maxPitch: LOOK_ANGLE_LIMIT,
      minPitch: -LOOK_ANGLE_LIMIT,
    }));

    // Add constraints
    cameraController.addBehavior(new CameraConstraints({
      maxPitch: LOOK_ANGLE_LIMIT,
      minPitch: -LOOK_ANGLE_LIMIT,
    }));

    // Add damping for smooth camera
    cameraController.addBehavior(new CameraDamping({
      positionSmoothTime: 0.08,
      rotationSmoothTime: 0.05,
    }));

    // Create physics world
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -20, z: 0 });

    // Create player controller
    const capsuleCenterY = position.y - (PLAYER_EYE_HEIGHT - 0.85);
    playerController = createPlayerController(physicsState, {
      position: { x: position.x, y: capsuleCenterY, z: position.z },
    });

    // Create colliders from gallery layout
    if (physicsState.rapier && physicsState.world) {
      const floor = createGalleryFloorCollider(
        physicsState,
        layout.floorSize.width,
        layout.floorSize.depth
      );
      if (floor) {
        floorCollider = floor;
      }

      wallColliders = createGalleryWallColliders(
        physicsState,
        layout.collisionWorld
      );
    }

    initialized = true;
    showTouchUI = inputCaps.shouldShowTouchUI();

    // V key for camera mode toggle
    window.addEventListener("keydown", handleKeyDown);
  });

  // Game loop
  useTask((delta) => {
    if (!enabled || !inputProvider || !cameraController || !camera || !physicsState || !playerController) return;

    // Update input provider
    inputProvider.update(delta);

    // Update touch UI visibility
    showTouchUI = inputCaps.shouldShowTouchUI();

    // Get input from unified provider
    const lookDelta = inputProvider.getLookDelta();
    const moveInput = inputProvider.getMovementInput();
    const isSprinting = inputProvider.isSprintHeld();

    // Update camera rotation
    cameraController.update(delta, lookDelta);

    // Get camera angles
    const yaw = cameraController.getYaw();
    const pitch = cameraController.getPitch();

    // Emit rotation for multiplayer
    onRotationChange?.({ yaw, pitch });

    // Calculate movement direction
    let moved = false;
    moveDirection.set(0, 0, 0);

    // Combine provider input with joystick input
    const inputX = showTouchUI && joystickInput.x !== 0 ? joystickInput.x : moveInput.strafe;
    const inputZ = showTouchUI && joystickInput.z !== 0 ? joystickInput.z : moveInput.forward;

    if (inputX !== 0 || inputZ !== 0) {
      // Calculate forward/right from camera yaw
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));

      // Build movement direction
      moveDirection.addScaledVector(forward, inputZ);
      moveDirection.addScaledVector(right, inputX);

      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();

        // Apply speed
        const sprintMultiplier = isSprinting ? SPRINT_MULTIPLIER : 1;
        const speed = PLAYER_MOVE_SPEED * sprintMultiplier;
        moveDirection.multiplyScalar(speed * delta);

        moved = true;
      }
    }

    // Apply gravity
    if (!playerController.isGrounded) {
      verticalVelocity -= GRAVITY * delta;
      verticalVelocity = Math.max(verticalVelocity, TERMINAL_VELOCITY);
    } else if (verticalVelocity < 0) {
      verticalVelocity = 0;
    }

    // Compute desired movement
    const desiredMovement = {
      x: moveDirection.x,
      y: verticalVelocity * delta,
      z: moveDirection.z,
    };

    // Move using physics controller
    movePlayer(physicsState, playerController, desiredMovement, delta);

    // Step physics simulation
    if (physicsState.world) {
      physicsState.world.step();
    }

    // Get player position from physics
    if (!playerController.rigidBody) return;
    const newPos = playerController.rigidBody.translation();

    // Check for room changes
    const roomNode = findRoomAtPointWithHint(
      layout.roomGraph,
      { x: newPos.x, z: newPos.z },
      currentRoomId
    );

    if (roomNode && roomNode.room.id !== currentRoomId) {
      onRoomChange(roomNode.room.id);
    }

    // Emit position change
    onPositionChange({
      x: newPos.x,
      y: newPos.y + PLAYER_EYE_HEIGHT - 0.85,
      z: newPos.z,
    });

    // Emit locomotion for multiplayer
    if (moved && (inputX !== 0 || inputZ !== 0)) {
      const sprintMultiplier = isSprinting ? SPRINT_MULTIPLIER : 1;
      const speed = PLAYER_MOVE_SPEED * sprintMultiplier;
      const direction = Math.atan2(inputX, inputZ);
      const normalizedSpeed = Math.min(1, speed / PLAYER_MOVE_SPEED);
      onLocomotionChange?.({ isMoving: true, moveDirection: direction, moveSpeed: normalizedSpeed });
    } else {
      onLocomotionChange?.({ isMoving: false, moveDirection: 0, moveSpeed: 0 });
    }

    // Apply camera based on mode
    if (cameraMode === CameraMode.FIRST_PERSON) {
      camera.position.set(position.x, PLAYER_EYE_HEIGHT, position.z);
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    } else {
      // Third person: orbit behind player
      const offsetX = -Math.sin(yaw) * THIRD_PERSON_DISTANCE;
      const offsetZ = -Math.cos(yaw) * THIRD_PERSON_DISTANCE;
      camera.position.set(
        position.x + offsetX,
        position.y + THIRD_PERSON_HEIGHT,
        position.z + offsetZ
      );
      camera.lookAt(position.x, position.y + PLAYER_EYE_HEIGHT, position.z);
    }
  });

  onDestroy(() => {
    inputProvider?.dispose();
    inputProvider = null;
    cameraController = null;
    inputCaps.destroy();
    initialized = false;

    window.removeEventListener("keydown", handleKeyDown);

    // Clean up colliders
    if (physicsState) {
      if (wallColliders.length > 0) {
        removeColliders(physicsState, wallColliders);
        wallColliders = [];
      }

      if (floorCollider && physicsState.world) {
        physicsState.world.removeCollider(floorCollider, true);
        floorCollider = null;
      }
    }

    if (physicsState && playerController) {
      disposePlayerController(physicsState, playerController);
    }

    if (physicsState) {
      disposePhysicsWorld(physicsState);
    }
  });
</script>

<T.PerspectiveCamera
  bind:ref={camera}
  makeDefault
  position={[position.x, position.y, position.z]}
  {fov}
  near={1}
  far={5000}
/>

<!-- Touch controls using shared VirtualJoystick -->
{#if enabled && showTouchUI}
  <VirtualJoystick
    onInput={handleJoystickInput}
    {enabled}
    left={24}
    bottom={24}
    size={120}
  />

  <!-- Touch look hint -->
  <div class="touch-look-hint">
    <span>Drag to look around</span>
  </div>
{/if}

<style>
  .touch-look-hint {
    position: fixed;
    top: 50%;
    right: 20%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-weight: 500;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: fadeInOut 4s ease-in-out;
    z-index: 100;
  }

  @keyframes fadeInOut {
    0%, 100% { opacity: 0; }
    15%, 85% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .touch-look-hint {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
