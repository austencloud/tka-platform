<script lang="ts">
  /**
   * Viewer3DCamera
   *
   * PerspectiveCamera with OrbitControls for the sequence viewer.
   * Restores persisted camera position on mount, saves on orbit end.
   * Registers a snapTo callback so view preset buttons can animate
   * the camera to predefined positions.
   */

  import { onMount, onDestroy } from "svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { T, useTask } from "@threlte/core";
  import { PerspectiveCamera, Vector3 } from "three";
  import type CameraControls from "camera-controls";
  import OrbitControls from "./OrbitControls.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { CameraStateSnapshot } from "@austencloud/scene-3d";
  import { UnifiedCameraController } from "@austencloud/camera-3d";
  import { cameraPreferences } from "../camera/camera-preferences.svelte";
  import { CameraMode } from "../camera/types";
  import type { AvatarState, PhysicsProvider } from "../camera/types";
  import type { ViewerControlSink } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import {
    sampleInterruptibleVector3,
    type TimedTransition,
  } from "../camera/transitions";

  interface Props {
    /** Camera player avatar for fly/walk modes (WASD writes here, not the performer). */
    cameraPlayerAvatar?: AvatarState | null;
    /** Physics provider for fly mode (noclip). Null for orbit/walk. */
    cameraPlayerPhysics?: PhysicsProvider | null;
    onSettingChange?: ViewerControlSink;
  }

  let {
    cameraPlayerAvatar = null,
    cameraPlayerPhysics = null,
    onSettingChange,
  }: Props = $props();

  const viewer3DState = getViewer3DContext();
  const navMode = $derived(viewer3DState.navMode);
  const maxOrbitDistance = $derived(
    viewer3DState.seededBackgroundType === BackgroundType.BLOSSOM ? 82 : 25
  );

  // Grid center in 3D world space.
  // Y=0 is shoulder height (proportions reference). Grid T.Group is at
  // position.z = gridOffset = +0.3 inside PerformerRig (which has no rotation
  // in wall mode). Positive Z is in front of the GLTF model at zero rotation.
  const GRID_CENTER_Y = 0;
  const GRID_CENTER_Z = 0.3;
  const GRID_RADIUS_3D = 0.52; // meters
  const FOV_DEG = 50;

  /**
   * Compute camera Z distance so the 3D grid matches the 2D canvas grid size.
   * Reads the actual DOM positions of both the 2D canvas and the 3D pane.
   */
  function computeAlignedPosition(): {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } {
    const target = { x: 0, y: GRID_CENTER_Y, z: GRID_CENTER_Z };
    const fallback = { position: { x: 0, y: 0, z: -2.5 }, target };

    if (typeof document === "undefined") return fallback;

    // Find the 2D animation canvas (square, ~785px)
    const allCanvases = document.querySelectorAll("canvas");
    let canvas2D: HTMLCanvasElement | null = null;
    let paneEl: Element | null = null;

    for (const c of allCanvases) {
      const r = c.getBoundingClientRect();
      if (
        Math.abs(r.width - r.height) < 10 &&
        r.width > 200 &&
        r.width < 1200
      ) {
        // Square canvas = likely the 2D AnimatorCanvas
        canvas2D = c;
        paneEl = c.closest(".animation-pane") || c.closest(".media-pane");
        break;
      }
    }

    if (!canvas2D || !paneEl) return fallback;

    const canvasRect = canvas2D.getBoundingClientRect();
    const paneRect = paneEl.getBoundingClientRect();

    // 2D grid: hand point radius = 28.6% of canvas width (143/500)
    const gridRadiusPx = canvasRect.width * 0.286;
    const gridDiameterPx = gridRadiusPx * 2;

    // Grid center position relative to pane
    const gridCenterX = canvasRect.left + canvasRect.width / 2 - paneRect.left;
    const gridCenterY = canvasRect.top + canvasRect.height / 2 - paneRect.top;

    // Grid center as percentage of pane
    const centerYPct = gridCenterY / paneRect.height;

    // Grid diameter as percentage of pane width
    const diamPct = gridDiameterPx / paneRect.width;

    // Camera distance: grid diameter (1.04m) should subtend diamPct of viewport width
    // Visible width at distance d = 2 * d * tan(hFov/2)
    // hFov = 2 * atan(tan(vFov/2) * aspect)
    const aspect = paneRect.width / paneRect.height;
    const vFovRad = ((FOV_DEG / 2) * Math.PI) / 180;
    const hFovHalf = Math.atan(Math.tan(vFovRad) * aspect);
    const visibleWidthAtD1 = 2 * Math.tan(hFovHalf); // visible width per meter of distance
    const dist = (GRID_RADIUS_3D * 2) / (diamPct * visibleWidthAtD1);

    // Y offset: camera needs to be above grid center so grid projects below viewport center
    // Grid center at centerYPct of viewport, viewport center at 0.5
    const yOffsetPct = 0.5 - centerYPct; // negative if grid is below center
    const visibleHeightAtDist = 2 * dist * Math.tan(vFovRad);
    const cameraYOffset = yOffsetPct * visibleHeightAtDist;

    const cameraY = GRID_CENTER_Y + cameraYOffset;
    // Camera in front of avatar (facing -Z toward the performer)
    const cameraZ = GRID_CENTER_Z - dist;

    return {
      position: { x: 0, y: cameraY, z: cameraZ },
      target,
    };
  }

  const computed = computeAlignedPosition();
  const defaultPosition = computed.position;
  const defaultTarget = computed.target;

  // Restore persisted camera if available, otherwise use computed default.
  // Guard against degenerate persisted state: if the saved target is missing,
  // contains NaN, underground, or collapsed onto the camera position, the
  // orbit would rotate around nothing meaningful (user-visible symptom:
  // "camera spins in place around itself"). In those cases, throw the
  // persisted snapshot away and fall back to sensible defaults.
  const persisted = viewer3DState.persistedCamera;
  const persistedPos = persisted?.position;
  const persistedTarget = persisted?.target;

  function isFinitePoint(
    p: { x: number; y: number; z: number } | undefined | null
  ): boolean {
    return (
      !!p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      Number.isFinite(p.z)
    );
  }

  function distSq(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  // OrbitControls enforces minDistance=1, so after any legitimate
  // interaction the camera and target must be at least 1m apart. Anything
  // tighter than that is corruption and would produce the "rotating in
  // place from my own head" symptom.
  const MIN_ORBIT_RADIUS_SQ = 1.0;

  const persistedLooksOk =
    isFinitePoint(persistedPos) &&
    isFinitePoint(persistedTarget) &&
    distSq(persistedPos!, persistedTarget!) >= MIN_ORBIT_RADIUS_SQ &&
    persistedTarget!.y >= -0.5;

  // When persisted state is broken, clear it. Without this, handleEnd()
  // would re-save the same broken snapshot on the next orbit-end and we'd
  // fall into the same validation branch forever.
  if (persisted && !persistedLooksOk && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("tka-viewer3d-camera");
    } catch {
      // Storage unavailable - harmless, defaults will be used anyway.
    }
  }

  const initialPosition = persistedLooksOk ? persistedPos! : defaultPosition;
  const initialTarget = persistedLooksOk ? persistedTarget! : defaultTarget;

  // Live reference to the three.js camera. Populated via bind:ref on
  // <T.PerspectiveCamera> below. camera-controls needs the real camera
  // instance, not a threlte wrapper, so we bind the ref directly.
  let cameraRef = $state<PerspectiveCamera | undefined>(undefined);

  // The camera-controls instance, exposed by the child on mount. Used by
  // snapTo to imperatively move the camera with the library's built-in
  // smoothing instead of a hand-rolled rAF lerp.
  let controlsInstance: CameraControls | null = null;

  interface ActiveCameraReframe {
    timing: TimedTransition;
    startPosition: { x: number; y: number; z: number };
    endPosition: { x: number; y: number; z: number };
    startTarget: { x: number; y: number; z: number };
    endTarget: { x: number; y: number; z: number };
    startPositionVelocity: { x: number; y: number; z: number };
    startTargetVelocity: { x: number; y: number; z: number };
  }

  let activeCameraReframe: ActiveCameraReframe | null = null;
  const _reframePos = new Vector3();
  const _reframeTarget = new Vector3();

  function sampleCameraReframe(transition: ActiveCameraReframe, nowMs: number) {
    return {
      position: sampleInterruptibleVector3(
        transition.startPosition,
        transition.endPosition,
        transition.startPositionVelocity,
        transition.timing,
        nowMs
      ),
      target: sampleInterruptibleVector3(
        transition.startTarget,
        transition.endTarget,
        transition.startTargetVelocity,
        transition.timing,
        nowMs
      ),
    };
  }

  function beginCameraReframe(
    endPosition: { x: number; y: number; z: number },
    endTarget: { x: number; y: number; z: number },
    timing: TimedTransition
  ): void {
    const controls = controlsInstance;
    if (!controls) return;

    const nowMs = performance.now();
    let startPositionVelocity = { x: 0, y: 0, z: 0 };
    let startTargetVelocity = { x: 0, y: 0, z: 0 };

    if (activeCameraReframe) {
      const carried = sampleCameraReframe(activeCameraReframe, nowMs);
      _reframePos.set(
        carried.position.value.x,
        carried.position.value.y,
        carried.position.value.z
      );
      _reframeTarget.set(
        carried.target.value.x,
        carried.target.value.y,
        carried.target.value.z
      );
      startPositionVelocity = carried.position.velocity;
      startTargetVelocity = carried.target.velocity;
    } else {
      controls.getPosition(_reframePos);
      controls.getTarget(_reframeTarget);
    }

    activeCameraReframe = {
      timing,
      startPosition: {
        x: _reframePos.x,
        y: _reframePos.y,
        z: _reframePos.z,
      },
      endPosition: { ...endPosition },
      startTarget: {
        x: _reframeTarget.x,
        y: _reframeTarget.y,
        z: _reframeTarget.z,
      },
      endTarget: { ...endTarget },
      startPositionVelocity,
      startTargetVelocity,
    };
  }

  function updateCameraReframe(nowMs: number): void {
    const controls = controlsInstance;
    const transition = activeCameraReframe;
    if (!controls || !transition) return;

    const sample = sampleCameraReframe(transition, nowMs);
    controls.setLookAt(
      sample.position.value.x,
      sample.position.value.y,
      sample.position.value.z,
      sample.target.value.x,
      sample.target.value.y,
      sample.target.value.z,
      false
    );

    if (sample.position.done) activeCameraReframe = null;
  }

  function cancelCameraReframe(): void {
    activeCameraReframe = null;
  }

  const ORBIT_COLLAPSE_THRESHOLD = 0.5;
  const _healthPos = new Vector3();
  const _healthTgt = new Vector3();

  function checkOrbitHealth(controls: CameraControls): boolean {
    controls.getPosition(_healthPos);
    controls.getTarget(_healthTgt);
    const d = _healthPos.distanceTo(_healthTgt);
    if (d < ORBIT_COLLAPSE_THRESHOLD) {
      console.error(
        `[Viewer3DCamera] 🔴 ORBIT COLLAPSED — distance=${d.toFixed(4)}`,
        `\n  camera: (${_healthPos.x.toFixed(3)}, ${_healthPos.y.toFixed(3)}, ${_healthPos.z.toFixed(3)})`,
        `\n  target: (${_healthTgt.x.toFixed(3)}, ${_healthTgt.y.toFixed(3)}, ${_healthTgt.z.toFixed(3)})`,
        `\n  persisted:`,
        JSON.parse(localStorage.getItem("tka-viewer3d-camera") ?? "null"),
        `\n  Auto-recovering to defaults.`
      );
      controls.setLookAt(
        defaultPosition.x,
        defaultPosition.y,
        defaultPosition.z,
        defaultTarget.x,
        defaultTarget.y,
        defaultTarget.z,
        true
      );
      localStorage.removeItem("tka-viewer3d-camera");
      return true;
    }
    return false;
  }

  // Camera pose persistence follows the same cadence as the museum/review
  // resume-point writers: keep the latest live pose in memory, write at most
  // once every 500ms while it moves, then flush synchronously at lifecycle
  // boundaries. That last flush is what makes refreshes and Vite HMR restore
  // the exact view instead of the previous completed drag.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSnapshot: CameraStateSnapshot | null = null;
  const _endPos = new Vector3();
  const _endTgt = new Vector3();

  function captureCameraSnapshot(
    controls: CameraControls
  ): CameraStateSnapshot | null {
    const camera = cameraRef;
    if (!camera) return null;

    controls.getPosition(_endPos);
    controls.getTarget(_endTgt);
    if (_endPos.distanceTo(_endTgt) < ORBIT_COLLAPSE_THRESHOLD) return null;

    return {
      position: { x: _endPos.x, y: _endPos.y, z: _endPos.z },
      rotation: {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z,
      },
      fov: camera.fov ?? 50,
      target: { x: _endTgt.x, y: _endTgt.y, z: _endTgt.z },
      timestamp: Date.now(),
    };
  }

  function flushCameraSave(controls: CameraControls | null = controlsInstance) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (controls) {
      pendingSnapshot = captureCameraSnapshot(controls) ?? pendingSnapshot;
    }
    if (pendingSnapshot) {
      viewer3DState.updateCameraSnapshot(pendingSnapshot);
      pendingSnapshot = null;
    }
  }

  function scheduleCameraSave(controls: CameraControls) {
    pendingSnapshot = captureCameraSnapshot(controls) ?? pendingSnapshot;
    if (!pendingSnapshot || saveTimer) return;
    saveTimer = setTimeout(() => flushCameraSave(), 500);
  }

  function handleControlEnd(controls: CameraControls) {
    const snapshot = captureCameraSnapshot(controls);
    if (!snapshot) {
      controls.getPosition(_endPos);
      controls.getTarget(_endTgt);
      console.error(
        `[Viewer3DCamera] 🔴 Blocked save of collapsed orbit state — distance=${_endPos.distanceTo(_endTgt).toFixed(4)}`,
        `\n  pos: (${_endPos.x.toFixed(3)}, ${_endPos.y.toFixed(3)}, ${_endPos.z.toFixed(3)})`,
        `\n  tgt: (${_endTgt.x.toFixed(3)}, ${_endTgt.y.toFixed(3)}, ${_endTgt.z.toFixed(3)})`
      );
      checkOrbitHealth(controls);
      return;
    }

    pendingSnapshot = snapshot;
    flushCameraSave(controls);
    onSettingChange?.("3d_camera", "orbit_gesture", null, "completed");
  }

  function snapTo(
    targetPos: { x: number; y: number; z: number },
    targetLookAt: { x: number; y: number; z: number },
    spherical?: { azimuth: number; polar: number },
    animate: boolean = true,
    transitionTiming?: TimedTransition
  ) {
    if (!controlsInstance) return;

    if (animate && transitionTiming && !spherical) {
      beginCameraReframe(targetPos, targetLookAt, transitionTiming);
      return;
    }

    cancelCameraReframe();

    if (spherical) {
      controlsInstance.setLookAt(
        targetPos.x,
        targetPos.y,
        targetPos.z,
        targetLookAt.x,
        targetLookAt.y,
        targetLookAt.z,
        animate
      );
      controlsInstance.rotateTo(spherical.azimuth, spherical.polar, false);
    } else {
      controlsInstance.setLookAt(
        targetPos.x,
        targetPos.y,
        targetPos.z,
        targetLookAt.x,
        targetLookAt.y,
        targetLookAt.z,
        animate
      );
    }
  }

  onMount(() => {
    viewer3DState.registerSnapTo(snapTo);

    function onVisibilityChange() {
      if (!controlsInstance) return;
      if (document.hidden) {
        flushCameraSave(controlsInstance);
      } else {
        checkOrbitHealth(controlsInstance);
      }
    }

    const onPageHide = () => flushCameraSave(controlsInstance);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  });

  // Per-frame tick for the camera-choreography driver. Runs every frame;
  // the state's tick() is a no-op when no preset is driving, so this is
  // free when recording is idle. Gated off during Pass 2 export - the
  // offline renderer drives the camera straight from recorded keyframes,
  // and a live driver mutating `controls.azimuthAngle` would fight it.
  useTask((delta) => {
    if (viewer3DState.isExporting) return;
    updateCameraReframe(performance.now());
    viewer3DState.cameraChoreography.tick(delta);
  });

  onDestroy(() => {
    cancelCameraReframe();
    flushCameraSave(controlsInstance);
  });
