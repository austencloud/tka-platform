<script lang="ts">
  /**
   * WingFloor
   *
   * Premium rectangular floor with:
   * - Polished wood base
   * - Rich red velvet carpet runner down the center
   *
   * Designed for exhibition wing galleries.
   */

  import { T } from "@threlte/core";
  import { DoubleSide } from "three";
  import { WOOD_FLOOR, CARPET_RED } from "../../../domain/constants/gallery-materials";
  import { CARPET_WIDTH_RATIO } from "../../../domain/constants/gallery-dimensions";

  interface Props {
    /** Center position of the floor */
    position: { x: number; z: number };
    /** Width of the floor (X axis) */
    width: number;
    /** Depth of the floor (Z axis) */
    depth: number;
    /** Rotation around Y axis (radians) */
    rotation?: number;
    /** Whether to show carpet runner */
    showCarpet?: boolean;
  }

  let {
    position,
    width,
    depth,
    rotation = 0,
    showCarpet = true,
  }: Props = $props();

  // Carpet dimensions
  const carpetWidth = width * CARPET_WIDTH_RATIO;

  // Slight y offsets to prevent z-fighting
  const Y_BASE = 0;
  const Y_CARPET = 0.5;
</script>

<T.Group position={[position.x, 0, position.z]} rotation.y={rotation}>
  <!-- Wood floor base -->
  <T.Mesh position={[0, Y_BASE, 0]} rotation.x={-Math.PI / 2} receiveShadow>
    <T.PlaneGeometry args={[width, depth]} />
    <T.MeshStandardMaterial
      color={WOOD_FLOOR.color}
      roughness={WOOD_FLOOR.roughness}
      metalness={WOOD_FLOOR.metalness}
      side={DoubleSide}
    />
  </T.Mesh>

  <!-- Carpet runner -->
  {#if showCarpet}
    <T.Mesh position={[0, Y_CARPET, 0]} rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[carpetWidth, depth]} />
      <T.MeshStandardMaterial
        color={CARPET_RED.color}
        roughness={CARPET_RED.roughness}
        metalness={CARPET_RED.metalness}
        side={DoubleSide}
      />
    </T.Mesh>
  {/if}
</T.Group>
