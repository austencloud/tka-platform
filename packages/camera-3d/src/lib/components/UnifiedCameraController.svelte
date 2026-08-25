<script lang="ts">
  import { onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";
  import { Vector3, Raycaster, PerspectiveCamera } from "three";
  import {
    CameraMode,
    getNextCameraMode,
    isGameMode,
    type PhysicsProvider,
    type AvatarState,
  } from "../types";
  import {
    createCameraPreferences,
    type CameraPreferences,
  } from "../camera-preferences.svelte";
  import { CAMERA_DEFAULTS } from "../constants";
  import { normalizeCameraFrameDelta } from "../frame-delta";
  import { createInputCapabilities } from "../input-capabilities";
  import { collectCameraColliders } from "../camera-collider-index";
  import {
    CLEAN_FLY_INTERACTION,
    flushFlyInteraction,
    markFlyInteractionDirty,
    type FlyInteractionDirtyState,
    type FlyInteractionKind,
  } from "../fly-interaction-dirty";

  interface Props {
    destinationId: string;
    avatarState: AvatarState;
    physicsProvider?: PhysicsProvider | null;
    enabled?: boolean;
    onModeChange?: (mode: CameraMode) => void;
    moveSpeed?: number;
    sprintMultiplier?: number;
    jumpForce?: number;
    gravity?: number;
    /** Camera height above the physics body's centre in first person. */
    firstPersonCameraOffset?: number;
    /** Review harnesses can lock locomotion to one measured walking speed. */
    enableSprint?: boolean;
    enableJump?: boolean;
    enableCrouch?: boolean;
    enableNoclip?: boolean;
    onRotationChange?: (yaw: number, pitch: number) => void;
    initialYaw?: number;
    initialPitch?: number;
    externalYaw?: number | null;
    externalPitch?: number | null;
    allowedModes?: CameraMode[];
    disableModeToggle?: boolean;
    /** Show the pointer-lock and movement instructions while the cursor is free. */
    showControlsHint?: boolean;
    /** Custom storage key for camera preferences */
    preferencesKey?: string;
    /** Default camera modes per destination ID */
    destinationDefaults?: Record<string, CameraMode>;
    /** External camera preferences instance (shared singleton). If omitted, UCC creates its own. */
    cameraPreferences?: CameraPreferences;
    /**
     * Analog movement from a thumbstick, −1..1 on each axis. `z` is forward.
     *
     * Optional, and it does not replace the keyboard — it is read alongside it,
     * and the keys carry on working whenever the stick is at rest. Without this
     * there is no way to walk on a touch device at all: the whole movement path
     * is `keys.has("KeyW")`, and a phone has no KeyW.
     *
     * Analog rather than four synthesised booleans on purpose. A thresholded
     * stick is a switch, and a switch cannot ease up — which is exactly what
     * you want on a narrow stair over a drop.
     */
    moveAxis?: { x: number; z: number };
    /**
     * Fired when a continuous look/move gesture completes (pointer released,
     * pointer lock exited, keys blurred). Lets hosts log one analytics event
     * per gesture instead of one per frame.
     */
    onInteractionEnd?: (kind: FlyInteractionKind) => void;
  }

  const props: Props = $props();

  const destinationId = $derived(props.destinationId);
  const avatarState = $derived(props.avatarState);
  const physicsProvider = $derived(props.physicsProvider ?? null);
  const enabled = $derived(props.enabled ?? true);
  const moveSpeed = $derived(props.moveSpeed ?? CAMERA_DEFAULTS.WALK_SPEED);
  const sprintMultiplier = $derived(
    props.sprintMultiplier ?? CAMERA_DEFAULTS.SPRINT_MULTIPLIER
  );
  const jumpForce = $derived(props.jumpForce ?? CAMERA_DEFAULTS.JUMP_VELOCITY);
  const gravity = $derived(
    props.gravity ?? Math.abs(CAMERA_DEFAULTS.GRAVITY) * 2.5
  );
  const firstPersonCameraOffset = $derived(
    props.firstPersonCameraOffset ?? CAMERA_DEFAULTS.FIRST_PERSON_CAMERA_OFFSET
  );
  const enableSprint = $derived(props.enableSprint ?? true);
  const enableJump = $derived(props.enableJump ?? true);
  const enableCrouch = $derived(props.enableCrouch ?? true);
  const enableNoclip = $derived(props.enableNoclip ?? true);
  const allowedModes = $derived(props.allowedModes);

  const usePhysics = $derived(physicsProvider !== null);

  const cameraPreferences =
    props.cameraPreferences ??
    createCameraPreferences(props.preferencesKey, props.destinationDefaults);

  const { renderer, camera, scene } = useThrelte();

  const _initMode = $derived(
    cameraPreferences.getModeForDestination(destinationId)
  );
  let mode = $state<CameraMode>(CameraMode.ORBIT);
  $effect.pre(() => {
    mode = _initMode;
  });

  // `initial*` means initial. These used to be assigned from an $effect.pre,
  // which read both props reactively - so any consumer passing a live value for
  // initialYaw (WorldSceneContent and the First Fire graybox both pass the
  // player's own yaw) re-ran the effect on every turn and slammed pitch back to
  // its initial value each time. Symptom: the camera looks left and right
  // normally and cannot look up or down at all. Museum3DScene had already found
  // this and worked around it by freezing the values it passes, with the comment
  // "these must NOT update while UCC is mounted" - that is the real contract, so
  // it belongs here rather than in each consumer. Re-seeding is done by
  // remounting, which consumers already do with {#key}.
  let yaw = $state(props.initialYaw ?? 0);
  let pitch = $state(props.initialPitch ?? 0.3);
  let isPointerLocked = $state(false);

  const keys = new Set<string>();
  const inputCaps = createInputCapabilities();

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

  let cachedCanvas: HTMLCanvasElement | null = null;
  let isDragging = $state(false);
  let lastPointerPos = { x: 0, y: 0 };
  let verticalVelocity = 0;
  let noclipEnabled = $state(false);

  let crouchHeightOffset = 0;
  const CROUCH_HEIGHT_DROP =
    CAMERA_DEFAULTS.EYE_HEIGHT - CAMERA_DEFAULTS.CROUCH_EYE_HEIGHT;
  const CROUCH_LERP_SPEED = 8;

  /**
   * A physics provider that can report an upward lift column at the player's
   * position (the museum's grid provider does; the generic ones do not). Kept
   * structural rather than added to the PhysicsProvider interface — the seam
   * belongs to the consumer, and every other provider stays untouched.
   */
  type LiftingPhysicsProvider = { updraftSpeedAtPlayer?: () => number };

  /**
   * How fast vertical velocity approaches a lift column's speed, per second.
   * 6 puts ~95% of the ease inside the first 0.5s: enough to feel like the air
   * takes hold of you, short enough that it costs the rise ~0.17m.
   */
  const UPDRAFT_RISE_EASE = 6;

  const SCENE_BOUNDS = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
  const CAPSULE_HALF_EXTENT = CAMERA_DEFAULTS.CAPSULE_HALF_EXTENT;

  const cameraRaycaster = new Raycaster();
  let colliderScene: import("three").Object3D | null = null;
  let colliderRootChildCount = -1;
  let cameraColliders: import("three").Object3D[] = [];

  function getCameraColliders(
    sceneRoot: import("three").Object3D
  ): import("three").Object3D[] {
    // Museum room chunks are added directly to the scene root. Re-index only
    // when that root changes instead of recursively intersecting the complete
    // scene graph on every third-person frame.
    if (
      colliderScene !== sceneRoot ||
      colliderRootChildCount !== sceneRoot.children.length
    ) {
      colliderScene = sceneRoot;
      colliderRootChildCount = sceneRoot.children.length;
      cameraColliders = collectCameraColliders(sceneRoot);
    }
    return cameraColliders;
  }
  const rayOrigin = new Vector3();
  const rayDirection = new Vector3();
  const desiredCamPos = new Vector3();
  const CAMERA_COLLISION_OFFSET = 0.3;
  const MIN_CAMERA_DISTANCE = 0.5;
  let smoothedCameraDistance = 5.0;
  let desiredDistance = 5.0;
  const CAMERA_PULL_IN_SPEED = 10;
  const CAMERA_RECOVERY_SPEED = 3;

  let smoothedCamX = 0;
  let smoothedCamY = 0;
  let smoothedCamZ = 0;
  let smoothedCamInitialized = false;
  const CAMERA_DAMPING_SPEED = 8;
  let smoothedLookX = 0;
  let smoothedLookY = 0;
  let smoothedLookZ = 0;

  const SETTINGS = {
    lookSensitivity: CAMERA_DEFAULTS.MOUSE_SENSITIVITY,
    thirdPerson: {
      distance: 5.0,
      minDistance: 1.5,
      maxDistance: 10.0,
      zoomSpeed: 0.5,
      height: 1.15,
      lookAtHeight: 0.35,
      minPitch: -1.2,
      maxPitch: 1.2,
    },
    firstPerson: {
      get height() {
        return firstPersonCameraOffset;
      },
      forwardOffset: 0.05,
      minPitch: -1.4,
      maxPitch: 1.4,
    },
  };

  function cycleMode() {
    let attempts = 0;
    do {
      mode = cameraPreferences.cycleMode(destinationId);
      attempts++;
    } while (allowedModes && !allowedModes.includes(mode) && attempts < 3);
    props.onModeChange?.(mode);
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

    if (e.code === "KeyV" && !props.disableModeToggle) {
      e.preventDefault();
      cycleMode();
      return;
    }

    if (e.code === "KeyG" && enableNoclip && isGameMode(mode)) {
      e.preventDefault();
      if (usePhysics && physicsProvider?.toggleNoclip) {
        noclipEnabled = physicsProvider.toggleNoclip();
        verticalVelocity = 0;
      }
      return;
    }

    if (e.code === "Escape" && mode !== CameraMode.ORBIT) {
      e.preventDefault();
      if (allowedModes && !allowedModes.includes(CameraMode.ORBIT)) {
        if (isPointerLocked) document.exitPointerLock();
      } else {
        returnToOrbit();
      }
      return;
    }

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
    if (mode === CameraMode.ORBIT) return;

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
    inputCaps.handlePointerEvent(e);
    if (isGameMode(mode) && !isPointerLocked) {
      isDragging = true;
      lastPointerPos = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }

  function handlePointerUp(_e: PointerEvent) {
    const wasDragging = isDragging;
    isDragging = false;
    if (wasDragging) flushCompletedInteraction();
  }

  function handlePointerMove(e: PointerEvent) {
    inputCaps.handlePointerEvent(e);
    if (!enabled) return;
    if (mode === CameraMode.ORBIT) return;
    if (isDragging && !isPointerLocked) {
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

  function requestPointerLockSafely(canvas: HTMLCanvasElement): void {
    try {
      const request = canvas.requestPointerLock();
      if (request && "catch" in request) void request.catch(() => {});
    } catch {
      // Pointer lock can be unavailable while a document is being replaced.
    }
  }

  function handleCanvasClick() {
    if (!enabled) return;
    if (mode === CameraMode.ORBIT) {
      cameraPreferences.setModeForDestination(
        destinationId,
        CameraMode.THIRD_PERSON
      );
      mode = CameraMode.THIRD_PERSON;
    }
    props.onModeChange?.(mode);
    if (isGameMode(mode) && inputCaps.canUsePointerLock()) {
      const canvas = cachedCanvas ?? renderer.current?.domElement;
      if (canvas?.isConnected) {
        requestPointerLockSafely(canvas);
      }
    }
  }

  function handleBlur() {
    flushCompletedInteraction();
    keys.clear();
  }

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
    if (document.pointerLockElement) {
      requestAnimationFrame(() => {
        if (document.pointerLockElement) document.exitPointerLock();
      });
    }
  }

  $effect(() => {
    if (enabled && !attached) {
      queueMicrotask(() => {
        if (!enabled || attached) return;
        const canvas = findCanvas();
        if (canvas) {
          attachToCanvas(canvas);
          attached = true;
        } else {
          let attempts = 0;
          function tryAttach() {
            const c = findCanvas();
            if (c) {
              attachToCanvas(c);
              attached = true;
              return;
            }
            if (++attempts < 50) setTimeout(tryAttach, 100);
          }
          setTimeout(tryAttach, 100);
        }
      });
    } else if (!enabled && attached) {
      detachFromCanvas();
    }
  });

  function attachToCanvas(canvas: HTMLCanvasElement) {
    cachedCanvas = canvas;
    isPointerLocked = document.pointerLockElement === canvas;
    inputCaps.init();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    document.addEventListener("pointermove", handlePointerMove);
  }

  onDestroy(() => {
    detachFromCanvas();
  });

  $effect(() => {
    props.onRotationChange?.(yaw, pitch);
  });

  $effect(() => {
    const extYaw = props.externalYaw;
    if (extYaw !== null && extYaw !== undefined) yaw = extYaw;
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

  useTask((delta) => {
    if (!enabled || !camera.current) return;

    // Background tabs, debugger pauses, and renderer handoffs can produce a
    // negative or abnormally large task delta. A negative limit makes the
    // zero-input movement clamp divide by zero and poisons the camera with
    // NaN coordinates. Normalize once at the frame boundary.
    const frameDelta = normalizeCameraFrameDelta(delta);

    if (mode === CameraMode.ORBIT) {
      avatarState.setMoveInput({ x: 0, z: 0 });
      return;
    }

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

    if (camera.current instanceof PerspectiveCamera) {
      if (camera.current.far < 10000) {
        camera.current.far = 10000;
        camera.current.updateProjectionMatrix();
      }
    }

    // Keyboard first, then the stick overrides it while it is being pushed.
    // Clamped defensively: one NaN from a stray touch event would otherwise
    // poison moveX/moveZ and freeze the player for the rest of the session.
    const axis = props.moveAxis;
    const clamp1 = (v: number | undefined) =>
      typeof v === "number" && Number.isFinite(v)
        ? Math.max(-1, Math.min(1, v))
        : 0;
    const stickForward = clamp1(axis?.z);
    const stickStrafe = clamp1(axis?.x);
    const stickPushed = stickForward !== 0 || stickStrafe !== 0;

    const forwardInput = stickPushed
      ? stickForward
      : (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafeInput = stickPushed
      ? stickStrafe
      : (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const isSprinting =
      enableSprint && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    const isJumping = enableJump && keys.has("Space");
    const isCrouching = enableCrouch && keys.has("KeyC");
    const hasMovementInput = forwardInput !== 0 || strafeInput !== 0;

    const cam = camera.current;
    const _forward = new Vector3();
    const _right = new Vector3();
    const _forward3D = new Vector3();

    _right.setFromMatrixColumn(cam.matrix, 0);
    _forward.crossVectors(cam.up, _right);
    cam.getWorldDirection(_forward3D);

    const crouchMult = CAMERA_DEFAULTS.CROUCH_MULTIPLIER;
    const speed = isCrouching
      ? moveSpeed * crouchMult
      : isSprinting
        ? moveSpeed * sprintMultiplier
        : moveSpeed;

    const isNoclip =
      (usePhysics && physicsProvider?.isNoclipEnabled?.()) || false;

    let moveX: number;
    let moveY: number;
    let moveZ: number;

    if (isNoclip) {
      moveX =
        (_forward3D.x * forwardInput + _right.x * strafeInput) *
        speed *
        frameDelta;
      moveY = _forward3D.y * forwardInput * speed * frameDelta;
      moveZ =
        (_forward3D.z * forwardInput + _right.z * strafeInput) *
        speed *
        frameDelta;
    } else {
      moveX =
        (_forward.x * forwardInput + _right.x * strafeInput) *
        speed *
        frameDelta;
      moveY = 0;
      moveZ =
        (_forward.z * forwardInput + _right.z * strafeInput) *
        speed *
        frameDelta;
    }

    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > speed * frameDelta) {
      const scale = (speed * frameDelta) / moveLen;
      moveX *= scale;
      moveZ *= scale;
    }

    if (usePhysics && physicsProvider) {
      noclipEnabled = isNoclip;
      if (!isNoclip) {
        // A lift column (the museum Air chimney) reports a vertical speed at the
        // player's position. Inside one, vertical velocity EASES toward that
        // speed instead of falling — walking in reads as being picked up rather
        // than launched. Outside one this is 0 and nothing below changes, so the
        // kinematic path and every non-lifting provider are untouched.
        //
        // A NEGATIVE speed is a descending column, and it takes the same branch:
        // easing toward a downward target is a controlled sink, where gravity
        // would be a fall. That is what lets a room move the visitor both ways on
        // air alone instead of owing a ramp for the trip back down.
        const lift =
          (
            physicsProvider as LiftingPhysicsProvider
          ).updraftSpeedAtPlayer?.() ?? 0;

        if (lift !== 0) {
          verticalVelocity +=
            (lift - verticalVelocity) *
            Math.min(1, UPDRAFT_RISE_EASE * frameDelta);
        } else {
          if (
            isJumping &&
            physicsProvider.isGrounded() &&
            verticalVelocity <= 0
          ) {
            verticalVelocity = jumpForce;
          }
          if (!physicsProvider.isGrounded()) {
            verticalVelocity -= gravity * frameDelta;
            verticalVelocity = Math.max(
              verticalVelocity,
              CAMERA_DEFAULTS.TERMINAL_VELOCITY
            );
          } else if (verticalVelocity < 0) {
            verticalVelocity = 0;
          }
        }
        // Leaving a column does NOT zero verticalVelocity: letting the residual
        // rise decay under gravity is what makes the crest read as an arc.
        moveY = verticalVelocity * frameDelta;
      }
      physicsProvider.movePlayer({ x: moveX, y: moveY, z: moveZ }, frameDelta);
      const newPos = physicsProvider.getPlayerPosition();
      targetX = newPos.x;
      targetY = newPos.y;
      targetZ = newPos.z;
      avatarState.position.x = targetX;
      if (avatarState.position.y !== undefined)
        avatarState.position.y = targetY;
      avatarState.position.z = targetZ;
    } else {
      const isGrounded = (avatarState.position.y ?? 0) <= 0;
      if (isJumping && isGrounded && verticalVelocity <= 0) {
        verticalVelocity = jumpForce;
      }
      if (!isGrounded) {
        verticalVelocity -= gravity * frameDelta;
        verticalVelocity = Math.max(
          verticalVelocity,
          CAMERA_DEFAULTS.TERMINAL_VELOCITY
        );
      } else if (verticalVelocity < 0) {
        verticalVelocity = 0;
      }
      let newX = avatarState.position.x + moveX;
      let newY = (avatarState.position.y ?? 0) + verticalVelocity * frameDelta;
      let newZ = avatarState.position.z + moveZ;
      newX = Math.max(SCENE_BOUNDS.minX, Math.min(SCENE_BOUNDS.maxX, newX));
      newZ = Math.max(SCENE_BOUNDS.minZ, Math.min(SCENE_BOUNDS.maxZ, newZ));
      newY = Math.max(0, newY);
      avatarState.position.x = newX;
      if (avatarState.position.y !== undefined) avatarState.position.y = newY;
      avatarState.position.z = newZ;
      targetX = avatarState.position.x;
      targetY = avatarState.position.y ?? 0;
      targetZ = avatarState.position.z;
    }

    avatarState.setMoveInput({ x: strafeInput, z: forwardInput });
    avatarState.isCrouching = isCrouching;
    physicsProvider?.setCrouch?.(isCrouching);

    if (mode === CameraMode.THIRD_PERSON && hasMovementInput) {
      if (forwardInput > 0) {
        const moveDirX = _forward.x * forwardInput + _right.x * strafeInput;
        const moveDirZ = _forward.z * forwardInput + _right.z * strafeInput;
        const facingAngle = Math.atan2(moveDirX, moveDirZ);
        avatarState.setFacingAngle(facingAngle);
      }
    }

    avatarState.updateLocomotion?.(frameDelta);

    const crouchTarget = isCrouching ? CROUCH_HEIGHT_DROP : 0;
    const crouchBlend = 1 - Math.exp(-CROUCH_LERP_SPEED * frameDelta);
    crouchHeightOffset += (crouchTarget - crouchHeightOffset) * crouchBlend;

    if (mode === CameraMode.FIRST_PERSON) {
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
      const cfg = SETTINGS.thirdPerson;
      const cosPitch = Math.cos(pitch);
      let targetDistance = desiredDistance;

      const sceneToCast = (scene as any)?.current ?? scene;
      if (sceneToCast?.children) {
        rayOrigin.set(targetX, targetY + cfg.lookAtHeight, targetZ);
        const dCamX = targetX - Math.sin(yaw) * desiredDistance * cosPitch;
        const dCamY =
          targetY + cfg.height + Math.sin(pitch) * desiredDistance * 0.5;
        const dCamZ = targetZ - Math.cos(yaw) * desiredDistance * cosPitch;
        desiredCamPos.set(dCamX, dCamY, dCamZ);
        rayDirection.subVectors(desiredCamPos, rayOrigin).normalize();
        const distToCamera = rayOrigin.distanceTo(desiredCamPos);
        cameraRaycaster.set(rayOrigin, rayDirection);
        cameraRaycaster.far = distToCamera;
        const intersects = cameraRaycaster.intersectObjects(
          getCameraColliders(sceneToCast),
          false
        );
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

      const lerpSpeed =
        targetDistance < smoothedCameraDistance
          ? CAMERA_PULL_IN_SPEED
          : CAMERA_RECOVERY_SPEED;
      smoothedCameraDistance +=
        (targetDistance - smoothedCameraDistance) *
        (1 - Math.exp(-lerpSpeed * frameDelta));
      smoothedCameraDistance = Math.max(
        MIN_CAMERA_DISTANCE,
        Math.min(desiredDistance, smoothedCameraDistance)
      );

      const finalCamX =
        targetX - Math.sin(yaw) * smoothedCameraDistance * cosPitch;
      const finalCamY =
        targetY + cfg.height + Math.sin(pitch) * smoothedCameraDistance * 0.5;
      const finalCamZ =
        targetZ - Math.cos(yaw) * smoothedCameraDistance * cosPitch;

      const dampFactor = 1 - Math.exp(-CAMERA_DAMPING_SPEED * frameDelta);
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

  const modeLabel = $derived(
    mode === CameraMode.ORBIT
      ? "Orbit"
      : mode === CameraMode.THIRD_PERSON
        ? "3rd Person"
        : "1st Person"
  );

  function portalToBody(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

{#if enabled && isPointerLocked && isGameMode(mode)}
  <div use:portalToBody class="mode-indicator">
    <span>{modeLabel}</span>
    {#if noclipEnabled}
      <span class="noclip-badge">FLY</span>
    {/if}
    <span class="hint">
      {#if props.disableModeToggle}
        G fly &middot; ESC releases cursor
      {:else}
        V to switch &middot; G fly &middot; ESC to exit
      {/if}
    </span>
  </div>
{/if}

<style>
  .mode-indicator {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    max-width: calc(100vw - 2rem);
    box-sizing: border-box;
    flex-wrap: wrap;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: white;
    font-size: 13px;
    pointer-events: none;
    z-index: 50;
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

  @media (max-width: 600px) {
    .mode-indicator {
      top: max(0.75rem, env(safe-area-inset-top));
    }
  }
</style>
