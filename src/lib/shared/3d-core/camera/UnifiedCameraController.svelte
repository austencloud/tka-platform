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
   */
  import { onMount, onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";
  import { CameraMode, getNextCameraMode, isGameMode } from "./types";
  import { cameraPreferences } from "./camera-preferences.svelte";
  import { OrbitControls } from "@threlte/extras";

  interface AvatarState {
    position: { x: number; y?: number; z: number };
    facingAngle: number;
    isMoving: boolean;
    setMoveInput: (input: { x: number; z: number }) => void;
    updateMovement: (delta: number, cameraAngle: number) => void;
  }

  interface Props {
    /** Destination ID for preference persistence (e.g., "stage", "gallery") */
    destinationId: string;
    /** Avatar state for movement and camera following */
    avatarState: AvatarState;
    /** Whether the controller is active */
    enabled?: boolean;
    /** Callback when mode changes */
    onModeChange?: (mode: CameraMode) => void;
  }

  let {
    destinationId,
    avatarState,
    enabled = true,
    onModeChange,
  }: Props = $props();

  const { renderer, camera } = useThrelte();

  // Current camera mode (from preferences)
  let mode = $state<CameraMode>(cameraPreferences.getModeForDestination(destinationId));

  // Camera state
  let yaw = $state(0);
  let pitch = $state(0.3);
  let isPointerLocked = $state(false);

  // Orbit mode state
  let orbitYaw = $state(0);
  let orbitPitch = $state(0.4);
  let orbitDistance = $state(400);

  // Movement keys
  const keys = new Set<string>();

  // Camera settings
  const SETTINGS = {
    lookSensitivity: 0.002,
    // Third person
    thirdPerson: {
      distance: 250,
      height: 120,
      lookAtHeight: 40,
      minPitch: -0.3,
      maxPitch: 1.2,
    },
    // First person
    firstPerson: {
      height: 85,
      forwardOffset: 5,
      minPitch: -1.4,
      maxPitch: 1.4,
    },
    // Orbit
    orbit: {
      minDistance: 100,
      maxDistance: 1000,
      minPitch: 0.1,
      maxPitch: 1.5,
      dragSensitivity: 0.005,
      zoomSpeed: 0.1,
      height: 50, // Target height above ground
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

      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!enabled) return;

    if (mode === CameraMode.ORBIT) {
      // Orbit mode: drag to rotate (no pointer lock needed)
      if (e.buttons === 1) { // Left mouse button
        orbitYaw -= e.movementX * SETTINGS.orbit.dragSensitivity;
        orbitPitch += e.movementY * SETTINGS.orbit.dragSensitivity;
        orbitPitch = Math.max(SETTINGS.orbit.minPitch, Math.min(SETTINGS.orbit.maxPitch, orbitPitch));
      }
    } else if (isPointerLocked) {
      // Game modes: pointer lock mouse look
      yaw -= e.movementX * SETTINGS.lookSensitivity;
      pitch += e.movementY * SETTINGS.lookSensitivity;

      const config = mode === CameraMode.FIRST_PERSON ? SETTINGS.firstPerson : SETTINGS.thirdPerson;
      pitch = Math.max(config.minPitch, Math.min(config.maxPitch, pitch));
    }
  }

  function handleWheel(e: WheelEvent) {
    if (!enabled || mode !== CameraMode.ORBIT) return;

    e.preventDefault();
    orbitDistance += e.deltaY * SETTINGS.orbit.zoomSpeed;
    orbitDistance = Math.max(SETTINGS.orbit.minDistance, Math.min(SETTINGS.orbit.maxDistance, orbitDistance));
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

  // Game loop
  useTask((delta) => {
    if (!enabled || !camera.current) return;

    const target = avatarState.position;
    const targetY = target.y ?? 0;

    // Ensure far plane is large enough
    if ("far" in camera.current && camera.current.far < 10000) {
      camera.current.far = 10000;
      camera.current.updateProjectionMatrix();
    }

    if (mode === CameraMode.ORBIT) {
      // Orbit mode: camera rotates around avatar, no movement
      avatarState.setMoveInput({ x: 0, z: 0 });

      const camX = target.x + Math.sin(orbitYaw) * orbitDistance * Math.cos(orbitPitch);
      const camY = targetY + SETTINGS.orbit.height + Math.sin(orbitPitch) * orbitDistance;
      const camZ = target.z + Math.cos(orbitYaw) * orbitDistance * Math.cos(orbitPitch);

      camera.current.position.set(camX, camY, camZ);
      camera.current.lookAt(target.x, targetY + SETTINGS.orbit.height, target.z);

    } else {
      // Game modes: WASD movement
      const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
                     (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
                    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);

      avatarState.setMoveInput({ x: strafe, z: forward });
      avatarState.updateMovement(delta, yaw);

      if (mode === CameraMode.FIRST_PERSON) {
        // First-person: camera at eye level
        const cfg = SETTINGS.firstPerson;
        const camX = target.x + Math.sin(yaw) * cfg.forwardOffset;
        const camY = targetY + cfg.height;
        const camZ = target.z + Math.cos(yaw) * cfg.forwardOffset;

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
        const camX = target.x - Math.sin(yaw) * cfg.distance * cosPitch;
        const camY = targetY + cfg.height + Math.sin(pitch) * cfg.distance * 0.5;
        const camZ = target.z - Math.cos(yaw) * cfg.distance * cosPitch;

        camera.current.position.set(camX, camY, camZ);
        camera.current.lookAt(target.x, targetY + cfg.lookAtHeight, target.z);
      }
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