</script>

<T.PerspectiveCamera
  bind:ref={cameraRef}
  makeDefault
  position={[initialPosition.x, initialPosition.y, initialPosition.z]}
  fov={50}
/>

{#if navMode === "orbit" && cameraRef}
  <OrbitControls
    minDistance={1}
    maxDistance={maxOrbitDistance}
    maxPolarAngle={Math.PI / 2}
    paused={viewer3DState.isExporting}
    autoRotate={viewer3DState.seededAutoOrbit}
    autoRotateSpeed={viewer3DState.seededAutoOrbitSpeed}
    oncreate={(c) => {
      controlsInstance = c;
      const live = viewer3DState.persistedCamera;
      const pos = live?.position ?? initialPosition;
      const tgt = live?.target ?? initialTarget;
      const pOk =
        isFinitePoint(pos) &&
        isFinitePoint(tgt) &&
        distSq(pos, tgt) >= MIN_ORBIT_RADIUS_SQ;
      const usePos = pOk ? pos : defaultPosition;
      const useTgt = pOk ? tgt : defaultTarget;
      c.setLookAt(
        usePos.x,
        usePos.y,
        usePos.z,
        useTgt.x,
        useTgt.y,
        useTgt.z,
        false
      );
      if (!pOk) {
        console.warn(
          `[Viewer3DCamera] Persisted camera state was invalid — reset to defaults.`,
          `\n  raw pos:`,
          pos,
          `\n  raw tgt:`,
          tgt
        );
      }
      checkOrbitHealth(c);
      viewer3DState.cameraChoreography.registerControls(c);
      return () => {
        viewer3DState.cameraChoreography.unregisterControls(c);
      };
    }}
    oncontrolstart={() => {
      cancelCameraReframe();
      viewer3DState.setCameraDragging(true);
    }}
    onchange={(c) => scheduleCameraSave(c)}
    oncontrolend={(c) => {
      viewer3DState.setCameraDragging(false);
      handleControlEnd(c);
    }}
  />
{/if}

{#if navMode === "fly" && cameraPlayerAvatar}
  <!-- Fly: first-person free camera. Physics provider reports permanent
       noclip so the controller uses full-3D forward (pitch lifts you),
       no gravity, no ground. Click canvas to enter pointer lock. -->
  <UnifiedCameraController
    destinationId="viewer-3d-fly"
    {cameraPreferences}
    avatarState={cameraPlayerAvatar}
    physicsProvider={cameraPlayerPhysics}
    enabled={true}
    allowedModes={[CameraMode.FIRST_PERSON]}
    disableModeToggle={true}
    moveSpeed={4}
    sprintMultiplier={2.5}
    gravity={0}
    jumpForce={0}
    onInteractionEnd={(kind) =>
      onSettingChange?.("3d_camera", "fly_gesture", null, kind)}
  />
{/if}
