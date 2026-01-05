<script lang="ts">
  /**
   * ThirdPersonCamera
   *
   * Game-style third person camera with pointer lock.
   * - Click canvas to capture mouse (pointer lock)
   * - Mouse movement freely orbits camera
   * - WASD movement is relative to camera direction
   * - Escape to release mouse
   */
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import type { PerspectiveCamera } from "three";

  interface Props {
    /** Target position to follow (avatar position) */
    target: { x: number; y?: number; z: number };
    /** Distance from target */
    distance?: number;
    /** Height above target */
    height?: number;
    /** How quickly camera follows position (0-1, higher = snappier) */
    positionDamping?: number;
    /** Callback with current camera horizontal angle (for WASD direction) */
    onAngleChange?: (angle: number) => void;
    /** Callback when pointer lock state changes */
    onPointerLockChange?: (locked: boolean) => void;
  }

  let {
    target,
    distance = 400,
    height = 200,
    positionDamping = 0.1,
    onAngleChange,
    onPointerLockChange,
  }: Props = $props();

  const { invalidate, renderer } = useThrelte();

  // Camera reference
  let cameraRef = $state<PerspectiveCamera | undefined>(undefined);

  // Pointer lock state
  let isPointerLocked = $state(false);

  // Orbit angles (in radians)
  // yaw = horizontal rotation around avatar (0 = behind, PI/2 = right side, etc.)
  // pitch = vertical angle (0 = level, positive = looking down)
  // Using refs instead of $state to avoid Svelte batching delays
  // (movement direction must update immediately when camera rotates)
  let yawRef = { current: 0 };
  let pitchRef = { current: 0.3 }; // Slight downward angle

  // Pitch constraints
  const MIN_PITCH = -0.2; // Slightly below horizon
  const MAX_PITCH = 1.2; // Looking down at steep angle

  // Mouse sensitivity
  const SENSITIVITY = 0.002;

  // Smoothed camera position - synced with target on mount/change
  let smoothedTarget = $state({ x: 0, y: 0, z: 0 });
  let hasInitializedTarget = $state(false);

  // Initialize smoothedTarget when target first becomes available or changes identity
  $effect(() => {
    if (!hasInitializedTarget) {
      smoothedTarget = { x: target.x, y: target.y ?? 0, z: target.z };
      hasInitializedTarget = true;
    }
  });

  // Camera position - computed each frame in useTask since refs don't trigger reactivity
  let cameraPosition = $state({ x: 0, y: 0, z: 0 });

  // Initialize camera position when height/distance props are ready
  $effect(() => {
    if (cameraPosition.y === 0 && cameraPosition.z === 0) {
      cameraPosition = { x: 0, y: height, z: -distance };
    }
  });

  // Look-at point (slightly above avatar center)
  const lookAtPoint = $derived({
    x: smoothedTarget.x,
    y: smoothedTarget.y + 80, // Look at upper body
    z: smoothedTarget.z,
  });

  // Request pointer lock on canvas click/pointerdown
  function handleCanvasClick(e: MouseEvent | PointerEvent) {
    // Only handle left click
    if (e.button !== 0) return;

    const canvas = renderer.domElement;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock().catch(() => {
        // Pointer lock may fail if not triggered by user gesture
      });
    }
  }

  // Handle pointer lock state changes
  function handlePointerLockChange() {
    const canvas = renderer.domElement;
    isPointerLocked = document.pointerLockElement === canvas;
    onPointerLockChange?.(isPointerLocked);
  }

  // Handle mouse movement (only when pointer locked)
  function handleMouseMove(e: MouseEvent) {
    // Check pointer lock directly (more reliable than state)
    const canvas = renderer.domElement;
    if (document.pointerLockElement !== canvas) return;

    // Use movementX/Y for pointer lock (delta movement)
    const deltaX = e.movementX ?? 0;
    const deltaY = e.movementY ?? 0;

    // Update yaw (horizontal orbit) - use ref for immediate update
    yawRef.current -= deltaX * SENSITIVITY;

    // Update pitch (vertical angle) with constraints
    pitchRef.current = Math.max(
      MIN_PITCH,
      Math.min(MAX_PITCH, pitchRef.current + deltaY * SENSITIVITY)
    );

    // IMMEDIATELY report new angle to parent (don't wait for useTask)
    // This ensures movement direction updates in the same frame as camera rotation
    onAngleChange?.(yawRef.current);
  }

  // Prevent context menu
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
  }

  // Update camera each frame
  useTask((delta) => {
    // Smooth follow target position
    const lerpFactor = 1 - Math.pow(1 - positionDamping, delta * 60);

    smoothedTarget.x += (target.x - smoothedTarget.x) * lerpFactor;
    smoothedTarget.y += ((target.y ?? 0) - smoothedTarget.y) * lerpFactor;
    smoothedTarget.z += (target.z - smoothedTarget.z) * lerpFactor;

    // Calculate camera position from orbit angles (using refs for immediate values)
    const yaw = yawRef.current;
    const pitch = pitchRef.current;
    cameraPosition.x =
      smoothedTarget.x - Math.sin(yaw) * distance * Math.cos(pitch);
    cameraPosition.y =
      smoothedTarget.y + height + Math.sin(pitch) * distance * 0.5;
    cameraPosition.z =
      smoothedTarget.z - Math.cos(yaw) * distance * Math.cos(pitch);

    // Update camera lookAt
    if (cameraRef) {
      cameraRef.lookAt(lookAtPoint.x, lookAtPoint.y, lookAtPoint.z);
    }

    invalidate();
  });

  onMount(() => {
    const canvas = renderer.domElement;

    // Pointer lock events - use both click and pointerdown for reliability
    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("pointerdown", handleCanvasClick);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("contextmenu", handleContextMenu);
  });

  onDestroy(() => {
    const canvas = renderer.domElement;

    // Clean up pointer lock if active
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }

    canvas.removeEventListener("click", handleCanvasClick);
    canvas.removeEventListener("pointerdown", handleCanvasClick);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    document.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("contextmenu", handleContextMenu);
  });
</script>

<T.PerspectiveCamera
  makeDefault
  bind:ref={cameraRef}
  position={[cameraPosition.x, cameraPosition.y, cameraPosition.z]}
  fov={60}
  near={1}
  far={6000}
  oncreate={(ref) => {
    ref.lookAt(lookAtPoint.x, lookAtPoint.y, lookAtPoint.z);
  }}
/>
