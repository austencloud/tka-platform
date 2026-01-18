<script lang="ts">
  /**
   * LocomotionController
   *
   * WASD movement + mouse look with first/third person toggle.
   * - WASD: Move the avatar
   * - Mouse: Look around (when pointer locked)
   * - V: Toggle between first-person and third-person
   * - ESC: Exit pointer lock
   * - Click: Enter pointer lock
   */
  import { onMount, onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";

  type CameraView = "first-person" | "third-person";

  interface LocomotionState {
    position: { x: number; y?: number; z: number };
    facingAngle: number;
    isMoving: boolean;
    setMoveInput: (input: { x: number; z: number }) => void;
    updateMovement: (delta: number, cameraAngle: number) => void;
  }

  interface Props {
    avatarState: LocomotionState;
    enabled?: boolean;
    initialView?: CameraView;
    onPointerLockChange?: (locked: boolean) => void;
    onViewChange?: (view: CameraView) => void;
  }

  let {
    avatarState,
    enabled = true,
    initialView = "third-person",
    onPointerLockChange,
    onViewChange,
  }: Props = $props();

  const { renderer, camera } = useThrelte();

  // Camera view mode
  let cameraView = $state<CameraView>(initialView);

  // Third-person camera settings
  const THIRD_PERSON = {
    distance: 250,
    height: 120,
    lookAtHeight: 40,
  };

  // First-person camera settings
  const FIRST_PERSON = {
    height: 85, // Eye level (avatar is ~100 units tall)
    forwardOffset: 5, // Slightly in front of avatar center
  };

  const LOOK_SENSITIVITY = 0.002;

  // Camera state
  let yaw = $state(0);
  let pitch = $state(0.3);
  let isPointerLocked = $state(false);

  // Movement keys
  const keys = new Set<string>();

  function toggleCameraView() {
    cameraView = cameraView === "first-person" ? "third-person" : "first-person";
    onViewChange?.(cameraView);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!enabled) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // V key toggles camera view
    if (e.code === "KeyV") {
      e.preventDefault();
      toggleCameraView();
      return;
    }

    keys.add(e.code);

    // Prevent scrolling
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!enabled || !isPointerLocked) return;

    yaw -= e.movementX * LOOK_SENSITIVITY;
    pitch += e.movementY * LOOK_SENSITIVITY;

    // Clamp pitch (more restricted in first-person)
    const maxPitch = cameraView === "first-person" ? 1.4 : 1.2;
    const minPitch = cameraView === "first-person" ? -1.4 : -0.3;
    pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
  }

  function handlePointerLockChange() {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
    onPointerLockChange?.(isPointerLocked);
  }

  function handleCanvasClick() {
    if (!enabled) return;
    renderer.domElement.requestPointerLock();
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
  });

  onDestroy(() => {
    const canvas = renderer.domElement;

    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    canvas?.removeEventListener("click", handleCanvasClick);

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });

  // Game loop
  useTask((delta) => {
    if (!enabled) return;

    // Movement from keys
    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
                   (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
                  (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);

    avatarState.setMoveInput({ x: strafe, z: forward });
    avatarState.updateMovement(delta, yaw);

    // Update camera
    if (camera.current) {
      const target = avatarState.position;
      const targetY = target.y ?? 0;

      // Ensure far plane is large enough
      if ("far" in camera.current && camera.current.far < 10000) {
        camera.current.far = 10000;
        camera.current.updateProjectionMatrix();
      }

      if (cameraView === "first-person") {
        // First-person: camera at eye level, looking forward
        const camX = target.x + Math.sin(yaw) * FIRST_PERSON.forwardOffset;
        const camY = targetY + FIRST_PERSON.height;
        const camZ = target.z + Math.cos(yaw) * FIRST_PERSON.forwardOffset;

        camera.current.position.set(camX, camY, camZ);

        // Look in the direction we're facing
        const lookDistance = 100;
        const lookX = camX + Math.sin(yaw) * lookDistance * Math.cos(pitch);
        const lookY = camY - Math.sin(pitch) * lookDistance;
        const lookZ = camZ + Math.cos(yaw) * lookDistance * Math.cos(pitch);

        camera.current.lookAt(lookX, lookY, lookZ);
      } else {
        // Third-person: camera behind and above avatar
        const cosPitch = Math.cos(pitch);
        const camX = target.x - Math.sin(yaw) * THIRD_PERSON.distance * cosPitch;
        const camY = targetY + THIRD_PERSON.height + Math.sin(pitch) * THIRD_PERSON.distance * 0.5;
        const camZ = target.z - Math.cos(yaw) * THIRD_PERSON.distance * cosPitch;

        camera.current.position.set(camX, camY, camZ);
        camera.current.lookAt(target.x, targetY + THIRD_PERSON.lookAtHeight, target.z);
      }
    }
  });
</script>

<!-- Controls hint -->
{#if enabled && !isPointerLocked}
  <div class="lock-hint">
    <span>Click to look around</span>
    <div class="controls">
      <kbd>WASD</kbd> Move
      <kbd>Mouse</kbd> Look
      <kbd>V</kbd> Toggle View
      <kbd>Esc</kbd> Exit
    </div>
  </div>
{/if}

<!-- Camera mode indicator (when pointer locked) -->
{#if enabled && isPointerLocked}
  <div class="mode-indicator">
    <i class="fas" class:fa-eye={cameraView === "first-person"} class:fa-user={cameraView === "third-person"}></i>
    <span>{cameraView === "first-person" ? "1st Person" : "3rd Person"}</span>
    <span class="hint">V to switch</span>
  </div>
{/if}

<style>
  .lock-hint {
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
