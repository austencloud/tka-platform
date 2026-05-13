<script lang="ts">
  /**
   * GroundPlane Primitive
   *
   * A simple colored ground surface for 3D environments.
   * For textured ground, use TexturedGroundPlane instead.
   * Ground Y is derived from user proportions (shoulder at grid center Y=0).
   */

  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    /** Ground color (hex string) */
    color?: string;
    /** Opacity (0-1) */
    opacity?: number;
    /** Radius of the plane */
    size?: number;
    /** Geometry segments for smoothness */
    segments?: number;
    /** Override Y position (uses user proportions if not provided) */
    overrideY?: number;
  }

  // Default values in meters (1 unit = 1 meter)
  let {
    color = "#2d5a27",
    opacity = 0.9,
    size = 25, // 25 meters radius
    segments = 64,
    overrideY,
  }: Props = $props();

  // Use dynamic ground Y from user proportions, or override if provided
  const groundY = $derived(overrideY ?? userProportionsState.groundY);
</script>

<T.Group position={[0, groundY, 0]}>
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[size, segments]} />
    <T.MeshStandardMaterial
      {color}
      {opacity}
      transparent={opacity < 1}
      side={2}
    />
  </T.Mesh>
</T.Group>
