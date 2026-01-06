<script lang="ts">
  /**
   * GalleryWall
   *
   * A single wall segment in the gallery.
   * Rendered as a box with the specified start/end positions.
   */

  import { T } from "@threlte/core";
  import type { WallSegment } from "../../domain/models/GalleryLayout";
  import { WALL_COLOR } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Wall segment definition */
    wall: WallSegment;
    /** Wall color */
    color?: string;
  }

  let { wall, color = WALL_COLOR }: Props = $props();

  // Calculate wall dimensions and position
  const dx = wall.endPos.x - wall.startPos.x;
  const dz = wall.endPos.z - wall.startPos.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const wallAngle = Math.atan2(dx, dz);

  // Center position of the wall
  const centerX = (wall.startPos.x + wall.endPos.x) / 2;
  const centerY = wall.height / 2;
  const centerZ = (wall.startPos.z + wall.endPos.z) / 2;
</script>

<T.Mesh
  position={[centerX, centerY, centerZ]}
  rotation.y={wallAngle}
  receiveShadow
  castShadow
>
  <T.BoxGeometry args={[wall.thickness, wall.height, wallLength]} />
  <T.MeshStandardMaterial {color} roughness={0.9} metalness={0} />
</T.Mesh>
