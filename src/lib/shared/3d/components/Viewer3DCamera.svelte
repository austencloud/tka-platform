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
  import { T, useTask } from "@threlte/core";
  import * as THREE from "three";
  import type CameraControls from "camera-controls";
  import OrbitControls from "./OrbitControls.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { CameraStateSnapshot } from "@austencloud/scene-3d";
  import UnifiedCameraController from "../camera/UnifiedCameraController.svelte";
  import { CameraMode } from "../camera/types";
  import type { AvatarState, PhysicsProvider } from "../camera/types";

  interface Props {
    /** Camera player avatar for fly/walk modes (WASD writes here, not the performer). */
    cameraPlayerAvatar?: AvatarState | null;
    /** Physics provider for fly mode (noclip). Null for orbit/walk. */
    cameraPlayerPhysics?: PhysicsProvider | null;
  }

  let { cameraPlayerAvatar = null, cameraPlayerPhysics = null }: Props = $props();

  const viewer3DState = getViewer3DContext();
  const navMode = $derived(viewer3DState.navMode);

  // Grid center in 3D world space.
  // Y=0 is shoulder height (proportions reference). Grid T.Group is at
  // position.z = gridOffset = +0.3 inside PerformerRig (which has no rotation
  // in wall mode). Positive Z is behind the GLTF model that faces -Z.
  const GRID_CENTER_Y = 0;
  const GRID_CENTER_Z = 0.3;
  const GRID_RADIUS_3D = 0.52; // meters
  const FOV_DEG = 50;

  /**
   * Compute camera Z distance so the 3D grid matches the 2D canvas grid size.
   * Reads the actual DOM positions of both the 2D canvas and the 3D pane.
   */
  function computeAlignedPosition(): { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } } {
    const target = { x: 0, y: GRID_CENTER_Y, z: GRID_CENTER_Z };
    const fallback = { position: { x: 0, y: 0, z: -2.5 }, target };

    if (typeof document === "undefined") return fallback;

    // Find the 2D animation canvas (square, ~785px)
    const allCanvases = document.querySelectorAll("canvas");
    let canvas2D: HTMLCanvasElement | null = null;
    let paneEl: Element | null = null;

    for (const c of allCanvases) {
      const r = c.getBoundingClientRect();
      if (Math.abs(r.width - r.height) < 10 && r.width > 200 && r.width < 1200) {
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
    const vFovRad = (FOV_DEG / 2) * Math.PI / 180;
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

  function isFinitePoint(p: { x: number; y: number; z: number } | undefined | null): boolean {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  }

  function distSq(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
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
  let cameraRef = $state<THREE.PerspectiveCamera | undefined>(undefined);

  // The camera-controls instance, exposed by the child on mount. Used by
  // snapTo to imperatively move the camera with the library's built-in
  // smoothing instead of a hand-rolled rAF lerp.
  let controlsInstance: CameraControls | null = null;

  // Debounce persistence - only save after user stops orbiting for 500ms.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const _endPos = new THREE.Vector3();
  const _endTgt = new THREE.Vector3();

  function handleControlEnd(controls: CameraControls) {
    const camera = cameraRef;
    if (!camera) return;

    controls.getPosition(_endPos);
    controls.getTarget(_endTgt);
    // Snapshot the vectors immediately - the debounced save runs
    // after 500ms by which point the user may have started another
    // drag that mutates them.
    const pos = { x: _endPos.x, y: _endPos.y, z: _endPos.z };
    const tgt = { x: _endTgt.x, y: _endTgt.y, z: _endTgt.z };

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const snapshot: CameraStateSnapshot = {
        position: pos,
        rotation: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
        fov: camera.fov ?? 50,
        target: tgt,
        timestamp: Date.now(),
      };
      viewer3DState.updateCameraSnapshot(snapshot);
    }, 500);
  }

  function snapTo(
    targetPos: { x: number; y: number; z: number },
    targetLookAt: { x: number; y: number; z: number },
  ) {
    if (!controlsInstance) return;
    // camera-controls handles the smoothing internally via smoothTime.
    // Passing enableTransition=true interpolates from the current pose.
    controlsInstance.setLookAt(
      targetPos.x,
      targetPos.y,
      targetPos.z,
      targetLookAt.x,
      targetLookAt.y,
      targetLookAt.z,
      true,
    );
  }

  onMount(() => {
    viewer3DState.registerSnapTo(snapTo);
  });

  // Per-frame tick for the camera-choreography driver. Runs every frame;
  // the state's tick() is a no-op when no preset is driving, so this is
  // free when recording is idle. Gated off during Pass 2 export - the
  // offline renderer drives the camera straight from recorded keyframes,
  // and a live driver mutating `controls.azimuthAngle` would fight it.
  useTask((delta) => {
    if (viewer3DState.isExporting) return;
    viewer3DState.cameraChoreography.tick(delta);
  });

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
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
    maxDistance={25}
    maxPolarAngle={Math.PI / 2}
    paused={viewer3DState.isExporting}
    oncreate={(c) => {
      controlsInstance = c;
      // Place the camera at the persisted / computed initial pose
      // with no transition - we want the scene to render at the
      // saved spot on first paint.
      c.setLookAt(
        initialPosition.x,
        initialPosition.y,
        initialPosition.z,
        initialTarget.x,
        initialTarget.y,
        initialTarget.z,
        false,
      );
      // Register this controls instance with the camera-choreography
      // state so recording presets can drive it during Pass 1 of the
      // 3D export pipeline.
      viewer3DState.cameraChoreography.registerControls(c);
      return () => {
        viewer3DState.cameraChoreography.unregisterControls(c);
      };
    }}
    oncontrolstart={() => viewer3DState.setCameraDragging(true)}
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
    avatarState={cameraPlayerAvatar}
    physicsProvider={cameraPlayerPhysics}
    enabled={true}
    allowedModes={[CameraMode.FIRST_PERSON]}
    disableModeToggle={true}
    moveSpeed={4}
    sprintMultiplier={2.5}
    gravity={0}
    jumpForce={0}
  />
{/if}
