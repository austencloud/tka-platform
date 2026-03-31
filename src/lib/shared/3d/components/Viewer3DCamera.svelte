<script lang="ts">
  /**
   * Viewer3DCamera
   *
   * PerspectiveCamera with OrbitControls for the sequence viewer.
   * Restores persisted camera position on mount, saves on orbit end.
   */

  import { T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";

  const viewer3DState = getViewer3DContext();

  // Camera behind the performer, looking over their shoulder at the wall plane.
  const defaultPosition = { x: -0.85, y: 1.6, z: -2.3 };
  const defaultTarget = { x: 0, y: 1.2, z: 0 };

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
      // Persist to localStorage only — don't write to $state on every orbit
      // to avoid triggering re-renders that cause infinite onchange loops.
      // The updateCameraSnapshot writes to both $state and localStorage,
      // so we call it only once after the user stops moving.
      viewer3DState.updateCameraSnapshot(snapshot);
    }, 500);
  }
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
