<script lang="ts">
  /**
   * RapierFirstPersonController
   *
   * Physics-based FPS controller using Rapier character controller.
   * More realistic movement with slopes, auto-step, and proper collision.
   *
   * Similar to FirstPersonController but uses Rapier physics instead of raycasting.
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import { PerspectiveCamera, Vector3 } from "three";
  import type { GalleryLayout } from "../../domain/models/GalleryLayout";
  import {
    PLAYER_EYE_HEIGHT,
    PLAYER_MOVE_SPEED,
    MOUSE_SENSITIVITY,
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
  import TouchControls from "./TouchControls.svelte";
  import type RAPIER from "@dimforge/rapier3d-compat";

  // Touch look sensitivity
  const TOUCH_SENSITIVITY = 0.004;

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
  }

  let { layout, position, currentRoomId, onPositionChange, onRoomChange, onRotationChange, onLocomotionChange, enabled = true, initialYaw = Math.PI }: Props = $props();

  // Camera reference
  let camera = $state<PerspectiveCamera | undefined>(undefined);

  // Physics state
  let physicsState: PhysicsWorldState | null = $state(null);
  let playerController: PlayerControllerState | null = $state(null);
  let wallColliders: RAPIER.Collider[] = [];
  let floorCollider: RAPIER.Collider | null = null;

  // Look angles (radians)
  let yaw = $state(Math.PI);
  let pitch = $state(0);
  let hasInitializedYaw = false;

  // Movement input state
  let moveInput = $state({ x: 0, z: 0 });
  let touchMoveInput = $state({ x: 0, z: 0 });
  let isTouchDevice = $state(false);

  // Camera mode (1st person <-> 3rd person with V key)
  let cameraMode = $state<CameraMode>(
    cameraPreferences.getModeForDestination("gallery")
  );

  // Third person camera settings
  const THIRD_PERSON_DISTANCE = 5; // meters behind player
  const THIRD_PERSON_HEIGHT = 2; // meters above player eye height

  // Camera transition state
  let transitionState = $state<{
    isActive: boolean;
    progress: number;
    startPosition: { x: number; y: number; z: number };
    targetPosition: { x: number; y: number; z: number };
    startRotation: { yaw: number; pitch: number };
    targetRotation: { yaw: number; pitch: number };
  } | null>(null);

  // Pointer lock state
  let isPointerLocked = $state(false);

  // Key tracking
  let keys = $state({
    forward: false,
    left: false,
    backward: false,
    right: false,
    sprint: false,
  });

  // Initialize physics
  onMount(async () => {
    // Create physics world
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -20, z: 0 }); // Standard gravity

    // Create player controller
    // Convert eye height to capsule center position (eye height - offset)
    const capsuleCenterY = position.y - (PLAYER_EYE_HEIGHT - 0.85);
    playerController = createPlayerController(physicsState, {
      position: { x: position.x, y: capsuleCenterY, z: position.z },
    });

    // Create colliders from gallery layout
    if (physicsState.rapier && physicsState.world) {
      // Create floor
      const floor = createGalleryFloorCollider(
        physicsState,
        layout.floorSize.width,
        layout.floorSize.depth
      );
      if (floor) {
        floorCollider = floor;
      }

      // Create all wall colliders from the collision world
      wallColliders = createGalleryWallColliders(
        physicsState,
        layout.collisionWorld
      );
    }

    // Detect touch device
    isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("click", handleCanvasClick);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    document.removeEventListener("click", handleCanvasClick);

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

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

  // Initialize yaw from prop
  $effect(() => {
    if (!hasInitializedYaw && initialYaw !== undefined) {
      yaw = initialYaw;
      hasInitializedYaw = true;
    }
  });

  // Touch control handlers
  function handleTouchMove(x: number, z: number) {
    touchMoveInput = { x, z };
  }

  function handleTouchLook(deltaX: number, deltaY: number) {
    yaw -= deltaX * TOUCH_SENSITIVITY;
    pitch -= deltaY * TOUCH_SENSITIVITY;
    pitch = Math.max(-LOOK_ANGLE_LIMIT, Math.min(LOOK_ANGLE_LIMIT, pitch));
  }

  function handleTouchTap(_screenX: number, _screenY: number) {
    // Future: tap-to-walk implementation
  }

  // Camera transition helpers
  function calculateCameraPosition(mode: CameraMode): { x: number; y: number; z: number } {
    if (mode === CameraMode.FIRST_PERSON) {
      return {
        x: position.x,
        y: PLAYER_EYE_HEIGHT,
        z: position.z
      };
    } else {
      // Third person: orbit behind player
      const offsetX = -Math.sin(yaw) * THIRD_PERSON_DISTANCE;
      const offsetZ = -Math.cos(yaw) * THIRD_PERSON_DISTANCE;

      return {
        x: position.x + offsetX,
        y: position.y + THIRD_PERSON_HEIGHT,
        z: position.z + offsetZ
      };
    }
  }

  function cubicBezier(t: number): number {
    // Ease in-out cubic: (0.4, 0.0, 0.2, 1.0)
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerpVector3(
    start: { x: number; y: number; z: number },
    end: { x: number; y: number; z: number },
    t: number
  ): { x: number; y: number; z: number } {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z + (end.z - start.z) * t
    };
  }

  function slerpRotation(
    start: { yaw: number; pitch: number },
    end: { yaw: number; pitch: number },
    t: number
  ): { yaw: number; pitch: number } {
    // Simple linear interpolation for angles (good enough for small changes)
    return {
      yaw: start.yaw + (end.yaw - start.yaw) * t,
      pitch: start.pitch + (end.pitch - start.pitch) * t
    };
  }

  function startCameraTransition(newMode: CameraMode) {
    if (!camera) return;

    const current = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    const target = calculateCameraPosition(newMode);

    transitionState = {
      isActive: true,
      progress: 0,
      startPosition: current,
      targetPosition: target,
      startRotation: { yaw, pitch },
      targetRotation: { yaw, pitch } // Rotation stays the same
    };
  }

  function updateTransition(deltaTime: number) {
    if (!transitionState?.isActive || !camera) return;

    transitionState.progress += deltaTime / 0.3; // 300ms transition

    if (transitionState.progress >= 1) {
      transitionState.isActive = false;
      transitionState.progress = 1;
    }

    // Use cubic bezier easing
    const t = cubicBezier(Math.min(1, transitionState.progress));

    // Interpolate position
    const pos = lerpVector3(
      transitionState.startPosition,
      transitionState.targetPosition,
      t
    );
    camera.position.set(pos.x, pos.y, pos.z);

    // Interpolate rotation (though it doesn't change for our use case)
    const rot = slerpRotation(
      transitionState.startRotation,
      transitionState.targetRotation,
      t
    );
    yaw = rot.yaw;
    pitch = rot.pitch;
  }

  // Key mapping
  function getKeyMapping(key: string): keyof typeof keys | null {
    const lowerKey = key.toLowerCase();
    switch (lowerKey) {
      case "w":
      case "arrowup":
        return "forward";
      case "a":
      case "arrowleft":
        return "left";
      case "s":
      case "arrowdown":
        return "backward";
      case "d":
      case "arrowright":
        return "right";
      case "shift":
        return "sprint";
      default:
        return null;
    }
  }

  // Keyboard handlers
  function handleKeyDown(e: KeyboardEvent) {
    if (!enabled) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const mapping = getKeyMapping(e.key);
    if (mapping) {
      keys[mapping] = true;
      e.preventDefault();
    }

    // V key toggles camera mode
    if (e.key.toLowerCase() === "v") {
      cameraMode = cameraPreferences.toggleMode("gallery");
      startCameraTransition(cameraMode);
      e.preventDefault();
    }

    if (e.key === "Escape" && isPointerLocked) {
      document.exitPointerLock();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    const mapping = getKeyMapping(e.key);
    if (mapping) {
      keys[mapping] = false;
    }
  }

  // Mouse look handler
  function handleMouseMove(e: MouseEvent) {
    if (!isPointerLocked || !enabled) return;

    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;
    pitch = Math.max(-LOOK_ANGLE_LIMIT, Math.min(LOOK_ANGLE_LIMIT, pitch));
  }

  // Pointer lock handlers
  function handlePointerLockChange() {
    isPointerLocked = document.pointerLockElement !== null;
    if (!isPointerLocked) {
      keys = { forward: false, left: false, backward: false, right: false, sprint: false };
    }
  }

  function handleCanvasClick(e: MouseEvent) {
    if (!enabled || isPointerLocked) return;

    const canvas = e.target as HTMLCanvasElement;
    if (canvas?.tagName === "CANVAS") {
      canvas.requestPointerLock();
    }
  }

  function handleBlur() {
    keys = { forward: false, left: false, backward: false, right: false, sprint: false };
  }

  // Update move input from key state or touch input
  $effect(() => {
    const keyX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const keyZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);

    moveInput = {
      x: touchMoveInput.x !== 0 ? touchMoveInput.x : keyX,
      z: touchMoveInput.z !== 0 ? touchMoveInput.z : keyZ,
    };
  });

  // Reusable vectors
  const forward = new Vector3();
  const right = new Vector3();
  const moveDirection = new Vector3();

  // Persistent vertical velocity for gravity
  let verticalVelocity = $state(0);

  // Gravity constants
  const GRAVITY = 20; // m/s²
  const TERMINAL_VELOCITY = -50; // Max fall speed

  // Movement update loop
  useTask((delta) => {
    if (!enabled || !camera || !physicsState || !playerController) return;

    // Update camera transition first
    updateTransition(delta);

    let moved = false;
    moveDirection.set(0, 0, 0);

    if (moveInput.x !== 0 || moveInput.z !== 0) {
      // Get camera's forward direction
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      // Right vector
      right.crossVectors(forward, new Vector3(0, 1, 0)).normalize();

      // Calculate horizontal movement direction
      moveDirection.addScaledVector(forward, moveInput.z);
      moveDirection.addScaledVector(right, moveInput.x);

      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();

        // Apply speed
        const sprintMultiplier = keys.sprint ? SPRINT_MULTIPLIER : 1;
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

    // Compute desired movement (horizontal + vertical)
    const desiredMovement = {
      x: moveDirection.x,
      y: verticalVelocity * delta,
      z: moveDirection.z,
    };

    // Move the player using physics controller
    movePlayer(
      physicsState,
      playerController,
      desiredMovement,
      delta
    );

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
      y: newPos.y + PLAYER_EYE_HEIGHT - 0.85, // Adjust for capsule offset
      z: newPos.z,
    });

    // Emit locomotion state (only if horizontally moved)
    if (moved && (moveInput.x !== 0 || moveInput.z !== 0)) {
      const sprintMultiplier = keys.sprint ? SPRINT_MULTIPLIER : 1;
      const speed = PLAYER_MOVE_SPEED * sprintMultiplier;
      const direction = Math.atan2(moveInput.x, moveInput.z);
      const normalizedSpeed = Math.min(1, speed / PLAYER_MOVE_SPEED);
      onLocomotionChange?.({ isMoving: true, moveDirection: direction, moveSpeed: normalizedSpeed });
    } else {
      onLocomotionChange?.({ isMoving: false, moveDirection: 0, moveSpeed: 0 });
    }

    // Apply third-person camera mode (if not transitioning)
    if (cameraMode === CameraMode.THIRD_PERSON && !transitionState?.isActive) {
      const thirdPersonPos = calculateCameraPosition(CameraMode.THIRD_PERSON);
      camera.position.set(thirdPersonPos.x, thirdPersonPos.y, thirdPersonPos.z);

      // Look at player
      camera.lookAt(position.x, position.y + PLAYER_EYE_HEIGHT, position.z);
    }
  });

  // Update camera rotation
  $effect(() => {
    if (camera && cameraMode === CameraMode.FIRST_PERSON) {
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
    onRotationChange?.({ yaw, pitch });
  });
</script>

<T.PerspectiveCamera
  bind:ref={camera}
  makeDefault
  position={[position.x, position.y, position.z]}
  fov={75}
  near={1}
  far={5000}
/>

{#if isTouchDevice}
  <TouchControls
    onMove={handleTouchMove}
    onLook={handleTouchLook}
    onTap={handleTouchTap}
    {enabled}
  />
{/if}
