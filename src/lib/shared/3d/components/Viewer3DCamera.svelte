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
  import { T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { Vector3 } from "three";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";
  import { STAGE } from "../scale/scale-constants";

  const viewer3DState = getViewer3DContext();

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

  // Restore persisted camera if available, otherwise use computed default
  const persisted = viewer3DState.persistedCamera;
  const initialPosition = persisted?.position ?? defaultPosition;
  const initialTarget = persisted?.target ?? defaultTarget;

  let controlsRef: any = $state(null);

  // Debounce persistence — only save after user stops orbiting for 500ms.
  // This avoids the infinite loop from writing $state on every onchange frame.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function handleEnd() {
    if (!controlsRef) return;
    const camera = controlsRef.object;
    const target = controlsRef.target;
    if (!camera || !target) return;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const snapshot: CameraStateSnapshot = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        rotation: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
        fov: camera.fov ?? 50,
        target: { x: target.x, y: target.y, z: target.z },
        timestamp: Date.now(),
      };
      viewer3DState.updateCameraSnapshot(snapshot);
    }, 500);
  }

  // Smooth camera animation via lerp
  let animFrameId: number | null = null;

  function snapTo(
    targetPos: { x: number; y: number; z: number },
    targetLookAt: { x: number; y: number; z: number }
  ) {
    if (!controlsRef) return;
    const camera = controlsRef.object;
    const controls = controlsRef;
    if (!camera) return;

    // Cancel any in-progress animation
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);

    const startPos = new Vector3().copy(camera.position);
    const endPos = new Vector3(targetPos.x, targetPos.y, targetPos.z);
    const startTarget = new Vector3().copy(controls.target);
    const endTarget = new Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);

    const duration = 600; // ms
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      // Ease-out cubic for smooth deceleration
      const raw = Math.min(elapsed / duration, 1);
      const t = 1 - Math.pow(1 - raw, 3);

      camera.position.lerpVectors(startPos, endPos, t);
      controls.target.lerpVectors(startTarget, endTarget, t);
      controls.update();

      if (raw < 1) {
        animFrameId = requestAnimationFrame(animate);
      } else {
        animFrameId = null;
        // Persist final position
        handleEnd();
      }
    }

    animFrameId = requestAnimationFrame(animate);
  }

  // Register snapTo with the shared state so presets component can call it
  onMount(() => {
    viewer3DState.registerSnapTo(snapTo);
  });

  onDestroy(() => {
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    if (saveTimer) clearTimeout(saveTimer);
  });
</script>

<T.PerspectiveCamera
  makeDefault
  position={[initialPosition.x, initialPosition.y, initialPosition.z]}
  fov={50}
>
  <OrbitControls
    bind:ref={controlsRef}
    target={[initialTarget.x, initialTarget.y, initialTarget.z]}
    enableDamping
    dampingFactor={0.1}
    minDistance={1}
    maxDistance={25}
    maxPolarAngle={STAGE.ORBIT_MAX_POLAR_ANGLE}
    onstart={() => viewer3DState.setCameraDragging(true)}
    onend={() => {
      viewer3DState.setCameraDragging(false);
      handleEnd();
    }}
  />
</T.PerspectiveCamera>
