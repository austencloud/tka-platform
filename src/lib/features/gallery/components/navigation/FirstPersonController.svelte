<script lang="ts">
  /**
   * FirstPersonController
   *
   * FPS-style camera and movement controller for the gallery.
   * Uses shared 3D primitives for input and camera handling.
   *
   * Shared primitives used:
   * - AdaptiveInputProvider: Unified keyboard/touch/pointer lock input
   * - CameraController: Camera rotation with behaviors
   * - VirtualJoystick: Touch movement control
   *
   * Gallery-specific features:
   * - Wall collision (WallCollider)
   * - Tap-to-walk (floor raycasting)
   * - Room graph navigation
   * - Multiplayer sync callbacks
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import { PerspectiveCamera, Vector3, Raycaster, Vector2, Plane } from "three";
  import type { GalleryLayout } from "../../domain/models/GalleryLayout";
  import {
    PLAYER_EYE_HEIGHT,
    PLAYER_MOVE_SPEED,
    LOOK_ANGLE_LIMIT,
    SPRINT_MULTIPLIER,
  } from "../../domain/constants/gallery-dimensions";
  import { CameraMode } from "$lib/shared/3d-core/camera/types";
  import { cameraPreferences } from "$lib/shared/3d-core/camera/camera-preferences.svelte";
  import { getWallsForRooms, findDeepestCollision, resolveCollision } from "../../domain/models/WallCollider";
  import { getRoomWithNeighbors, findRoomAtPointWithHint } from "../../domain/models/RoomGraph";

  // Shared 3D primitives
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import { AdaptiveInputProvider } from "$lib/shared/3d/input/InputProviderFactory";
  import { CameraController } from "$lib/shared/3d/camera/CameraController";
  import { FirstPersonLook } from "$lib/shared/3d/camera/behaviors/FirstPersonLook";
  import { ThirdPersonOrbit } from "$lib/shared/3d/camera/behaviors/ThirdPersonOrbit";
  import { CameraDamping } from "$lib/shared/3d/camera/behaviors/CameraDamping";
  import { CameraConstraints } from "$lib/shared/3d/camera/behaviors/CameraConstraints";
  import VirtualJoystick from "$lib/shared/components/touch/VirtualJoystick.svelte";

  // Gallery-specific
  import TapIndicator from "./TapIndicator.svelte";

  // Walk-to-point settings
  const WALK_TO_SPEED = PLAYER_MOVE_SPEED * 0.8;
  const WALK_TO_ARRIVAL_THRESHOLD = 30;

  // Collision settings
  const MAX_COLLISION_ITERATIONS = 4;

  // Third person camera settings
  const THIRD_PERSON_DISTANCE = 5;
  const THIRD_PERSON_HEIGHT = 2;

  interface Props {
    /** Gallery layout with collision world */
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
    /** Initial yaw angle (radians). Default faces down +Z axis (into hallway) */
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

  // Camera mode (1st person <-> 3rd person with V key)
  let cameraMode = $state<CameraMode>(
    cameraPreferences.getModeForDestination("gallery")
  );

  // Show touch UI when needed
  let showTouchUI = $state(false);

  // Walk-to-point state (Gallery-specific)
  let walkToTarget: Vector3 | null = $state(null);
  let isWalkingToTarget = $state(false);
  let indicatorFadeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Touch joystick input (for combining with walk-to-target logic)
  let joystickInput = $state({ x: 0, z: 0 });

  // Raycaster for tap-to-walk (Gallery-specific)
  const raycaster = new Raycaster();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);

  // Track initialization
  let initialized = false;

  // Handle joystick input from VirtualJoystick
  function handleJoystickInput(x: number, y: number) {
    joystickInput = { x, z: y };
    // Cancel walk-to if user starts using joystick
    if (x !== 0 || y !== 0) {
      cancelWalkTo();
    }
  }

  // Cancel walk-to-target
  function cancelWalkTo() {
    if (indicatorFadeTimeout) {
      clearTimeout(indicatorFadeTimeout);
      indicatorFadeTimeout = null;
    }
    walkToTarget = null;
    isWalkingToTarget = false;
  }

  // Handle tap for tap-to-walk (Gallery-specific)
  function handleTap(e: PointerEvent) {
    if (!enabled || !camera || !showTouchUI) return;

    // Only handle taps, not drags
    // This is called from pointerup, so we check if it was a quick tap
    const ndc = new Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(ndc, camera);
    const intersectionPoint = new Vector3();

    if (raycaster.ray.intersectPlane(floorPlane, intersectionPoint)) {
      const tapPoint = { x: intersectionPoint.x, z: intersectionPoint.z };
      const targetRoom = findRoomAtPointWithHint(
        layout.roomGraph,
        tapPoint,
        currentRoomId
      );

      if (targetRoom) {
        cancelWalkTo();
        walkToTarget = intersectionPoint;
        isWalkingToTarget = true;
      }
    }
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

  // Tap detection state
  let tapStartTime = 0;
  let tapStartPos = { x: 0, y: 0 };
  const TAP_MAX_DURATION = 300;
  const TAP_MAX_DISTANCE = 15;

  function handlePointerDown(e: PointerEvent) {
    tapStartTime = performance.now();
    tapStartPos = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: PointerEvent) {
    const duration = performance.now() - tapStartTime;
    const distance = Math.sqrt(
      Math.pow(e.clientX - tapStartPos.x, 2) +
      Math.pow(e.clientY - tapStartPos.y, 2)
    );

    // Check if this was a tap (quick, didn't move much)
    if (duration < TAP_MAX_DURATION && distance < TAP_MAX_DISTANCE) {
      handleTap(e);
    }
  }

  // Reusable vectors
  const forward = new Vector3();
  const right = new Vector3();

  // Track last locomotion state
  let lastLocomotionState = { isMoving: false, moveDirection: 0, moveSpeed: 0 };

  function emitLocomotion(isMoving: boolean, moveX: number, moveZ: number, speed: number) {
    const moveDirection = isMoving ? Math.atan2(moveX, moveZ) : 0;
    const normalizedSpeed = isMoving ? Math.min(1, speed / PLAYER_MOVE_SPEED) : 0;

    const changed =
      lastLocomotionState.isMoving !== isMoving ||
      Math.abs(lastLocomotionState.moveDirection - moveDirection) > 0.1 ||
      Math.abs(lastLocomotionState.moveSpeed - normalizedSpeed) > 0.1;

    if (changed) {
      lastLocomotionState = { isMoving, moveDirection, moveSpeed: normalizedSpeed };
      onLocomotionChange?.(lastLocomotionState);
    }
  }

  onMount(() => {
    if (!enabled) return;

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

    // Add first-person look behavior (for 1st person mode)
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

    initialized = true;
    showTouchUI = inputCaps.shouldShowTouchUI();

    // V key for camera mode toggle
    window.addEventListener("keydown", handleKeyDown);

    // Tap detection for tap-to-walk (only on touch)
    if (showTouchUI) {
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("pointerup", handlePointerUp);
    }
  });

  // Game loop
  useTask((delta) => {
    if (!enabled || !inputProvider || !cameraController || !camera) return;

    // Update input provider (handles inertia, etc.)
    inputProvider.update(delta);

    // Update touch UI visibility
    showTouchUI = inputCaps.shouldShowTouchUI();

    // Get input from unified provider
    const lookDelta = inputProvider.getLookDelta();
    const moveInput = inputProvider.getMovementInput();
    const isSprinting = inputProvider.isSprintHeld();

    // Update camera rotation
    cameraController.update(delta, lookDelta);

    // Get camera angles for movement and multiplayer sync
    const yaw = cameraController.getYaw();
    const pitch = cameraController.getPitch();

    // Emit rotation for multiplayer
    onRotationChange?.({ yaw, pitch });

    // Calculate movement
    let newX = position.x;
    let newZ = position.z;
    let moved = false;
    const sprintMultiplier = isSprinting ? SPRINT_MULTIPLIER : 1;

    // Handle walk-to-target (Gallery-specific tap-to-walk)
    if (isWalkingToTarget && walkToTarget) {
      const dx = walkToTarget.x - position.x;
      const dz = walkToTarget.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < WALK_TO_ARRIVAL_THRESHOLD) {
        isWalkingToTarget = false;
        indicatorFadeTimeout = setTimeout(() => {
          walkToTarget = null;
          indicatorFadeTimeout = null;
        }, 500);
      } else {
        const speed = WALK_TO_SPEED * sprintMultiplier * delta;
        const moveDistance = Math.min(speed, distance);
        newX += (dx / distance) * moveDistance;
        newZ += (dz / distance) * moveDistance;
        moved = true;
      }
    }
    // Handle keyboard/joystick/gamepad input
    else {
      // Combine provider input with joystick input (joystick takes priority on touch)
      const inputX = showTouchUI && joystickInput.x !== 0 ? joystickInput.x : moveInput.strafe;
      const inputZ = showTouchUI && joystickInput.z !== 0 ? joystickInput.z : moveInput.forward;

      if (inputX !== 0 || inputZ !== 0) {
        // Calculate forward/right vectors from camera yaw
        forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        right.set(Math.cos(yaw), 0, -Math.sin(yaw));

        const speed = PLAYER_MOVE_SPEED * sprintMultiplier * delta;

        // Forward/backward
        newX += forward.x * inputZ * speed;
        newZ += forward.z * inputZ * speed;

        // Strafe left/right
        newX += right.x * inputX * speed;
        newZ += right.z * inputX * speed;
        moved = true;
      }
    }

    // Apply wall collision (Gallery-specific)
    if (moved) {
      const relevantRooms = getRoomWithNeighbors(layout.roomGraph, currentRoomId);
      const roomIds = relevantRooms.map((r) => r.room.id);
      const walls = getWallsForRooms(layout.collisionWorld, roomIds);

      let resolvedPos = { x: newX, z: newZ };
      for (let i = 0; i < MAX_COLLISION_ITERATIONS; i++) {
        const collision = findDeepestCollision(
          resolvedPos,
          layout.collisionWorld.playerRadius,
          walls
        );
        if (!collision) break;
        resolvedPos = resolveCollision(resolvedPos, collision);
      }

      // Check room change (Gallery-specific)
      const roomNode = findRoomAtPointWithHint(layout.roomGraph, resolvedPos, currentRoomId);
      if (roomNode && roomNode.room.id !== currentRoomId) {
        onRoomChange(roomNode.room.id);
      }

      onPositionChange({
        x: resolvedPos.x,
        y: PLAYER_EYE_HEIGHT,
        z: resolvedPos.z,
      });

      // Emit locomotion for multiplayer
      const inputX = showTouchUI && joystickInput.x !== 0 ? joystickInput.x : moveInput.strafe;
      const inputZ = showTouchUI && joystickInput.z !== 0 ? joystickInput.z : moveInput.forward;
      emitLocomotion(true, inputX, inputZ, PLAYER_MOVE_SPEED * sprintMultiplier);
    } else {
      emitLocomotion(false, 0, 0, 0);
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
    window.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointerup", handlePointerUp);

    if (indicatorFadeTimeout) {
      clearTimeout(indicatorFadeTimeout);
    }
  });
</script>

<!-- Camera -->
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

<!-- Tap-to-walk destination indicator (Gallery-specific) -->
{#if walkToTarget}
  <TapIndicator
    position={{ x: walkToTarget.x, z: walkToTarget.z }}
    active={isWalkingToTarget}
  />
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
