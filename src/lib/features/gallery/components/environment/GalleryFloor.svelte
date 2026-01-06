<script lang="ts">
  /**
   * GalleryFloor
   *
   * Polished floor plane for the gallery environment.
   */

  import { T } from "@threlte/core";
  import { FLOOR_COLOR } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Floor width (X axis) */
    width: number;
    /** Floor depth (Z axis) */
    depth: number;
    /** Floor color */
    color?: string;
  }

  let { width, depth, color = FLOOR_COLOR }: Props = $props();

  // Floor is positioned at Y=0, centered on X, extending in +Z direction
  const centerX = 0;
  const centerZ = depth / 2;
</script>

<T.Group position={[centerX, 0, centerZ]}>
  <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
    <T.PlaneGeometry args={[width, depth]} />
    <T.MeshStandardMaterial {color} roughness={0.3} metalness={0.1} />
  </T.Mesh>
</T.Group>
