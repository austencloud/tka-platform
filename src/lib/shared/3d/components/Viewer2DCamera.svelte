<script lang="ts">
  /**
   * Viewer2DCamera
   *
   * OrthographicCamera for the 2D grid view. Looks along -Z at the XY plane.
   * Frustum sized to show the full grid circle with padding.
   *
   * No orbit controls — the 2D view is fixed. Pan/zoom can be added later.
   */

  import { T } from "@threlte/core";

  // Frustum half-extent: grid is a unit circle (radius=1), add 40% padding
  const FRUSTUM_HALF = 1.4;
  const CAMERA_Z = 10;
</script>

<T.OrthographicCamera
  makeDefault
  position={[0, 0, CAMERA_Z]}
  left={-FRUSTUM_HALF}
  right={FRUSTUM_HALF}
  top={FRUSTUM_HALF}
  bottom={-FRUSTUM_HALF}
  near={0.1}
  far={100}
/>
