<script lang="ts">
  /**
   * GalleryCeiling
   *
   * Ceiling plane for the gallery (optional - can be omitted for open-air feel).
   */

  import { T } from "@threlte/core";
  import { WALL_HEIGHT } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Ceiling width (X axis) */
    width: number;
    /** Ceiling depth (Z axis) */
    depth: number;
    /** Ceiling color */
    color?: string;
    /** Whether to show the ceiling */
    visible?: boolean;
  }

  let {
    width,
    depth,
    color = "#4a3c38", // Warm ceiling - visible!
    visible = true,
  }: Props = $props();

  const centerX = 0;
  const centerZ = $derived(depth / 2);
</script>

{#if visible}
  <T.Group position={[centerX, WALL_HEIGHT, centerZ]}>
    <T.Mesh rotation.x={Math.PI / 2}>
      <T.PlaneGeometry args={[width, depth]} />
      <T.MeshStandardMaterial {color} roughness={0.9} metalness={0} side={2} />
    </T.Mesh>
  </T.Group>
{/if}
