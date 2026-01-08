<script lang="ts">
  /**
   * FirstPersonController
   *
   * FPS-style camera and movement controller for the gallery.
   * - Desktop: WASD/Arrow keys for movement, mouse for looking (with pointer lock)
   * - Mobile: Virtual joystick for movement, drag to look
   *
   * Uses room-based wall collision for realistic movement restriction.
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import { PerspectiveCamera, Vector3, Raycaster, Vector2, Plane } from "three";
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
  import { getWallsForRooms, findDeepestCollision, resolveCollision } from "../../domain/models/WallCollider";
  import { getRoomWithNeighbors, findRoomAtPointWithHint } from "../../domain/models/RoomGraph";
  import TouchControls from "./TouchControls.svelte";
  import TapIndicator from "./TapIndicator.svelte";

  // Touch look sensitivity (lower than mouse for smoother feel)
  const TOUCH_SENSITIVITY = 0.004;

  // Walk-to-point settings
  const WALK_TO_SPEED = PLAYER_MOVE_SPEED * 0.8; // Slightly slower for tap-to-walk
  const WALK_TO_ARRIVAL_THRESHOLD = 30; // Stop when within this distance

  // Collision settings
  const MAX_COLLISION_ITERATIONS = 4;

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
  }

  let { layout, position, currentRoomId, onPositionChange, onRoomChange, onRotationChange, onLocomotionChange, enabled = true, initialYaw = Math.PI }: Props = $props();

  // Camera reference
  let camera = $state<PerspectiveCamera | undefined>(undefined);

  // Camera mode (1st person <-> 3rd person with V key)
  let cameraMode = $state<CameraMode>(
    cameraPreferences.getModeForDestination("gallery")
  );

  // Third person camera settings
  const THIRD_PERSON_DISTANCE = 5; // meters behind player
  const THIRD_PERSON_HEIGHT = 2; // meters above player eye height

  // Look angles (radians)
  // Start facing down the hallway (+Z direction) by default
  let yaw = $state(Math.PI); // Horizontal rotation - initialized to face +Z
  let pitch = $state(0); // Vertical rotation (clamped)
  let hasInitializedYaw = false;

  // Movement input state (from keyboard or touch)
  let moveInput = $state({ x: 0, z: 0 });

  // Touch input state (separate from keyboard)
  let touchMoveInput = $state({ x: 0, z: 0 });
  let isTouchDevice = $state(false);

  // Walk-to-point state
  let walkToTarget: Vector3 | null = $state(null);
  let isWalkingToTarget = $state(false);
  let indicatorFadeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Camera transition state
  let transitionState = $state<{
    isActive: boolean;
    progress: number;
    startPosition: { x: number; y: number; z: number };
    targetPosition: { x: number; y: number; z: number };
    startRotation: { yaw: number; pitch: number };
    targetRotation: { yaw: number; pitch: number };
  } | null>(null);

  // Raycaster for tap-to-walk
  const raycaster = new Raycaster();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0); // Y-up plane at y=0

  // Touch control handlers
  function handleTouchMove(x: number, z: number) {
    touchMoveInput = { x, z };
    // Cancel walk-to if user starts using joystick
    if (x !== 0 || z !== 0) {
      if (indicatorFadeTimeout) {
        clearTimeout(indicatorFadeTimeout);
        indicatorFadeTimeout = null;
      }
      walkToTarget = null;
      isWalkingToTarget = false;
    }
  }

  function handleTouchLook(deltaX: number, deltaY: number) {
    yaw -= deltaX * TOUCH_SENSITIVITY;
    pitch -= deltaY * TOUCH_SENSITIVITY;
    pitch = Math.max(-LOOK_ANGLE_LIMIT, Math.min(LOOK_ANGLE_LIMIT, pitch));
  }

  function handleTouchTap(screenX: number, screenY: number) {
    if (!camera) return;

    // Convert screen coordinates to normalized device coordinates (-1 to 1)
    const ndc = new Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );

    // Set up raycaster from camera through tap point
    raycaster.setFromCamera(ndc, camera);

    // Find intersection with floor plane
    const intersectionPoint = new Vector3();
    const ray = raycaster.ray;

    if (ray.intersectPlane(floorPlane, intersectionPoint)) {
      // Check if tap point is in a valid room
      const tapPoint = { x: intersectionPoint.x, z: intersectionPoint.z };
      const targetRoom = findRoomAtPointWithHint(
        layout.roomGraph,
        tapPoint,
        currentRoomId
      );

      if (targetRoom) {
        // Clear any pending fade timeout from previous tap
        if (indicatorFadeTimeout) {
          clearTimeout(indicatorFadeTimeout);
          indicatorFadeTimeout = null;
        }

        walkToTarget = intersectionPoint;
        isWalkingToTarget = true;
      }
    }
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

  // Initialize yaw from prop on first render
  $effect(() => {
    if (!hasInitializedYaw && initialYaw !== undefined) {
      yaw = initialYaw;
      hasInitializedYaw = true;
    }
  });

  // Pointer lock state
  let isPointerLocked = $state(false);

  // WASD key tracking
  let keys = $state({
    forward: false,
    left: false,
    backward: false,
    right: false,
    sprint: false,
  });

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

    // Escape releases pointer lock
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

  // Mouse look handler (only when pointer locked)
  function handleMouseMove(e: MouseEvent) {
    if (!isPointerLocked || !enabled) return;

    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;

    // Clamp pitch to prevent flipping
    pitch = Math.max(-LOOK_ANGLE_LIMIT, Math.min(LOOK_ANGLE_LIMIT, pitch));
  }

  // Pointer lock handlers
  function handlePointerLockChange() {
    isPointerLocked = document.pointerLockElement !== null;
    if (!isPointerLocked) {
      // Release all keys when pointer unlocks
      keys = { forward: false, left: false, backward: false, right: false, sprint: false };
    }
  }

  // Click to request pointer lock
  function handleCanvasClick(e: MouseEvent) {
    if (!enabled || isPointerLocked) return;

    const canvas = e.target as HTMLCanvasElement;
    if (canvas?.tagName === "CANVAS") {
      canvas.requestPointerLock();
    }
  }

  // Window blur releases keys
  function handleBlur() {
    keys = { forward: false, left: false, backward: false, right: false, sprint: false };
  }

  // Update move input from key state or touch input
  // x: -1 (left) to 1 (right)
  // z: -1 (back) to 1 (forward)
  $effect(() => {
    // Keyboard input
    const keyX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const keyZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);

    // Combine keyboard and touch (touch takes priority if active)
    moveInput = {
      x: touchMoveInput.x !== 0 ? touchMoveInput.x : keyX,
      z: touchMoveInput.z !== 0 ? touchMoveInput.z : keyZ,
    };
  });

  // Reusable vectors to avoid allocations
  const forward = new Vector3();
  const right = new Vector3();

  // Movement update loop
  useTask((delta) => {
    if (!enabled || !camera) return;

    // Update camera transition first
    updateTransition(delta);

    let newX = position.x;
    let newZ = position.z;
    let moved = false;

    // Calculate base speed with sprint multiplier
    const sprintMultiplier = keys.sprint ? SPRINT_MULTIPLIER : 1;

    // Handle walk-to-target (tap to walk)
    if (isWalkingToTarget && walkToTarget) {
      const dx = walkToTarget.x - position.x;
      const dz = walkToTarget.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < WALK_TO_ARRIVAL_THRESHOLD) {
        // Arrived at destination - start fade out animation
        isWalkingToTarget = false;
        // Clear target after fade animation completes (500ms)
        indicatorFadeTimeout = setTimeout(() => {
          walkToTarget = null;
          indicatorFadeTimeout = null;
        }, 500);
      } else {
        // Move towards target (sprint applies here too)
        const speed = WALK_TO_SPEED * sprintMultiplier * delta;
        const moveDistance = Math.min(speed, distance);
        newX += (dx / distance) * moveDistance;
        newZ += (dz / distance) * moveDistance;
        moved = true;
      }
    }
    // Handle keyboard/joystick input (only if not walking to target)
    else if (moveInput.x !== 0 || moveInput.z !== 0) {
      // Get camera's actual forward direction (where it's looking)
      camera.getWorldDirection(forward);
      forward.y = 0; // Keep movement on XZ plane
      forward.normalize();

      // Right vector is perpendicular to forward (cross with up)
      right.crossVectors(forward, new Vector3(0, 1, 0)).normalize();

      // Calculate movement in world space with sprint
      const speed = PLAYER_MOVE_SPEED * sprintMultiplier * delta;

      // Forward/backward (W/S)
      newX += forward.x * moveInput.z * speed;
      newZ += forward.z * moveInput.z * speed;

      // Strafe left/right (A/D)
      newX += right.x * moveInput.x * speed;
      newZ += right.z * moveInput.x * speed;
      moved = true;
    }

    // Only update position if we moved
    if (moved) {
      // Get walls from current room and adjacent rooms for collision
      const relevantRooms = getRoomWithNeighbors(layout.roomGraph, currentRoomId);
      const roomIds = relevantRooms.map((r) => r.room.id);
      const walls = getWallsForRooms(layout.collisionWorld, roomIds);

      // Resolve wall collisions iteratively
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

      // Determine which room the player is now in
      const roomNode = findRoomAtPointWithHint(
        layout.roomGraph,
        resolvedPos,
        currentRoomId
      );

      if (roomNode && roomNode.room.id !== currentRoomId) {
        onRoomChange(roomNode.room.id);
      }

      // Emit position change
      onPositionChange({
        x: resolvedPos.x,
        y: PLAYER_EYE_HEIGHT,
        z: resolvedPos.z,
      });

      // Emit locomotion state for multiplayer avatar animation
      const speed = PLAYER_MOVE_SPEED * sprintMultiplier;
      emitLocomotion(true, moveInput.x, moveInput.z, speed);
    } else {
      // Not moving - emit idle state
      emitLocomotion(false, 0, 0, 0);
    }

    // Apply third-person camera mode (if not transitioning)
    if (cameraMode === CameraMode.THIRD_PERSON && !transitionState?.isActive) {
      const thirdPersonPos = calculateCameraPosition(CameraMode.THIRD_PERSON);
      camera.position.set(thirdPersonPos.x, thirdPersonPos.y, thirdPersonPos.z);

      // Look at player
      camera.lookAt(position.x, position.y + PLAYER_EYE_HEIGHT, position.z);
    }
  });

  // Update camera rotation and emit rotation changes
  $effect(() => {
    if (camera && cameraMode === CameraMode.FIRST_PERSON) {
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
    // Emit rotation change for multiplayer sync
    onRotationChange?.({ yaw, pitch });
  });

  // Track last locomotion state to detect changes
  let lastLocomotionState = { isMoving: false, moveDirection: 0, moveSpeed: 0 };

  // Emit locomotion changes for multiplayer avatar animation
  function emitLocomotion(isMoving: boolean, moveX: number, moveZ: number, speed: number) {
    // Calculate move direction as angle (0 = forward, PI/2 = right)
    const moveDirection = isMoving ? Math.atan2(moveX, moveZ) : 0;
    const normalizedSpeed = isMoving ? Math.min(1, speed / PLAYER_MOVE_SPEED) : 0;

    // Only emit if state changed significantly
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

    // Release pointer lock on unmount
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Clear any pending fade timeout
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
  fov={75}
  near={1}
  far={5000}
/>

<!-- Mobile touch controls (rendered outside 3D scene via portal) -->
{#if isTouchDevice}
  <TouchControls
    onMove={handleTouchMove}
    onLook={handleTouchLook}
    onTap={handleTouchTap}
    {enabled}
  />
{/if}

<!-- Tap-to-walk destination indicator -->
{#if walkToTarget}
  <TapIndicator
    position={{ x: walkToTarget.x, z: walkToTarget.z }}
    active={isWalkingToTarget}
  />
{/if}
