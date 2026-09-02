<script lang="ts">
  /**
   * OrbitControls
   *
   * Shared camera-controls wrapper. Drop-in replacement for
   * @threlte/extras' OrbitControls that's backed by yomotsu's
   * `camera-controls` library instead of three.js OrbitControls.
   *
   * Why the swap:
   * - Smoother damping that feels right across very different scene
   *   scales (sub-meter pictograph rigs vs. large museum rooms).
   * - Pan speed that doesn't collapse as you zoom in.
   * - Imperative API (setLookAt / setTarget / fitToSphere) means
   *   snap-to-view can skip hand-rolled rAF interpolation.
   *
   * Ref: `bind:ref` exposes the native `CameraControls` instance -
   * NOT a three.js OrbitControls facade. Consumers that previously
   * did `controlsRef.target.copy(v)` now call
   * `controlsRef.setTarget(v.x, v.y, v.z, true)`; instead of
   * `controlsRef.target.x` they do
   * `const t = new Vector3(); controlsRef.getTarget(t)`. See
   * the camera-controls README for the full surface.
   */

  import { onMount, onDestroy } from "svelte";
  import { useThrelte, useTask } from "@threlte/core";
  import {
    Vector2,
    Vector3,
    Vector4,
    Quaternion,
    Matrix4,
    Spherical,
    Box3,
    Sphere,
    Raycaster,
    MathUtils,
    type Object3D,
  } from "three";
  import type { PerspectiveCamera, WebGLRenderer } from "three";
  import CameraControls from "camera-controls";

  // Safe to call more than once - dedupes internally. Ensures the
  // library has the three.js subset it needs regardless of which
  // consumer mounts first.
  CameraControls.install({
    THREE: {
      Vector2,
      Vector3,
      Vector4,
      Quaternion,
      Matrix4,
      Spherical,
      Box3,
      Sphere,
      Raycaster,
      MathUtils,
    },
  });

  type Vec3Tuple = [number, number, number];
  type RightDragAction = "pan" | "rotate" | "none";

  interface Props {
    /** Live CameraControls instance - null until the component mounts. */
    ref?: CameraControls | null;
    enabled?: boolean;
    /**
     * Accepted for drop-in compat with @threlte/extras. Damping is
     * always on in camera-controls; feel is controlled via
     * `smoothTime`.
     */
    enableDamping?: boolean;
    /**
     * Accepted for drop-in compat. Rough mapping: smaller = snappier.
     * Prefer `smoothTime` for new code.
     */
    dampingFactor?: number;
    smoothTime?: number;
    draggingSmoothTime?: number;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
    minAzimuthAngle?: number;
    maxAzimuthAngle?: number;
    /**
     * Camera-controls casts from the target toward the camera's near-plane
     * corners, keeping orbit and dolly movement on the authored side of these
     * meshes. Callers should pass only real collision surfaces, never an entire
     * decorated scene graph.
     */
    colliderMeshes?: Object3D[];
    /** Applied to both azimuth + polar rotation. */
    rotateSpeed?: number;
    /** Mapped to `truckSpeed`. */
    panSpeed?: number;
    /** Mapped to `dollySpeed`. */
    zoomSpeed?: number;
    enablePan?: boolean;
    /**
     * Overrides the right mouse button without changing touch or middle-button
     * behavior. Omit to preserve the standard contract: pan when enabled,
     * otherwise no action.
     */
    rightDragAction?: RightDragAction;
    autoRotate?: boolean;
    /** Matches three.js OrbitControls units (~6deg/s per unit at 60fps). */
    autoRotateSpeed?: number;
    /**
     * When true, the per-frame `controls.update(delta)` is skipped so the
     * camera transform set by another author (e.g. the offline 3D exporter
     * replaying recorded keyframes) is not overwritten by damping toward
     * the controls' internal target.
     */
    paused?: boolean;
    /**
     * Threlte task key for the per-frame `controls.update()`. A host that must
     * run after the controls have written the camera transform (camera roll,
     * post-orbit corrections) passes its own key here and orders its task
     * `{ after: taskKey }`. Anonymous when omitted.
     */
    taskKey?: string | symbol;
    target?: Vec3Tuple | Vector3;
    /** Fires on every internal update tick (i.e. while animating). */
    onchange?: (controls: CameraControls) => void;
    oncontrolstart?: (controls: CameraControls) => void;
    /** Fires after the user releases a drag - the "orbit end" moment. */
    oncontrolend?: (controls: CameraControls) => void;
    /**
     * Fires once with the live instance. Return a cleanup function to
     * run on unmount.
     */
    oncreate?: (controls: CameraControls) => void | (() => void);
  }

  let {
    ref = $bindable<CameraControls | null>(null),
    enabled = true,
    smoothTime = 0.08,
    draggingSmoothTime = 0.05,
    minDistance,
    maxDistance,
    minPolarAngle,
    maxPolarAngle,
    minAzimuthAngle,
    maxAzimuthAngle,
    colliderMeshes = [],
    rotateSpeed,
    panSpeed,
    zoomSpeed,
    enablePan = true,
    rightDragAction,
    autoRotate = false,
    autoRotateSpeed = 2.0,
    paused = false,
    taskKey = Symbol("orbit-controls-update"),
    target,
    onchange,
    oncontrolstart,
    oncontrolend,
    oncreate,
  }: Props = $props();

  const { renderer, camera } = useThrelte();
  let controls: CameraControls | null = null;
  let userCleanup: (() => void) | undefined;

  onMount(() => {
    // threlte v8 wraps renderer + camera as reactive accessors. Fall
    // back to the raw reference for older shapes so this keeps
    // working if threlte revs again.
    const gl =
      (renderer as { current?: WebGLRenderer })?.current ??
      (renderer as unknown as WebGLRenderer);
    const cam =
      (camera as { current?: PerspectiveCamera })?.current ??
      (camera as unknown as PerspectiveCamera);
    if (!gl?.domElement || !cam) {
      console.warn("[OrbitControls] renderer or camera unavailable at mount");
      return;
    }

    controls = new CameraControls(cam, gl.domElement);
    controls.smoothTime = smoothTime;
    controls.draggingSmoothTime = draggingSmoothTime;

    if (target) {
      const t = Array.isArray(target)
        ? target
        : ([target.x, target.y, target.z] as Vec3Tuple);
      controls.setTarget(t[0], t[1], t[2], false);
    }

    ref = controls;

    const handleUpdate = () => onchange?.(controls!);
    const handleStart = () => oncontrolstart?.(controls!);
    const handleEnd = () => oncontrolend?.(controls!);
    controls.addEventListener("update", handleUpdate);
    controls.addEventListener("controlstart", handleStart);
    controls.addEventListener("controlend", handleEnd);

    const maybeCleanup = oncreate?.(controls);
    if (typeof maybeCleanup === "function") userCleanup = maybeCleanup;

    return () => {
      controls?.removeEventListener("update", handleUpdate);
      controls?.removeEventListener("controlstart", handleStart);
      controls?.removeEventListener("controlend", handleEnd);
    };
  });

  // Reactive prop sync - each effect guards on controls being live.
  $effect(() => {
    if (controls) controls.enabled = enabled;
  });
  $effect(() => {
    if (controls && minDistance != null) controls.minDistance = minDistance;
  });
  $effect(() => {
    if (controls && maxDistance != null) controls.maxDistance = maxDistance;
  });
  $effect(() => {
    if (controls && minPolarAngle != null)
      controls.minPolarAngle = minPolarAngle;
  });
  $effect(() => {
    if (controls && maxPolarAngle != null)
      controls.maxPolarAngle = maxPolarAngle;
  });
  $effect(() => {
    if (controls && minAzimuthAngle != null)
      controls.minAzimuthAngle = minAzimuthAngle;
  });
  $effect(() => {
    if (controls && maxAzimuthAngle != null)
      controls.maxAzimuthAngle = maxAzimuthAngle;
  });
  $effect(() => {
    if (controls) controls.colliderMeshes = colliderMeshes;
  });
  $effect(() => {
    if (!controls || rotateSpeed == null) return;
    controls.azimuthRotateSpeed = rotateSpeed;
    controls.polarRotateSpeed = rotateSpeed;
  });
  $effect(() => {
    // camera-controls truck is world units per pan-unit; three.js
    // OrbitControls pan is distance-scaled. Doubling the consumer's
    // panSpeed lands close to the three.js feel at typical scene
    // scales.
    if (controls && panSpeed != null) controls.truckSpeed = panSpeed * 2;
  });
  $effect(() => {
    if (controls && zoomSpeed != null) controls.dollySpeed = zoomSpeed;
  });
  $effect(() => {
    if (!controls) return;
    const rightAction =
      rightDragAction === "rotate"
        ? CameraControls.ACTION.ROTATE
        : rightDragAction === "pan"
          ? CameraControls.ACTION.TRUCK
          : rightDragAction === "none"
            ? CameraControls.ACTION.NONE
            : enablePan
              ? CameraControls.ACTION.TRUCK
              : CameraControls.ACTION.NONE;
    controls.mouseButtons.right = rightAction;
    if (!enablePan) {
      controls.mouseButtons.middle = CameraControls.ACTION.DOLLY;
      controls.touches.two = CameraControls.ACTION.TOUCH_DOLLY_ROTATE;
    } else {
      controls.mouseButtons.middle = CameraControls.ACTION.DOLLY;
      controls.touches.two = CameraControls.ACTION.TOUCH_DOLLY_TRUCK;
    }
  });
  $effect(() => {
    if (!controls || !target) return;
    const t = Array.isArray(target)
      ? target
      : ([target.x, target.y, target.z] as Vec3Tuple);
    // Animated transition so prop-driven target changes ease in
    // rather than snapping mid-drag.
    controls.setTarget(t[0], t[1], t[2], true);
  });

  // Matches three.js OrbitControls: ~6deg/sec per unit of speed at 60fps.
  const AUTO_ROTATE_RAD_PER_SEC = Math.PI / 30;

  useTask(taskKey, (delta) => {
    if (!controls || paused) return;
    const clampedDelta = Math.min(delta, 0.1);
    if (autoRotate) {
      controls.azimuthAngle +=
        clampedDelta * AUTO_ROTATE_RAD_PER_SEC * autoRotateSpeed;
    }
    controls.update(clampedDelta);
  });

  onDestroy(() => {
    userCleanup?.();
    controls?.dispose();
    controls = null;
    ref = null;
  });
</script>
