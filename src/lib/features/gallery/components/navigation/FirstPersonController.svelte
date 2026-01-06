<script lang="ts">
  /**
   * FirstPersonController
   *
   * FPS-style camera and movement controller for the gallery.
   * - WASD/Arrow keys for movement
   * - Mouse for looking around (with pointer lock)
   * - Click canvas to capture mouse, Escape to release
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
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Gallery layout for bounds checking */
    layout: GalleryLayout;
    /** Current player position (updated by this component) */
    position: { x: number; y: number; z: number };
    /** Callback when position changes */
    onPositionChange: (pos: { x: number; y: number; z: number }) => void;
    /** Whether controls are enabled */
    enabled?: boolean;
  }

  let { layout, position, onPositionChange, enabled = true }: Props = $props();

  // Camera reference
  let camera = $state<PerspectiveCamera | null>(null);

  // Look angles (radians)
  let yaw = $state(0); // Horizontal rotation
  let pitch = $state(0); // Vertical rotation (clamped)

  // Movement input state
  let moveInput = $state({ x: 0, z: 0 });

  // Pointer lock state
  let isPointerLocked = $state(false);

  // WASD key tracking
  let keys = $state({
    forward: false,
    left: false,
    backward: false,
    right: false,
  });

  // Key mapping
  function getKeyMapping(key: string): keyof typeof keys | null {
    switch (key.toLowerCase()) {
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
      keys = { forward: false, left: false, backward: false, right: false };
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
    keys = { forward: false, left: false, backward: false, right: false };
  }

  // Update move input from key state
  // x: -1 (left) to 1 (right)
  // z: -1 (back) to 1 (forward)
  $effect(() => {
    moveInput = {
      x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
      z: (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0),
    };
  });

  // Reusable vectors to avoid allocations
  const forward = new Vector3();
  const right = new Vector3();

  // Movement update loop
  useTask((delta) => {
    if (!enabled || !camera || (moveInput.x === 0 && moveInput.z === 0)) return;

    // Get camera's actual forward direction (where it's looking)
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement on XZ plane
    forward.normalize();

    // Right vector is perpendicular to forward (cross with up)
    right.crossVectors(forward, new Vector3(0, 1, 0)).normalize();

    // Calculate movement in world space
    const speed = PLAYER_MOVE_SPEED * delta;
    let newX = position.x;
    let newZ = position.z;

    // Forward/backward (W/S)
    newX += forward.x * moveInput.z * speed;
    newZ += forward.z * moveInput.z * speed;

    // Strafe left/right (A/D)
    newX += right.x * moveInput.x * speed;
    newZ += right.z * moveInput.x * speed;

    // Simple bounds checking
    const margin = 50;
    newX = Math.max(layout.bounds.minX + margin, Math.min(layout.bounds.maxX - margin, newX));
    newZ = Math.max(layout.bounds.minZ + margin, Math.min(layout.bounds.maxZ - margin, newZ));

    // Emit position change
    onPositionChange({
      x: newX,
      y: PLAYER_EYE_HEIGHT,
      z: newZ,
    });
  });

  // Update camera rotation
  $effect(() => {
    if (camera) {
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
  });

  onMount(() => {
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
