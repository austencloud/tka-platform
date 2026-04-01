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

  const viewer3DState = getViewer3DContext();

  // Camera behind the performer (performer's perspective / "Back" preset).
  // Avatar faces +Z (toward audience), so -Z = behind = seeing the avatar's back.
  // This matches TKA pictograph notation: red = right, blue = left.
  // Grid center is at (0, ~1.55, 0.3) — shoulder height (STAGE_LIFT) plus
  // gridOffset forward. Camera targets this so the grid disc intersection
  // point is dead-center in the viewport.
  // Pull back to ~3.0 so the grid appears inset like the 2D canvas (15-20% padding)
  const defaultPosition = { x: 0, y: 1.85, z: -3.0 };
  const defaultTarget = { x: 0, y: 1.55, z: 0.3 };

  // Restore persisted camera position if available
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
    maxDistance={8}
    onend={handleEnd}
  />
</T.PerspectiveCamera>
