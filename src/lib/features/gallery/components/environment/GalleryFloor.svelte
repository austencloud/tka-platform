<script lang="ts">
  /**
   * GalleryFloor
   *
   * Luxury floor with polished dark wood and red velvet carpet runner.
   */

  import { T } from "@threlte/core";
  import {
    FLOOR_COLOR,
    CARPET_COLOR,
    CARPET_WIDTH_RATIO,
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Floor width (X axis) */
    width: number;
    /** Floor depth (Z axis) */
    depth: number;
    /** Floor color (wood) */
    colorFloor?: string;
    /** Carpet runner color */
    colorCarpet?: string;
    /** Whether to show carpet runner */
    showCarpet?: boolean;
  }

  let {
    width,
    depth,
    colorFloor = FLOOR_COLOR,
    colorCarpet = CARPET_COLOR,
    showCarpet = true,
  }: Props = $props();

  // Floor is positioned at Y=0, centered on X, extending in +Z direction
  const centerX = 0;
  const centerZ = depth / 2;

  // Carpet dimensions
  const carpetWidth = width * CARPET_WIDTH_RATIO;
  const sideFloorWidth = (width - carpetWidth) / 2;

  // Small Y offset to prevent z-fighting
  const carpetY = 0.5;
</script>

<T.Group position={[centerX, 0, centerZ]}>
  <!-- Main floor (polished dark wood) -->
  <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
    <T.PlaneGeometry args={[width, depth]} />
    <T.MeshStandardMaterial color={colorFloor} roughness={0.25} metalness={0.15} />
  </T.Mesh>

  {#if showCarpet}
    <!-- Red velvet carpet runner (center) -->
    <T.Mesh position={[0, carpetY, 0]} rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[carpetWidth, depth]} />
      <T.MeshStandardMaterial
        color={colorCarpet}
        roughness={0.95}
        metalness={0}
      />
    </T.Mesh>

    <!-- Carpet edge trim (gold) - left side -->
    <T.Mesh
      position={[-carpetWidth / 2, carpetY + 0.2, 0]}
      rotation.x={-Math.PI / 2}
      receiveShadow
    >
      <T.PlaneGeometry args={[4, depth]} />
      <T.MeshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.6} />
    </T.Mesh>

    <!-- Carpet edge trim (gold) - right side -->
    <T.Mesh
      position={[carpetWidth / 2, carpetY + 0.2, 0]}
      rotation.x={-Math.PI / 2}
      receiveShadow
    >
      <T.PlaneGeometry args={[4, depth]} />
      <T.MeshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.6} />
    </T.Mesh>
  {/if}
</T.Group>
