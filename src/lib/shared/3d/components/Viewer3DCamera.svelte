<script lang="ts">
  /**
   * Viewer3DCamera
   *
   * PerspectiveCamera with OrbitControls for the sequence viewer.
   * Restores persisted camera position on mount, saves on orbit change.
   */

  import { T, useThrelte } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";

  const viewer3DState = getViewer3DContext();

  // Camera behind the performer, looking over their shoulder at the wall plane.
  // TKA pictographs are authored from the performer's perspective: south=down,
  // east=performer's right=viewer's right. Placing the camera at -Z achieves
  // this — we see the avatar's back, and the staves on the XY plane read
  // correctly (performer's right +X = our right).
  const defaultPosition = { x: -0.85, y: 1.6, z: -2.3 };
  const defaultTarget = { x: 0, y: 1.2, z: 0 };

  // Restore persisted camera position if available
  const persisted = viewer3DState.persistedCamera;
  const initialPosition = persisted
    ? persisted.position
    : defaultPosition;
  const initialTarget = persisted
    ? persisted.target
    : defaultTarget;

  let controlsRef: any = $state(null);

  function handleChange() {
    if (!controlsRef) return;
    const camera = controlsRef.object;
    const target = controlsRef.target;
    if (!camera || !target) return;

    const snapshot: CameraStateSnapshot = {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      rotation: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
      fov: camera.fov ?? 50,
      target: { x: target.x, y: target.y, z: target.z },
      timestamp: Date.now(),
    };
    viewer3DState.updateCameraSnapshot(snapshot);
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
    onchange={handleChange}
  />
</T.PerspectiveCamera>
