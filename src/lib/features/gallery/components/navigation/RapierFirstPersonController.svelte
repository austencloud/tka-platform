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
  import {
    createPhysicsWorldState,
    initPhysicsWorld,
    disposePhysicsWorld,
    type PhysicsWorldState,
  } from "$lib/shared/3d-core/physics/rapier-world";
  import {
    createPlayerController,
    disposePlayerController,
    movePlayer,
    type PlayerControllerState,
  } from "$lib/shared/3d-core/physics/player-controller";
  import { findRoomAtPointWithHint } from "../../domain/models/RoomGraph";
  import TouchControls from "./TouchControls.svelte";

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
  let camera = $state<PerspectiveCamera | null>(null);

  // Physics state
  let physicsState: PhysicsWorldState | null = $state(null);
  let playerController: PlayerControllerState | null = $state(null);

  // Look angles (radians)
  let yaw = $state(Math.PI);
  let pitch = $state(0);
  let hasInitializedYaw = false;

  // Movement input state
  let moveInput = $state({ x: 0, z: 0 });
  let touchMoveInput = $state({ x: 0, z: 0 });
  let isTouchDevice = $state(false);

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

    // TODO: Create colliders for gallery walls, floor, ceiling
    // For now, just floor collider
    if (physicsState.rapier && physicsState.world) {
      const RAPIER = physicsState.rapier;
      const floorDesc = RAPIER.ColliderDesc.cuboid(500, 0.1, 500);
      floorDesc.setTranslation(0, -0.1, 0);
      floorDesc.setFriction(0.8);
      physicsState.world.createCollider(floorDesc);
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
  });

  // Update camera rotation
  $effect(() => {
    if (camera) {
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
