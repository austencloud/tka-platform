<script lang="ts">
  /**
   * Viewer3DCamera
   *
   * PerspectiveCamera with OrbitControls for the sequence viewer.
   * Lives inside a Threlte <Canvas>. Provides a fixed default angle:
   * slight azimuth (≈20°) and elevation (≈10°) at 2.5 m distance,
   * looking at chest height. No props needed for v1 — keyboard shortcuts
   * and camera state persistence are deferred.
   */

  import { T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";

  // Camera behind the performer, looking over their shoulder at the wall plane.
  // TKA pictographs are authored from the performer's perspective: south=down,
  // east=performer's right=viewer's right. Placing the camera at -Z achieves
  // this — we see the avatar's back, and the staves on the XY plane read
  // correctly (performer's right +X = our right).
  const defaultPosition = { x: -0.85, y: 1.6, z: -2.3 };
  const defaultTarget = { x: 0, y: 1.2, z: 0 };
</script>

<T.PerspectiveCamera
  makeDefault
  position={[defaultPosition.x, defaultPosition.y, defaultPosition.z]}
  fov={50}
>
  <OrbitControls
    target={[defaultTarget.x, defaultTarget.y, defaultTarget.z]}
    enableDamping
    dampingFactor={0.1}
    minDistance={1}
    maxDistance={8}
  />
</T.PerspectiveCamera>
