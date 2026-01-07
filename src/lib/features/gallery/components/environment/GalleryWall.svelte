<script lang="ts">
  /**
   * GalleryWall
   *
   * A wall segment with luxury museum styling:
   * - Rich burgundy wallpaper
   * - Gold crown molding at ceiling
   * - Gold chair rail at waist height
   * - Gold baseboard at floor
   */

  import { T } from "@threlte/core";
  import type { WallSegment } from "../../domain/models/GalleryLayout";
  import {
    WALL_COLOR_MAIN,
    WALL_COLOR_UPPER,
    TRIM_COLOR,
    CROWN_MOLDING_HEIGHT,
    CROWN_MOLDING_DEPTH,
    CHAIR_RAIL_HEIGHT,
    CHAIR_RAIL_SIZE,
    BASEBOARD_HEIGHT,
    BASEBOARD_DEPTH,
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Wall segment definition */
    wall: WallSegment;
    /** Main wall color (lower section) */
    colorMain?: string;
    /** Upper wall color (above chair rail) */
    colorUpper?: string;
    /** Trim/molding color */
    colorTrim?: string;
    /** Whether to show trim details */
    showTrim?: boolean;
  }

  let {
    wall,
    colorMain = WALL_COLOR_MAIN,
    colorUpper = WALL_COLOR_UPPER,
    colorTrim = TRIM_COLOR,
    showTrim = true,
  }: Props = $props();

  // Calculate wall dimensions and position
  const dx = wall.endPos.x - wall.startPos.x;
  const dz = wall.endPos.z - wall.startPos.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const wallAngle = Math.atan2(dx, dz);

  // Center position of the wall
  const centerX = (wall.startPos.x + wall.endPos.x) / 2;
  const centerZ = (wall.startPos.z + wall.endPos.z) / 2;

  // Wall section heights
  const lowerSectionHeight = CHAIR_RAIL_HEIGHT;
  const upperSectionHeight = wall.height - CHAIR_RAIL_HEIGHT;

  // Determine which side trim should protrude based on wall orientation
  // For side walls, trim protrudes inward toward hallway center
  const isLeftWall = wall.id.includes("left");
  const isRightWall = wall.id.includes("right");
  const trimDirection = isLeftWall ? 1 : isRightWall ? -1 : 0;
</script>

<T.Group position={[centerX, 0, centerZ]} rotation.y={wallAngle}>
  <!-- Lower wall section (below chair rail) - darker burgundy -->
  <T.Mesh
    position={[0, lowerSectionHeight / 2, 0]}
    receiveShadow
    castShadow
  >
    <T.BoxGeometry args={[wall.thickness, lowerSectionHeight, wallLength]} />
    <T.MeshStandardMaterial color={colorMain} roughness={0.85} metalness={0} />
  </T.Mesh>

  <!-- Upper wall section (above chair rail) - slightly lighter -->
  <T.Mesh
    position={[0, CHAIR_RAIL_HEIGHT + upperSectionHeight / 2, 0]}
    receiveShadow
    castShadow
  >
    <T.BoxGeometry args={[wall.thickness, upperSectionHeight, wallLength]} />
    <T.MeshStandardMaterial color={colorUpper} roughness={0.85} metalness={0} />
  </T.Mesh>

  {#if showTrim}
    <!-- Crown molding (at ceiling) -->
    <T.Mesh
      position={[
        trimDirection * (wall.thickness / 2 + CROWN_MOLDING_DEPTH / 2),
        wall.height - CROWN_MOLDING_HEIGHT / 2,
        0,
      ]}
      receiveShadow
      castShadow
    >
      <T.BoxGeometry
        args={[CROWN_MOLDING_DEPTH, CROWN_MOLDING_HEIGHT, wallLength]}
      />
      <T.MeshStandardMaterial
        color={colorTrim}
        roughness={0.4}
        metalness={0.6}
      />
    </T.Mesh>

    <!-- Chair rail (waist height) -->
    <T.Mesh
      position={[
        trimDirection * (wall.thickness / 2 + CHAIR_RAIL_SIZE / 2),
        CHAIR_RAIL_HEIGHT,
        0,
      ]}
      receiveShadow
      castShadow
    >
      <T.BoxGeometry args={[CHAIR_RAIL_SIZE, CHAIR_RAIL_SIZE, wallLength]} />
      <T.MeshStandardMaterial
        color={colorTrim}
        roughness={0.4}
        metalness={0.6}
      />
    </T.Mesh>

    <!-- Baseboard (at floor) -->
    <T.Mesh
      position={[
        trimDirection * (wall.thickness / 2 + BASEBOARD_DEPTH / 2),
        BASEBOARD_HEIGHT / 2,
        0,
      ]}
      receiveShadow
      castShadow
    >
      <T.BoxGeometry args={[BASEBOARD_DEPTH, BASEBOARD_HEIGHT, wallLength]} />
      <T.MeshStandardMaterial
        color={colorTrim}
        roughness={0.4}
        metalness={0.6}
      />
    </T.Mesh>
  {/if}
</T.Group>
