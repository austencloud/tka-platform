<script lang="ts">
  /**
   * LocomotionController
   *
   * Unified locomotion controller using the new 3D primitives.
   * Works on desktop (pointer lock) AND mobile/DevTools (touch/drag).
   *
   * Features:
   * - Automatic input detection via InputCapabilities
   * - Keyboard + pointer lock on desktop
   * - Touch joystick + drag-to-look on mobile
   * - Gamepad support when connected
   * - Inertia for smooth camera stopping
   *
   * This fixes the mobile/DevTools bug where pointer lock would silently fail.
   */
  import { onMount, onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";

  // New 3D primitives
  import { AdaptiveInputProvider } from "$lib/shared/3d/input/InputProviderFactory";
  import { CameraController } from "$lib/shared/3d/camera/CameraController";
  import { ThirdPersonOrbit } from "$lib/shared/3d/camera/behaviors/ThirdPersonOrbit";
  import { FirstPersonLook } from "$lib/shared/3d/camera/behaviors/FirstPersonLook";
  import { CameraDamping } from "$lib/shared/3d/camera/behaviors/CameraDamping";
  import { CameraConstraints } from "$lib/shared/3d/camera/behaviors/CameraConstraints";
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import { CameraMode } from "$lib/shared/3d-core/camera/types";
  import { cameraPreferences } from "$lib/shared/3d-core/camera/camera-preferences.svelte";

  // Touch UI
  import VirtualJoystick from "$lib/shared/components/touch/VirtualJoystick.svelte";

  // Minimal interface for avatar state compatibility
  interface LocomotionState {
    position: { x: number; y?: number; z: number };
    facingAngle: number;
    isMoving: boolean;
    setMoveInput: (input: { x: number; z: number }) => void;
    updateMovement: (delta: number, cameraAngle: number) => void;
  }

  interface Props {
    /** Avatar state with locomotion methods */
    avatarState: LocomotionState;
    /** Whether locomotion is enabled */
    enabled?: boolean;
    /** Distance of camera from avatar */
    cameraDistance?: number;
    /** Height of camera above avatar */
    cameraHeight?: number;
    /** Current camera mode (first/third person) */
    cameraMode?: CameraMode;
    /** Callback when camera mode changes */
    onCameraModeChange?: (mode: CameraMode) => void;
    /** Callback when pointer lock state changes */
    onPointerLockChange?: (locked: boolean) => void;
  }

  let {
    avatarState,
    enabled = true,
    cameraDistance = 8,
    cameraHeight = 3,
    cameraMode = CameraMode.THIRD_PERSON,
    onCameraModeChange,
    onPointerLockChange,
  }: Props = $props();

  const { renderer, camera } = useThrelte();
  const inputCaps = getInputCapabilities();

  // Input provider (adapts to current input type)
  let inputProvider: AdaptiveInputProvider | null = null;

  // Camera controller with behaviors
  let cameraController: CameraController | null = null;
  let orbitBehavior: ThirdPersonOrbit | null = null;
  let firstPersonBehavior: FirstPersonLook | null = null;
  let constraintsBehavior: CameraConstraints | null = null;

  // Show touch UI when needed
  let showTouchUI = $state(false);

  // Track if we've ever initialized (for cleanup)
  let initialized = false;

  // Internal camera mode state (tracks prop, allows local changes)
  let currentCameraMode = $state(cameraMode);

  /**
   * Apply the appropriate camera behavior based on current mode
   */
  function updateCameraBehavior() {
    if (!cameraController) return;

    // Remove current behaviors
    if (orbitBehavior) cameraController.removeBehavior(orbitBehavior);
    if (firstPersonBehavior) cameraController.removeBehavior(firstPersonBehavior);

    // Add appropriate behavior
    if (currentCameraMode === CameraMode.FIRST_PERSON) {
      if (firstPersonBehavior) cameraController.addBehavior(firstPersonBehavior);
    } else {
      if (orbitBehavior) cameraController.addBehavior(orbitBehavior);
    }
  }

  /**
   * Handle V key to toggle camera mode
   */
  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'KeyV' && enabled) {
      const newMode = currentCameraMode === CameraMode.FIRST_PERSON
        ? CameraMode.THIRD_PERSON
        : CameraMode.FIRST_PERSON;
      currentCameraMode = newMode;
      cameraPreferences.setModeForDestination('stage', newMode);
      onCameraModeChange?.(newMode);
      updateCameraBehavior();
    }
  }

  onMount(() => {
    if (!enabled) return;

    const canvas = renderer.domElement;

    // Initialize input capabilities
    inputCaps.init();

    // Create adaptive input provider
    inputProvider = new AdaptiveInputProvider(inputCaps, canvas, {
      lookSensitivity: 0.002,
      movementDeadzone: 0.15,
      inertiaDecay: 0.92,
    });
    inputProvider.enable();

    // Create camera controller
    cameraController = new CameraController({
      initialYaw: 0,
      initialPitch: 0.3,
      initialDistance: cameraDistance,
    });

    // Create BOTH behaviors (but only add the active one)
    orbitBehavior = new ThirdPersonOrbit({
      distance: cameraDistance,
      heightOffset: cameraHeight,
      maxPitch: Math.PI / 2.5,
      minPitch: -0.3,
      scaleByDistance: false,
    });

    firstPersonBehavior = new FirstPersonLook({
      eyeHeight: 1.7,
      maxPitch: Math.PI / 2.2,
      minPitch: -Math.PI / 2.2,
      sensitivity: 1.0,
    });

    // Constraints apply to both modes
    constraintsBehavior = new CameraConstraints({
      maxPitch: Math.PI / 2.5,
      minPitch: -0.3,
    });
    cameraController.addBehavior(constraintsBehavior);

    // Damping for smooth camera
    cameraController.addBehavior(new CameraDamping({
      positionSmoothTime: 0.1,
      rotationSmoothTime: 0.08,
    }));

    // Add the active camera behavior
    updateCameraBehavior();

    // Listen for V key
    window.addEventListener('keydown', handleKeyDown);

    initialized = true;

    // Update touch UI state based on input capabilities
    updateTouchUI();
  });

  function updateTouchUI() {
    showTouchUI = inputCaps.shouldShowTouchUI();
  }

  // Handle joystick input (from VirtualJoystick)
  function handleJoystickInput(x: number, y: number) {
    if (!enabled) return;
    // Convert joystick to movement input
    // y is forward/back, x is strafe
    avatarState.setMoveInput({ x, z: y });
  }

  // Game loop
  useTask((delta) => {
    if (!enabled || !inputProvider || !cameraController) return;

    // Update input provider (for inertia, etc.)
    inputProvider.update(delta);

    // Update touch UI visibility
    updateTouchUI();

    // Get input
    const lookDelta = inputProvider.getLookDelta();
    const moveInput = inputProvider.getMovementInput();

    // Update camera target to follow avatar
    cameraController.setTarget({
      x: avatarState.position.x,
      y: avatarState.position.y ?? 0,
      z: avatarState.position.z,
    });

    // Update camera
    cameraController.update(delta, lookDelta);

    // Apply camera to Three.js camera
    if (camera.current) {
      cameraController.applyToCamera(camera.current);
    }

    // Get camera yaw for movement direction
    const cameraAngle = cameraController.getYaw();

    // Set movement input from keyboard/gamepad (touch handled by joystick)
    if (!showTouchUI) {
      avatarState.setMoveInput({ x: moveInput.strafe, z: moveInput.forward });
    }

    // Update avatar movement
    avatarState.updateMovement(delta, cameraAngle);

    // Notify parent about pointer lock state
    const pointerLockProvider = inputProvider.getPointerLockProvider();
    onPointerLockChange?.(pointerLockProvider.isPointerLocked());
  });

  // Cleanup
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    if (inputProvider) {
      inputProvider.dispose();
      inputProvider = null;
    }
    inputCaps.destroy();
    cameraController = null;
    initialized = false;
  });

  // Re-initialize when enabled changes
  $effect(() => {
    if (enabled && !initialized && typeof window !== "undefined") {
      // Re-mount
      onMount(() => {});
    } else if (!enabled && initialized) {
      // Disable input
      inputProvider?.disable();
    } else if (enabled && initialized) {
      // Re-enable input
      inputProvider?.enable();
    }
  });

  // Sync external cameraMode prop changes
  $effect(() => {
    if (cameraMode !== currentCameraMode) {
      currentCameraMode = cameraMode;
      updateCameraBehavior();
    }
  });
</script>

<!-- Touch controls (virtual joystick + drag hint) -->
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
    <span>Drag right side to look around</span>
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
