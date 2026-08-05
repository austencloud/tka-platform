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
  import { onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";
  import { Vector3, Raycaster, Mesh, PerspectiveCamera } from "three";
  import {
    CameraMode,
    getNextCameraMode,
    isGameMode,
    type PhysicsProvider,
    type AvatarState,
  } from "./types";
  import { cameraPreferences } from "./camera-preferences.svelte";
  import { SCALE } from "@austencloud/scene-3d";
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import {
    CLEAN_FLY_INTERACTION,
    flushFlyInteraction,
    markFlyInteractionDirty,
    type FlyInteractionDirtyState,
    type FlyInteractionKind,
  } from "../domain/fly-interaction-dirty";

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
    /** Initial yaw angle (radians) - used for HMR position restoration */
    initialYaw?: number;
    /** Initial pitch angle (radians) - used for HMR position restoration */
    initialPitch?: number;
    /** External yaw setter (for MCP control) */
    externalYaw?: number | null;
    /** External pitch setter (for MCP control) */
    externalPitch?: number | null;
    /** Restrict which modes the V-key cycle includes. If omitted, all modes are allowed. */
    allowedModes?: CameraMode[];
    /** When true, disable the V-key mode toggle (parent controls mode externally via Q cycle) */
    disableModeToggle?: boolean;
    onInteractionEnd?: (kind: FlyInteractionKind) => void;
  }

  const props: Props = $props();

  // Convenience aliases for props used frequently (these are $derived, safe in closures)
  const destinationId = $derived(props.destinationId);
  const avatarState = $derived(props.avatarState);
  const physicsProvider = $derived(props.physicsProvider ?? null);
  const enabled = $derived(props.enabled ?? true);
  const moveSpeed = $derived(props.moveSpeed ?? SCALE.WALK_SPEED);
  const sprintMultiplier = $derived(
    props.sprintMultiplier ?? SCALE.SPRINT_MULTIPLIER
  );
  const jumpForce = $derived(props.jumpForce ?? SCALE.JUMP_VELOCITY);
  const gravity = $derived(props.gravity ?? Math.abs(SCALE.GRAVITY) * 2.5);
  const allowedModes = $derived(props.allowedModes);

  // Derived: are we using physics-based movement?
  const usePhysics = $derived(physicsProvider !== null);

  const { renderer, camera, scene } = useThrelte();

  // Current camera mode - load from preferences once on init, not continuously.
  // Access destinationId through $derived alias so the compiler tracks it reactively.
  const _initMode = $derived(
    cameraPreferences.getModeForDestination(destinationId)
  );
  let mode = $state<CameraMode>(CameraMode.ORBIT);
  // Sync mode from preferences when destination changes
  $effect.pre(() => {
    mode = _initMode;
  });

  // Camera state (for game modes - orbit mode uses Scene3D's OrbitControls)
  // Use initial values from props for HMR restoration
  let yaw = $state(0);
  let pitch = $state(0);
  $effect.pre(() => {
    yaw = props.initialYaw ?? 0;
    pitch = props.initialPitch ?? 0.3;
  });
  let isPointerLocked = $state(false);

  // Movement keys
  const keys = new Set<string>();
  const MOVEMENT_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyC",
    "Space",
    "ShiftLeft",
    "ShiftRight",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);
  let flyInteractionState: FlyInteractionDirtyState = {
    ...CLEAN_FLY_INTERACTION,
  };

  function markFlyInteraction(kind: "keyboard" | "pointer"): void {
    flyInteractionState = markFlyInteractionDirty(flyInteractionState, kind);
  }

  function flushCompletedInteraction(): void {
    const result = flushFlyInteraction(flyInteractionState);
    flyInteractionState = result.state;
    if (result.kind) props.onInteractionEnd?.(result.kind);
  }

  // Input capabilities for detecting touch vs mouse
  const inputCaps = getInputCapabilities();

  // Cached canvas reference (set on attach, used in detach when renderer.current may be gone)
  let cachedCanvas: HTMLCanvasElement | null = null;

  // Drag-to-look state (used when pointer lock isn't available - touch, DevTools simulation)
  let isDragging = $state(false);
  let lastPointerPos = { x: 0, y: 0 };

  // Vertical velocity (used by BOTH physics and kinematic paths for jumping)
  let verticalVelocity = 0;

  // Noclip mode state (synced with physics provider)
  let noclipEnabled = $state(false);

  // Crouch camera offset - smoothly lerps between 0 (standing) and the delta
  // between standing and crouching eye height so the viewpoint drops gradually.
  let crouchHeightOffset = 0;
  const CROUCH_HEIGHT_DROP = SCALE.EYE_HEIGHT - SCALE.CROUCH_EYE_HEIGHT; // ~0.65m
  const CROUCH_LERP_SPEED = 8; // same responsiveness as camera damping

  /**
   * A physics provider that can report an upward lift column at the player's
   * position (the museum's grid provider does; the generic ones do not). Kept
   * structural rather than added to the shared PhysicsProvider interface — the
   * seam belongs to the museum, and every other provider stays untouched.
   */
  type LiftingPhysicsProvider = { updraftSpeedAtPlayer?: () => number };

  /**
   * How fast vertical velocity approaches a lift column's speed, per second.
   * 6 puts ~95% of the ease inside the first 0.5s: enough to feel like the air
   * takes hold of you, short enough that it costs the rise ~0.17m.
   */
  const UPDRAFT_RISE_EASE = 6;

  // Scene bounds (used by kinematic path - physics uses colliders instead)
  const SCENE_BOUNDS = {
    minX: -50.0, // 50 meters (large for exploration)
    maxX: 50.0,
    minZ: -50.0,
    maxZ: 50.0,
  };

  // Capsule geometry: halfHeight=0.55 + radius=0.3 = 0.85m half-extent
  // The physics position is the capsule CENTER, so feet are at (targetY - 0.85)
  const CAPSULE_HALF_EXTENT = 0.85;

  // Raycaster for camera terrain collision (prevents camera clipping through terrain)
  const cameraRaycaster = new Raycaster();
  const rayOrigin = new Vector3();
  const rayDirection = new Vector3();
  const desiredCamPos = new Vector3();
  // Spring arm camera collision (matches ecctrl/Unreal spring arm pattern)
  const CAMERA_COLLISION_OFFSET = 0.3;
  const MIN_CAMERA_DISTANCE = 0.5;
  let smoothedCameraDistance = 5.0; // Must match SETTINGS.thirdPerson.distance
  let desiredDistance = 5.0; // User-controlled via scroll wheel
  // Time-based lerp speeds (used with exponential decay for framerate independence)
  const CAMERA_PULL_IN_SPEED = 10; // Fast pull-in when wall detected (~100ms)
  const CAMERA_RECOVERY_SPEED = 3; // Slower recovery when wall clears (~333ms)

  // Smoothed camera POSITION for third-person mode (prevents jitter from yaw micro-changes,
  // avatar sub-frame movement, and raycast collision oscillation). Instead of snapping the
  // camera to the computed orbit position each frame, we lerp toward it. This absorbs all
  // sources of frame-to-frame position jitter without adding perceptible lag.
  let smoothedCamX = 0;
  let smoothedCamY = 0;
  let smoothedCamZ = 0;
  let smoothedCamInitialized = false;
  // Frame-rate independent damping: higher = more responsive, lower = smoother.
  // Using exponential decay: factor = 1 - e^(-speed * delta)
  // At 60fps with speed=8: ~0.12 per frame. At 30fps: ~0.23 per frame.
  // This produces identical visual smoothing regardless of frame rate.
  const CAMERA_DAMPING_SPEED = 8;
  let smoothedLookX = 0;
  let smoothedLookY = 0;
  let smoothedLookZ = 0;

  // Camera settings (all distances/heights in meters)
  // Orbit mode settings are in Scene3D.svelte's OrbitControls
  const SETTINGS = {
    lookSensitivity: SCALE.MOUSE_SENSITIVITY,
    // Third person
    thirdPerson: {
      distance: 5.0, // 5 meters behind avatar (more environment focus)
      minDistance: 1.5, // Closest zoom
      maxDistance: 10.0, // Furthest zoom
      zoomSpeed: 0.5, // Meters per scroll tick
      height: 1.15, // Camera 2m above feet = 2.0 - CAPSULE_HALF_EXTENT
      lookAtHeight: 0.35, // Look at chest 1.2m above feet = 1.2 - CAPSULE_HALF_EXTENT
      minPitch: -1.2, // Allow looking up ~69 degrees
      maxPitch: 1.2, // Allow looking down ~69 degrees
    },
    // First person
    firstPerson: {
      height: 0.75, // Eye level 1.6m above feet = 1.6 - CAPSULE_HALF_EXTENT
      forwardOffset: 0.05, // 5cm forward offset
      minPitch: -1.4,
      maxPitch: 1.4,
    },
  };

  function cycleMode() {
    // Cycle until we land on an allowed mode (or exhaust all 3 possibilities)
    let attempts = 0;
    do {
      mode = cameraPreferences.cycleMode(destinationId);
      attempts++;
    } while (allowedModes && !allowedModes.includes(mode) && attempts < 3);

    props.onModeChange?.(mode);

    // If entering orbit, exit pointer lock
    if (mode === CameraMode.ORBIT && isPointerLocked) {
      document.exitPointerLock();
    }
  }

  function returnToOrbit() {
    if (mode !== CameraMode.ORBIT) {
      cameraPreferences.setModeForDestination(destinationId, CameraMode.ORBIT);
      mode = CameraMode.ORBIT;
      props.onModeChange?.(mode);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!enabled) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;

    // V key cycles camera mode (works without pointer lock)
    // Disabled in museum context where Q handles the full view cycle
    if (e.code === "KeyV" && !props.disableModeToggle) {
      e.preventDefault();
      cycleMode();
      return;
    }

    // G key toggles noclip mode (fly through terrain)
    if (e.code === "KeyG" && isGameMode(mode)) {
      e.preventDefault();
      if (usePhysics && physicsProvider?.toggleNoclip) {
        noclipEnabled = physicsProvider.toggleNoclip();
        // Reset vertical velocity when toggling noclip
        verticalVelocity = 0;
      }
      return;
    }

    // ESC returns to orbit mode (or just releases pointer lock when orbit
    // is excluded from allowedModes — e.g., Scene Lab walk mode)
    if (e.code === "Escape" && mode !== CameraMode.ORBIT) {
      e.preventDefault();
      if (allowedModes && !allowedModes.includes(CameraMode.ORBIT)) {
        if (isPointerLocked) document.exitPointerLock();
      } else {
        returnToOrbit();
      }
      return;
    }

    // Only track movement keys in game modes
    if (isGameMode(mode)) {
      const isMovementKey = MOVEMENT_KEYS.has(e.code);
      if (isMovementKey && !e.repeat) markFlyInteraction("keyboard");
      keys.add(e.code);

      if (isMovementKey) {
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

    // Game modes: pointer lock mouse look OR drag-to-look fallback
    if (isPointerLocked) {
      if (e.movementX !== 0 || e.movementY !== 0) {
        markFlyInteraction("pointer");
      }
      yaw -= e.movementX * SETTINGS.lookSensitivity;
      pitch += e.movementY * SETTINGS.lookSensitivity;

      const config =
        mode === CameraMode.FIRST_PERSON
          ? SETTINGS.firstPerson
          : SETTINGS.thirdPerson;
      pitch = Math.max(config.minPitch, Math.min(config.maxPitch, pitch));
    } else if (isDragging) {
      // Drag-to-look fallback (touch simulation, mobile, etc.)
      const deltaX = e.clientX - lastPointerPos.x;
      const deltaY = e.clientY - lastPointerPos.y;
      if (deltaX !== 0 || deltaY !== 0) markFlyInteraction("pointer");
      lastPointerPos = { x: e.clientX, y: e.clientY };

      yaw -= deltaX * SETTINGS.lookSensitivity;
      pitch += deltaY * SETTINGS.lookSensitivity;

      const config =
        mode === CameraMode.FIRST_PERSON
          ? SETTINGS.firstPerson
          : SETTINGS.thirdPerson;
      pitch = Math.max(config.minPitch, Math.min(config.maxPitch, pitch));
    }
  }

  function handleWheel(e: WheelEvent) {
    if (mode !== CameraMode.THIRD_PERSON) return;
    e.preventDefault();
    const cfg = SETTINGS.thirdPerson;
    const scrollDir = Math.sign(e.deltaY);
    desiredDistance = Math.max(
      cfg.minDistance,
      Math.min(cfg.maxDistance, desiredDistance + scrollDir * cfg.zoomSpeed)
    );
  }

  function handlePointerDown(e: PointerEvent) {
    if (!enabled) return;

    // Track pointer type for input capabilities
    inputCaps.handlePointerEvent(e);

    // In game modes without pointer lock, start drag-to-look
    if (isGameMode(mode) && !isPointerLocked) {
      isDragging = true;
      lastPointerPos = { x: e.clientX, y: e.clientY };

      // Prevent default to stop browser scroll/zoom behaviors
      e.preventDefault();
    }
  }

  function handlePointerUp(e: PointerEvent) {
    const wasDragging = isDragging;
    isDragging = false;
    if (wasDragging) flushCompletedInteraction();
  }

  function handlePointerMove(e: PointerEvent) {
    // Track pointer type changes (touch vs mouse)
    inputCaps.handlePointerEvent(e);

    // Handle drag-to-look when dragging (works with touch simulation in DevTools)
    if (!enabled) return;
    if (mode === CameraMode.ORBIT) return;

    if (isDragging && !isPointerLocked) {
      // Prevent default to stop browser scroll/zoom behaviors
      e.preventDefault();

      const deltaX = e.clientX - lastPointerPos.x;
      const deltaY = e.clientY - lastPointerPos.y;
      if (deltaX !== 0 || deltaY !== 0) markFlyInteraction("pointer");
      lastPointerPos = { x: e.clientX, y: e.clientY };

      yaw -= deltaX * SETTINGS.lookSensitivity;
      pitch += deltaY * SETTINGS.lookSensitivity;

      const config =
        mode === CameraMode.FIRST_PERSON
          ? SETTINGS.firstPerson
          : SETTINGS.thirdPerson;
      pitch = Math.max(config.minPitch, Math.min(config.maxPitch, pitch));
    }
  }

  function handlePointerLockChange() {
    const canvas = cachedCanvas ?? renderer.current?.domElement;
    if (!canvas) return;

    const wasLocked = isPointerLocked;
    isPointerLocked = document.pointerLockElement === canvas;

    // If we lost pointer lock, return to orbit — unless orbit is excluded
    // from allowedModes (e.g., Scene Lab walk mode). In that case stay in
    // the current game mode; the "click to look around" hint reappears.
    if (wasLocked && !isPointerLocked) {
      flushCompletedInteraction();
      if (
        mode !== CameraMode.ORBIT &&
        (!allowedModes || allowedModes.includes(CameraMode.ORBIT))
      ) {
        returnToOrbit();
      }
    }
  }

  function handleCanvasClick() {
    if (!enabled) {
      return;
    }

    // In orbit mode, clicking enters third-person mode
    if (mode === CameraMode.ORBIT) {
      cameraPreferences.setModeForDestination(
        destinationId,
        CameraMode.THIRD_PERSON
      );
      mode = CameraMode.THIRD_PERSON;
    }

    // Always notify parent of current mode on click.
    props.onModeChange?.(mode);

    const canLock = isGameMode(mode) && inputCaps.canUsePointerLock();
    if (canLock) {
      const canvas = cachedCanvas ?? renderer.current?.domElement;
      if (canvas?.isConnected) {
        try {
          canvas.requestPointerLock();
        } catch {
          /* canvas detached during navigation */
        }
      }
    }
  }

  function handleBlur() {
    flushCompletedInteraction();
    keys.clear();
  }

  // Canvas attachment is reactive: attach when enabled becomes true,
  // detach when it becomes false. This allows pre-mounting the component
  // in disabled state (e.g., during museum loading) so the first enable
  // doesn't pay full mount cost.
  let attached = false;

  function findCanvas(): HTMLCanvasElement | null {
    return (
      (renderer.current?.domElement as HTMLCanvasElement | undefined) ??
      document.querySelector<HTMLCanvasElement>("canvas[data-engine]") ??
      null
    );
  }

  function detachFromCanvas() {
    if (!attached) return;
    flushCompletedInteraction();
    attached = false;
    const canvas = cachedCanvas;
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    canvas?.removeEventListener("click", handleCanvasClick);
    canvas?.removeEventListener("wheel", handleWheel);
    canvas?.removeEventListener("pointerdown", handlePointerDown);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("pointercancel", handlePointerUp);
    document.removeEventListener("pointermove", handlePointerMove);
    inputCaps.destroy();
    keys.clear();
    // Defer pointer lock exit to next frame so the Svelte effect cascade
    // and flip animation can proceed without browser pointer lock overhead
    if (document.pointerLockElement) {
      requestAnimationFrame(() => {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      });
    }
  }

  $effect(() => {
    if (enabled && !attached) {
      // Defer attachment to next microtask so the Svelte effect cascade
      // (ceiling toggle, Avatar3D visibility, etc.) completes first.
      // This prevents event listener setup from blocking the flip animation frame.
      let cancelled = false;
      let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

      queueMicrotask(() => {
        if (cancelled || !enabled || attached) return; // guard: state may have changed
        const canvas = findCanvas();
        if (canvas) {
          attachToCanvas(canvas);
          attached = true;
        } else {
          let attempts = 0;
          const maxAttempts = 50;
          function tryAttach() {
            if (cancelled || !enabled || attached) return;
            const c = findCanvas();
            if (c) {
              attachToCanvas(c);
              attached = true;
              return;
            }
            if (++attempts < maxAttempts) {
              pendingTimeout = setTimeout(tryAttach, 100);
            } else {
              console.warn(
                `[CameraCtrl] ENABLE FAILED: no canvas after ${maxAttempts} attempts`
              );
            }
          }
          pendingTimeout = setTimeout(tryAttach, 100);
        }
      });

      return () => {
        cancelled = true;
        if (pendingTimeout !== null) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
      };
    } else if (!enabled && attached) {
      detachFromCanvas();
    }
    return undefined;
  });

  function attachToCanvas(canvas: HTMLCanvasElement) {
    // Cache for use in onDestroy (renderer.current may be gone by then)
    cachedCanvas = canvas;

    // Sync pointer lock state - it may already be held if requested before UCC mounted
    isPointerLocked = document.pointerLockElement === canvas;

    // Initialize input capabilities tracking
    inputCaps.init();

    // Defer pointer lock to next frame so event listener attachment and the
    // rest of the Svelte effect cascade complete first. This prevents the
    // browser's pointer lock flow from blocking the main thread during the
    // flip animation completion.
    if (
      isGameMode(mode) &&
      !isPointerLocked &&
      inputCaps.canUsePointerLock() &&
      canvas.isConnected
    ) {
      requestAnimationFrame(() => {
        if (cachedCanvas?.isConnected) {
          try {
            cachedCanvas.requestPointerLock();
          } catch {
            /* canvas detached */
          }
        }
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    // Pointer events for input type detection and drag-to-look
    // pointerdown on canvas to start drag, but move/up on document to catch moves outside canvas
    canvas.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    document.addEventListener("pointermove", handlePointerMove);
  }

  onDestroy(() => {
    detachFromCanvas();
  });

  // Notify parent of rotation changes (for MCP bridge)
  $effect(() => {
    props.onRotationChange?.(yaw, pitch);
  });

  // Handle external rotation changes (from MCP)
  $effect(() => {
    const extYaw = props.externalYaw;
    if (extYaw !== null && extYaw !== undefined) {
      yaw = extYaw;
    }
  });

  $effect(() => {
    const extPitch = props.externalPitch;
    if (extPitch !== null && extPitch !== undefined) {
      const config =
        mode === CameraMode.FIRST_PERSON
          ? SETTINGS.firstPerson
          : SETTINGS.thirdPerson;
      pitch = Math.max(config.minPitch, Math.min(config.maxPitch, extPitch));
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
    if (camera.current instanceof PerspectiveCamera) {
      if (camera.current.far < 10000) {
        camera.current.far = 10000;
        camera.current.updateProjectionMatrix();
      }
    }

    // Game modes: WASD movement
    // UNIFIED movement calculation for both Stage (kinematic) and Worlds (physics)
    // Uses camera matrix to extract forward/right (like Three.js PointerLockControls)

    const forwardInput =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafeInput =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const isSprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const isJumping = keys.has("Space");
    const isCrouching = keys.has("KeyC");
    const hasMovementInput = forwardInput !== 0 || strafeInput !== 0;

    // === UNIFIED DIRECTION CALCULATION ===
    // Extract forward/right from camera matrix (works regardless of yaw convention)
    const cam = camera.current;
    const _forward = new Vector3();
    const _right = new Vector3();
    const _forward3D = new Vector3(); // Full 3D forward for noclip

    // Get right vector from camera's X-axis
    _right.setFromMatrixColumn(cam.matrix, 0);

    // For normal movement: project forward onto XZ plane (no flying when looking up/down)
    _forward.crossVectors(cam.up, _right);

    // For noclip: get the actual camera facing direction (includes pitch)
    cam.getWorldDirection(_forward3D);

    // Calculate speed (crouch overrides sprint - can't sprint while crouching)
    const speed = isCrouching
      ? moveSpeed * SCALE.CROUCH_MULTIPLIER
      : isSprinting
        ? moveSpeed * sprintMultiplier
        : moveSpeed;

    // Check noclip state early so we can use the right forward vector
    const isNoclip =
      (usePhysics && physicsProvider?.isNoclipEnabled?.()) || false;

    // Build movement vector - use 3D forward in noclip, XZ-projected forward otherwise
    let moveX: number;
    let moveY: number;
    let moveZ: number;

    if (isNoclip) {
      // Noclip: fly in the direction you're looking (pitch affects vertical movement)
      moveX =
        (_forward3D.x * forwardInput + _right.x * strafeInput) * speed * delta;
      moveY = _forward3D.y * forwardInput * speed * delta; // Vertical from looking up/down
      moveZ =
        (_forward3D.z * forwardInput + _right.z * strafeInput) * speed * delta;
    } else {
      // Normal: movement stays on XZ plane
      moveX =
        (_forward.x * forwardInput + _right.x * strafeInput) * speed * delta;
      moveY = 0; // Will be set by gravity/jump below
      moveZ =
        (_forward.z * forwardInput + _right.z * strafeInput) * speed * delta;
    }

    // Normalize diagonal movement to prevent faster diagonal speed
    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > speed * delta) {
      const scale = (speed * delta) / moveLen;
      moveX *= scale;
      moveZ *= scale;
    }

    // === APPLY MOVEMENT (differs by physics vs kinematic) ===
    if (usePhysics && physicsProvider) {
      // Sync noclip state from physics provider
      noclipEnabled = isNoclip;

      if (!isNoclip) {
        // A lift column (the museum Air chimney) reports an upward speed at the
        // player's position. Inside one, vertical velocity EASES toward that
        // speed instead of falling — walking in reads as being picked up rather
        // than launched. Outside one this is 0 and nothing below changes, so the
        // kinematic path and every non-museum provider are untouched.
        const lift =
          (physicsProvider as LiftingPhysicsProvider).updraftSpeedAtPlayer?.() ??
          0;

        if (lift > 0) {
          verticalVelocity +=
            (lift - verticalVelocity) * Math.min(1, UPDRAFT_RISE_EASE * delta);
        } else {
          // Normal physics: handle jumping and gravity
          if (
            isJumping &&
            physicsProvider.isGrounded() &&
            verticalVelocity <= 0
          ) {
            verticalVelocity = jumpForce;
          }
          if (!physicsProvider.isGrounded()) {
            verticalVelocity -= gravity * delta;
            verticalVelocity = Math.max(
              verticalVelocity,
              SCALE.TERMINAL_VELOCITY
            );
          } else if (verticalVelocity < 0) {
            verticalVelocity = 0;
          }
        }
        // Leaving a column does NOT zero verticalVelocity: letting the residual
        // rise decay under gravity is what makes the crest read as an arc
        // instead of a wall.
        moveY = verticalVelocity * delta;
      }

      // Apply through physics provider (handles collisions, or bypasses in noclip)
      physicsProvider.movePlayer({ x: moveX, y: moveY, z: moveZ }, delta);

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
    avatarState.isCrouching = isCrouching;

    // Swap physics collider height when crouch state changes
    physicsProvider?.setCrouch?.(isCrouching);

    // Avatar facing in third-person:
    // - Forward (W) or forward+strafe: avatar turns to face movement direction
    // - Backward only (S): avatar keeps facing forward, plays backward walk animation
    // - Strafe only (A/D): avatar keeps facing forward, plays strafe animation
    // - Backward + strafe: avatar keeps facing forward, blends backward + strafe
    // This matches standard third-person games where backward/strafe don't spin the character.
    if (mode === CameraMode.THIRD_PERSON && hasMovementInput) {
      if (forwardInput > 0) {
        // Moving forward (possibly with strafe): face the movement direction
        const moveDirX = _forward.x * forwardInput + _right.x * strafeInput;
        const moveDirZ = _forward.z * forwardInput + _right.z * strafeInput;
        const facingAngle = Math.atan2(moveDirX, moveDirZ);
        avatarState.setFacingAngle(facingAngle);
      }
      // When moving backward or strafing only, avatar keeps its current facing.
      // The locomotion system picks up the backward/strafe from moveDirection.
    }

    // Lerp the avatar's facing angle toward its target each frame.
    // This produces smooth body rotation in third-person mode.
    avatarState.updateLocomotion?.(delta);

    // Smoothly interpolate crouch camera offset (framerate-independent exponential decay)
    const crouchTarget = isCrouching ? CROUCH_HEIGHT_DROP : 0;
    const crouchBlend = 1 - Math.exp(-CROUCH_LERP_SPEED * delta);
    crouchHeightOffset += (crouchTarget - crouchHeightOffset) * crouchBlend;

    if (mode === CameraMode.FIRST_PERSON) {
      // First-person: camera IS the avatar's eyes
      // Avatar always faces where you're looking - snap, don't lerp
      (avatarState.snapFacingAngle ?? avatarState.setFacingAngle)(yaw);

      const cfg = SETTINGS.firstPerson;
      const camX = targetX + Math.sin(yaw) * cfg.forwardOffset;
      const camY = targetY + cfg.height - crouchHeightOffset;
      const camZ = targetZ + Math.cos(yaw) * cfg.forwardOffset;

      camera.current.position.set(camX, camY, camZ);

      const lookDistance = 100;
      const lookX = camX + Math.sin(yaw) * lookDistance * Math.cos(pitch);
      const lookY = camY - Math.sin(pitch) * lookDistance;
      const lookZ = camZ + Math.cos(yaw) * lookDistance * Math.cos(pitch);

      camera.current.lookAt(lookX, lookY, lookZ);
    } else {
      // Third-person: camera behind avatar with smoothed terrain collision.
      // The raycast determines the maximum safe distance this frame, then we
      // lerp smoothedCameraDistance toward that target. Pulling in is fast
      // (avoid clipping), pulling out is slow (avoid jitter at wall edges).
      const cfg = SETTINGS.thirdPerson;
      const cosPitch = Math.cos(pitch);

      // The ideal (uncollided) distance from the player (user-adjustable via scroll)
      let targetDistance = desiredDistance;

      // Raycast from player to desired camera position to detect terrain collision
      // Threlte 8.x: scene may be a direct Scene object or a ref with .current
      const sceneToCast = (scene as any)?.current ?? scene;
      if (sceneToCast?.children) {
        // Start ray from player's head area (slightly above center)
        rayOrigin.set(targetX, targetY + cfg.lookAtHeight, targetZ);

        // Desired camera position at full distance
        const desiredCamX =
          targetX - Math.sin(yaw) * desiredDistance * cosPitch;
        const desiredCamY =
          targetY + cfg.height + Math.sin(pitch) * desiredDistance * 0.5;
        const desiredCamZ =
          targetZ - Math.cos(yaw) * desiredDistance * cosPitch;
        desiredCamPos.set(desiredCamX, desiredCamY, desiredCamZ);

        // Direction from player to camera
        rayDirection.subVectors(desiredCamPos, rayOrigin).normalize();
        const distanceToCamera = rayOrigin.distanceTo(desiredCamPos);

        cameraRaycaster.set(rayOrigin, rayDirection);
        cameraRaycaster.far = distanceToCamera;

        // Raycast against all meshes in the scene
        const intersects = cameraRaycaster.intersectObjects(
          sceneToCast.children,
          true
        );

        // Only collide with wall meshes tagged with userData.cameraCollider.
        // This prevents pedestals, signs, plaques, furniture, portals, and
        // other scene objects from permanently clamping the camera distance.
        for (const intersection of intersects) {
          if (!intersection.object.userData?.cameraCollider) continue;
          if (!intersection.object.visible) continue;

          const safeDistance = Math.max(
            intersection.distance - CAMERA_COLLISION_OFFSET,
            MIN_CAMERA_DISTANCE
          );
          targetDistance = Math.min(targetDistance, safeDistance);
          break;
        }
      }

      // Spring arm lerp: asymmetric, time-based (framerate independent).
      // Pull-in is fast (avoid clipping), recovery is slower (feels natural).
      const speed =
        targetDistance < smoothedCameraDistance
          ? CAMERA_PULL_IN_SPEED
          : CAMERA_RECOVERY_SPEED;
      smoothedCameraDistance +=
        (targetDistance - smoothedCameraDistance) *
        (1 - Math.exp(-speed * delta));

      // Clamp to valid range
      smoothedCameraDistance = Math.max(
        MIN_CAMERA_DISTANCE,
        Math.min(desiredDistance, smoothedCameraDistance)
      );

      // Place camera at smoothed distance along the yaw/pitch direction
      const finalCamX =
        targetX - Math.sin(yaw) * smoothedCameraDistance * cosPitch;
      const finalCamY =
        targetY + cfg.height + Math.sin(pitch) * smoothedCameraDistance * 0.5;
      const finalCamZ =
        targetZ - Math.cos(yaw) * smoothedCameraDistance * cosPitch;

      // Frame-rate independent damping using exponential decay.
      // Produces identical visual smoothing at 30fps and 60fps.
      // Also damps the lookAt target to prevent lateral wobble from
      // position lag vs. instant look-at snap.
      const dampFactor = 1 - Math.exp(-CAMERA_DAMPING_SPEED * delta);
      const lookTargetX = targetX;
      const lookTargetY = targetY + cfg.lookAtHeight;
      const lookTargetZ = targetZ;

      if (!smoothedCamInitialized) {
        smoothedCamX = finalCamX;
        smoothedCamY = finalCamY;
        smoothedCamZ = finalCamZ;
        smoothedLookX = lookTargetX;
        smoothedLookY = lookTargetY;
        smoothedLookZ = lookTargetZ;
        smoothedCamInitialized = true;
      } else {
        smoothedCamX += (finalCamX - smoothedCamX) * dampFactor;
        smoothedCamY += (finalCamY - smoothedCamY) * dampFactor;
        smoothedCamZ += (finalCamZ - smoothedCamZ) * dampFactor;
        smoothedLookX += (lookTargetX - smoothedLookX) * dampFactor;
        smoothedLookY += (lookTargetY - smoothedLookY) * dampFactor;
        smoothedLookZ += (lookTargetZ - smoothedLookZ) * dampFactor;
      }

      camera.current.position.set(smoothedCamX, smoothedCamY, smoothedCamZ);
      camera.current.lookAt(smoothedLookX, smoothedLookY, smoothedLookZ);
    }
  });

  // Mode label for UI
  const modeLabel = $derived(
    mode === CameraMode.ORBIT
      ? "Orbit"
      : mode === CameraMode.THIRD_PERSON
        ? "3rd Person"
        : "1st Person"
  );

  const modeIcon = $derived(
    mode === CameraMode.ORBIT
      ? "fa-arrows-rotate"
      : mode === CameraMode.THIRD_PERSON
        ? "fa-user"
        : "fa-eye"
  );

  // Check if we're using touch input (for UI hints)
  const isUsingTouch = $derived(
    inputCaps.current.currentPointerType === "touch"
  );
</script>

<!-- Controls hint (when not in game mode or not pointer locked) -->
{#if enabled && (mode === CameraMode.ORBIT || !isPointerLocked)}
  <div class="controls-hint">
    {#if mode === CameraMode.ORBIT}
      <span>Drag to orbit • Tap to enter game mode</span>
    {:else if isUsingTouch}
      <span>Drag to look around</span>
    {:else}
      <span>Click to look around</span>
    {/if}
    <div class="controls">
      {#if !isUsingTouch}
        <kbd>V</kbd> {modeLabel}
      {/if}
      {#if isGameMode(mode)}
        {#if isUsingTouch}
          <span>Drag to look</span>
        {:else}
          <kbd>WASD</kbd> Move
          <kbd>Mouse</kbd> Look
        {/if}
        {#if usePhysics && !isUsingTouch}
          <kbd>Shift</kbd> Sprint
          <kbd>Space</kbd> Jump
        {/if}
      {:else if !isUsingTouch}
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
    {#if noclipEnabled}
      <span class="noclip-badge">FLY</span>
    {/if}
    <span class="hint">V to switch • G fly • ESC to exit</span>
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

  .noclip-badge {
    padding: 2px 6px;
    background: rgba(245, 158, 11, 0.3);
    border: 1px solid rgba(245, 158, 11, 0.6);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    color: #fcd34d;
    letter-spacing: 0.5px;
  }
</style>
