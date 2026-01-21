<script lang="ts">
  /**
   * UnifiedCameraController
   *
   * Single camera controller for all 3D destinations with three modes:
   * - ORBIT: View/director mode. Mouse drag rotates around subject. No WASD.
   * - THIRD_PERSON: Game mode. Camera behind avatar. WASD moves avatar.
   * - FIRST_PERSON: Game mode. Camera is avatar's eyes. WASD moves avatar.
   *
   * Controls (consistent everywhere):
   * - V: Cycle modes (Orbit → Third → First → Orbit) - works without pointer lock
   * - Click: Enter pointer lock (for mouse look in game modes)
   * - ESC: Exit pointer lock AND return to Orbit mode
   * - WASD: Move avatar (only in game modes)
   *
   * Movement modes:
   * - Kinematic (default): Uses avatarState.updateMovement() for simple movement
   * - Physics-based: Uses PhysicsProvider for collision-detected movement (Rapier, etc.)
   */
  import { onMount, onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";
  import { Vector3 } from "three";
  import { CameraMode, getNextCameraMode, isGameMode, type PhysicsProvider, type AvatarState } from "./types";
  import { cameraPreferences } from "./camera-preferences.svelte";
  import { SCALE } from "../scale/scale-constants";

  interface Props {
    /** Destination ID for preference persistence (e.g., "stage", "gallery") */
    destinationId: string;
    /** Avatar state for movement and camera following (kinematic mode) */
    avatarState: AvatarState;
    /** Optional physics provider for physics-based movement (Rapier, etc.) */
    physicsProvider?: PhysicsProvider | null;
    /** Whether the controller is active */
    enabled?: boolean;
    /** Callback when mode changes */
    onModeChange?: (mode: CameraMode) => void;
    /** Movement speed (units per second) */
    moveSpeed?: number;
    /** Sprint multiplier */
    sprintMultiplier?: number;
    /** Jump force (vertical velocity) */
    jumpForce?: number;
    /** Gravity (units per second squared) */
    gravity?: number;
    /** Callback to expose camera rotation state for external access (e.g., MCP bridge) */
    onRotationChange?: (yaw: number, pitch: number) => void;
    /** External yaw setter (for MCP control) */
    externalYaw?: number | null;
    /** External pitch setter (for MCP control) */
    externalPitch?: number | null;
  }

  let {
    destinationId,
    avatarState,
    physicsProvider = null,
    enabled = true,
    onModeChange,
    moveSpeed = SCALE.WALK_SPEED,
    sprintMultiplier = SCALE.SPRINT_MULTIPLIER,
    jumpForce = SCALE.JUMP_VELOCITY,
    gravity = Math.abs(SCALE.GRAVITY) * 2.5, // Amplified for game feel
    onRotationChange,
    externalYaw = null,
    externalPitch = null,
  }: Props = $props();

  // Derived: are we using physics-based movement?
  const usePhysics = $derived(physicsProvider !== null);

  const { renderer, camera } = useThrelte();

  // Current camera mode (from preferences)
  let mode = $state<CameraMode>(cameraPreferences.getModeForDestination(destinationId));

  // Camera state (for game modes - orbit mode uses Scene3D's OrbitControls)
  let yaw = $state(0);
  let pitch = $state(0.3);
  let isPointerLocked = $state(false);

  // Movement keys
  const keys = new Set<string>();

  // Vertical velocity (used by BOTH physics and kinematic paths for jumping)
  let verticalVelocity = 0;

  // Scene bounds (used by kinematic path - physics uses colliders instead)
  const SCENE_BOUNDS = {
    minX: -50.0,  // 50 meters (large for exploration)
    maxX: 50.0,
    minZ: -50.0,
    maxZ: 50.0,
  };

  // Capsule geometry: halfHeight=0.55 + radius=0.3 = 0.85m half-extent
  // The physics position is the capsule CENTER, so feet are at (targetY - 0.85)
  const CAPSULE_HALF_EXTENT = 0.85;

  // Camera settings (all distances/heights in meters)
  // Orbit mode settings are in Scene3D.svelte's OrbitControls
  const SETTINGS = {
    lookSensitivity: SCALE.MOUSE_SENSITIVITY,
    // Third person
    thirdPerson: {
      distance: 3.0,        // 3 meters behind avatar
      height: 1.15,         // Camera 2m above feet = 2.0 - CAPSULE_HALF_EXTENT
      lookAtHeight: 0.35,   // Look at chest 1.2m above feet = 1.2 - CAPSULE_HALF_EXTENT
      minPitch: -0.3,
      maxPitch: 1.2,
    },
    // First person
    firstPerson: {
      height: 0.75,         // Eye level 1.6m above feet = 1.6 - CAPSULE_HALF_EXTENT
      forwardOffset: 0.05,  // 5cm forward offset
      minPitch: -1.4,
      maxPitch: 1.4,
    },
  };

  function cycleMode() {
    mode = cameraPreferences.cycleMode(destinationId);
    onModeChange?.(mode);

    // If entering orbit, exit pointer lock
    if (mode === CameraMode.ORBIT && isPointerLocked) {
      document.exitPointerLock();
    }
  }

  function returnToOrbit() {
    if (mode !== CameraMode.ORBIT) {
      cameraPreferences.setModeForDestination(destinationId, CameraMode.ORBIT);
      mode = CameraMode.ORBIT;
      onModeChange?.(mode);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!enabled) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // V key cycles camera mode (works without pointer lock)
    if (e.code === "KeyV") {
      e.preventDefault();
      cycleMode();
      return;
    }

    // ESC returns to orbit mode
    if (e.code === "Escape" && mode !== CameraMode.ORBIT) {
      e.preventDefault();
      returnToOrbit();
      return;
    }

    // Only track movement keys in game modes
    if (isGameMode(mode)) {
      keys.add(e.code);

      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!enabled) return;

    // Orbit mode: handled by Scene3D's OrbitControls - we don't touch the mouse
    if (mode === CameraMode.ORBIT) return;

    // Game modes: pointer lock mouse look
    if (isPointerLocked) {
      yaw -= e.movementX * SETTINGS.lookSensitivity;
      pitch += e.movementY * SETTINGS.lookSensitivity;

      const config = mode === CameraMode.FIRST_PERSON ? SETTINGS.firstPerson : SETTINGS.thirdPerson;
      pitch = Math.max(config.minPitch, Math.min(config.maxPitch, pitch));
    }
  }

  function handleWheel(e: WheelEvent) {
    // Orbit mode zoom is handled by Scene3D's OrbitControls
    // This handler is no longer needed but kept for potential future use
  }

  function handlePointerLockChange() {
    const wasLocked = isPointerLocked;
    isPointerLocked = document.pointerLockElement === renderer.domElement;

    // If we lost pointer lock (e.g., ESC pressed), return to orbit
    if (wasLocked && !isPointerLocked && mode !== CameraMode.ORBIT) {
      returnToOrbit();
    }
  }

  function handleCanvasClick() {
    if (!enabled) return;

    // In orbit mode, clicking enters third-person mode with pointer lock
    if (mode === CameraMode.ORBIT) {
      cameraPreferences.setModeForDestination(destinationId, CameraMode.THIRD_PERSON);
      mode = CameraMode.THIRD_PERSON;
      onModeChange?.(mode);
    }

    // Request pointer lock for game modes
    if (isGameMode(mode)) {
      renderer.domElement.requestPointerLock();
    }
  }

  function handleBlur() {
    keys.clear();
  }

  onMount(() => {
    if (!enabled) return;

    const canvas = renderer.domElement;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
  });

  onDestroy(() => {
    const canvas = renderer.domElement;

    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    canvas?.removeEventListener("click", handleCanvasClick);
    canvas?.removeEventListener("wheel", handleWheel);

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });

  // Notify parent of rotation changes (for MCP bridge)
  $effect(() => {
    onRotationChange?.(yaw, pitch);
  });

  // Handle external rotation changes (from MCP)
  $effect(() => {
    if (externalYaw !== null && externalYaw !== undefined) {
      yaw = externalYaw;
    }
  });

  $effect(() => {
    if (externalPitch !== null && externalPitch !== undefined) {
      const config = mode === CameraMode.FIRST_PERSON ? SETTINGS.firstPerson : SETTINGS.thirdPerson;
      pitch = Math.max(config.minPitch, Math.min(config.maxPitch, externalPitch));
    }
  });

  // Game loop
  useTask((delta) => {
    if (!enabled || !camera.current) return;

    // ORBIT MODE: Delegate to Scene3D's OrbitControls - don't fight with it!
    // Scene3D has a proper OrbitControls component that handles orbit mode.
    // We only handle input and mode switching here, not camera positioning.
    if (mode === CameraMode.ORBIT) {
      avatarState.setMoveInput({ x: 0, z: 0 });
      return; // Let OrbitControls handle the camera
    }

    // GAME MODES (First-Person, Third-Person): Handle camera and movement

    // Get target position (from physics provider or avatar state)
    let targetX: number;
    let targetY: number;
    let targetZ: number;

    if (usePhysics && physicsProvider) {
      const pos = physicsProvider.getPlayerPosition();
      targetX = pos.x;
      targetY = pos.y;
      targetZ = pos.z;
    } else {
      targetX = avatarState.position.x;
      targetY = avatarState.position.y ?? 0;
      targetZ = avatarState.position.z;
    }

    // Ensure far plane is large enough
    if ("far" in camera.current && camera.current.far < 10000) {
      camera.current.far = 10000;
      camera.current.updateProjectionMatrix();
    }

    // Game modes: WASD movement
    // UNIFIED movement calculation for both Stage (kinematic) and Worlds (physics)
    // Uses camera matrix to extract forward/right (like Three.js PointerLockControls)

    const forwardInput = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
                        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafeInput = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
                       (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const isSprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const isJumping = keys.has("Space");
    const hasMovementInput = forwardInput !== 0 || strafeInput !== 0;

    // === UNIFIED DIRECTION CALCULATION ===
    // Extract forward/right from camera matrix (works regardless of yaw convention)
    const cam = camera.current;
    const _forward = new Vector3();
    const _right = new Vector3();

    // Get right vector from camera's X-axis, then cross with up to get forward
    // This keeps movement on XZ plane (no flying when looking up/down)
    _right.setFromMatrixColumn(cam.matrix, 0);
    _forward.crossVectors(cam.up, _right);

    // Calculate speed
    const speed = isSprinting ? moveSpeed * sprintMultiplier : moveSpeed;

    // Build movement vector from camera-relative directions
    let moveX = (_forward.x * forwardInput + _right.x * strafeInput) * speed * delta;
    let moveZ = (_forward.z * forwardInput + _right.z * strafeInput) * speed * delta;

    // Normalize diagonal movement to prevent faster diagonal speed
    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > speed * delta) {
      const scale = (speed * delta) / moveLen;
      moveX *= scale;
      moveZ *= scale;
    }

    // === APPLY MOVEMENT (differs by physics vs kinematic) ===
    if (usePhysics && physicsProvider) {
        // Physics path: handle jumping and gravity
        if (isJumping && physicsProvider.isGrounded() && verticalVelocity <= 0) {
          verticalVelocity = jumpForce;
        }
        if (!physicsProvider.isGrounded()) {
          verticalVelocity -= gravity * delta;
          verticalVelocity = Math.max(verticalVelocity, SCALE.TERMINAL_VELOCITY);
        } else if (verticalVelocity < 0) {
          verticalVelocity = 0;
        }

        // Apply through physics provider (handles collisions)
        physicsProvider.movePlayer(
          { x: moveX, y: verticalVelocity * delta, z: moveZ },
          delta
        );

        // Read back position from physics
        const newPos = physicsProvider.getPlayerPosition();
        targetX = newPos.x;
        targetY = newPos.y;
        targetZ = newPos.z;

        // Sync to avatarState
        avatarState.position.x = targetX;
        if (avatarState.position.y !== undefined) {
          avatarState.position.y = targetY;
        }
        avatarState.position.z = targetZ;
      } else {
        // Kinematic path: same gravity/jumping as physics, just no collision detection
        const isGrounded = (avatarState.position.y ?? 0) <= 0;

        // Handle jumping (same as physics path)
        if (isJumping && isGrounded && verticalVelocity <= 0) {
          verticalVelocity = jumpForce;
        }

        // Apply gravity (same as physics path)
        if (!isGrounded) {
          verticalVelocity -= gravity * delta;
          verticalVelocity = Math.max(verticalVelocity, SCALE.TERMINAL_VELOCITY);
        } else if (verticalVelocity < 0) {
          verticalVelocity = 0;
        }

        // Apply movement
        let newX = avatarState.position.x + moveX;
        let newY = (avatarState.position.y ?? 0) + verticalVelocity * delta;
        let newZ = avatarState.position.z + moveZ;

        // Clamp to scene bounds (kinematic only - physics uses colliders)
        newX = Math.max(SCENE_BOUNDS.minX, Math.min(SCENE_BOUNDS.maxX, newX));
        newZ = Math.max(SCENE_BOUNDS.minZ, Math.min(SCENE_BOUNDS.maxZ, newZ));
        newY = Math.max(0, newY); // Ground is at y=0

        // Update position
        avatarState.position.x = newX;
        if (avatarState.position.y !== undefined) {
          avatarState.position.y = newY;
        }
        avatarState.position.z = newZ;

        // Read back position
        targetX = avatarState.position.x;
        targetY = avatarState.position.y ?? 0;
        targetZ = avatarState.position.z;
      }

      // === UNIFIED STATE UPDATES ===
      // Update movement state for walk animation
      avatarState.setMoveInput({ x: strafeInput, z: forwardInput });

      // Avatar faces camera direction when moving (standard 3rd person convention)
      if (mode === CameraMode.THIRD_PERSON && hasMovementInput) {
        const facingAngle = Math.atan2(_forward.x, _forward.z);
        avatarState.setFacingAngle(facingAngle);
      }

      if (mode === CameraMode.FIRST_PERSON) {
        // First-person: camera IS the avatar's eyes
        // Avatar always faces where you're looking (you turn your body when you turn your head)
        avatarState.setFacingAngle(yaw);

        const cfg = SETTINGS.firstPerson;
        const camX = targetX + Math.sin(yaw) * cfg.forwardOffset;
        const camY = targetY + cfg.height;
        const camZ = targetZ + Math.cos(yaw) * cfg.forwardOffset;

        camera.current.position.set(camX, camY, camZ);

        const lookDistance = 100;
        const lookX = camX + Math.sin(yaw) * lookDistance * Math.cos(pitch);
        const lookY = camY - Math.sin(pitch) * lookDistance;
        const lookZ = camZ + Math.cos(yaw) * lookDistance * Math.cos(pitch);

        camera.current.lookAt(lookX, lookY, lookZ);

      } else {
        // Third-person: camera behind avatar
        const cfg = SETTINGS.thirdPerson;
        const cosPitch = Math.cos(pitch);
        const camX = targetX - Math.sin(yaw) * cfg.distance * cosPitch;
        const camY = targetY + cfg.height + Math.sin(pitch) * cfg.distance * 0.5;
        const camZ = targetZ - Math.cos(yaw) * cfg.distance * cosPitch;

        camera.current.position.set(camX, camY, camZ);
        camera.current.lookAt(targetX, targetY + cfg.lookAtHeight, targetZ);
      }
  });

  // Mode label for UI
  const modeLabel = $derived(
    mode === CameraMode.ORBIT ? "Orbit" :
    mode === CameraMode.THIRD_PERSON ? "3rd Person" : "1st Person"
  );

  const modeIcon = $derived(
    mode === CameraMode.ORBIT ? "fa-arrows-rotate" :
    mode === CameraMode.THIRD_PERSON ? "fa-user" : "fa-eye"
  );
</script>

<!-- Controls hint (when not in game mode or not pointer locked) -->
{#if enabled && (mode === CameraMode.ORBIT || !isPointerLocked)}
  <div class="controls-hint">
    {#if mode === CameraMode.ORBIT}
      <span>Drag to orbit • Click to enter game mode</span>
    {:else}
      <span>Click to look around</span>
    {/if}
    <div class="controls">
      <kbd>V</kbd> {modeLabel}
      {#if isGameMode(mode)}
        <kbd>WASD</kbd> Move
        <kbd>Mouse</kbd> Look
        {#if usePhysics}
          <kbd>Shift</kbd> Sprint
          <kbd>Space</kbd> Jump
        {/if}
      {:else}
        <kbd>Scroll</kbd> Zoom
      {/if}
    </div>
  </div>
{/if}

<!-- Mode indicator (when pointer locked in game mode) -->
{#if enabled && isPointerLocked && isGameMode(mode)}
  <div class="mode-indicator">
    <i class="fas {modeIcon}"></i>
    <span>{modeLabel}</span>
    <span class="hint">V to switch • ESC to exit</span>
  </div>
{/if}

<style>
  .controls-hint {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    font-size: 14px;
    pointer-events: none;
    z-index: 50;
  }

  .controls {
    display: flex;
    gap: 0.75rem;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .controls kbd {
    padding: 0.2rem 0.5rem;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
  }

  .mode-indicator {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: white;
    font-size: 13px;
    pointer-events: none;
    z-index: 50;
  }

  .mode-indicator i {
    font-size: 14px;
    opacity: 0.9;
  }

  .mode-indicator .hint {
    margin-left: 0.5rem;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
