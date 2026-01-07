<script lang="ts">
  /**
   * RotundaFloor
   *
   * Premium circular marble floor with:
   * - Polished cream marble base
   * - Dark center medallion
   * - Concentric gold decorative rings
   *
   * Designed to evoke grand museum rotundas like the Louvre.
   */

  import { T } from "@threlte/core";
  import { DoubleSide } from "three";
  import {
    MARBLE_FLOOR,
    MARBLE_DARK,
    FLOOR_RING_GOLD,
    ROTUNDA_RING_RATIOS,
    ROTUNDA_MEDALLION_RATIO,
  } from "../../../domain/constants/gallery-materials";

  interface Props {
    /** Center position of the floor */
    position: { x: number; z: number };
    /** Radius of the circular floor */
    radius: number;
    /** Number of segments for smoothness (32-64 recommended) */
    segments?: number;
  }

  let { position, radius, segments = 64 }: Props = $props();

  // Ring dimensions
  const ringWidth = 8;
  const medallionRadius = radius * ROTUNDA_MEDALLION_RATIO;
  const ringRadii = ROTUNDA_RING_RATIOS.map((ratio) => radius * ratio);

  // Slight y offsets to prevent z-fighting
  const Y_BASE = 0;
  const Y_MEDALLION = 0.5;
  const Y_RING = 0.3;
</script>

<!-- Main marble floor -->
<T.Mesh
  position={[position.x, Y_BASE, position.z]}
  rotation.x={-Math.PI / 2}
  receiveShadow
>
  <T.CircleGeometry args={[radius, segments]} />
  <T.MeshStandardMaterial
    color={MARBLE_FLOOR.color}
    roughness={MARBLE_FLOOR.roughness}
    metalness={MARBLE_FLOOR.metalness}
    side={DoubleSide}
  />
</T.Mesh>

<!-- Dark center medallion -->
<T.Mesh
  position={[position.x, Y_MEDALLION, position.z]}
  rotation.x={-Math.PI / 2}
  receiveShadow
>
  <T.CircleGeometry args={[medallionRadius, 32]} />
  <T.MeshStandardMaterial
    color={MARBLE_DARK.color}
    roughness={MARBLE_DARK.roughness}
    metalness={MARBLE_DARK.metalness}
    side={DoubleSide}
  />
</T.Mesh>

<!-- Decorative gold rings -->
{#each ringRadii as ringRadius, i (i)}
  <T.Mesh
    position={[position.x, Y_RING, position.z]}
    rotation.x={-Math.PI / 2}
    receiveShadow
  >
    <T.RingGeometry
      args={[ringRadius - ringWidth / 2, ringRadius + ringWidth / 2, segments]}
    />
    <T.MeshStandardMaterial
      color={FLOOR_RING_GOLD.color}
      roughness={FLOOR_RING_GOLD.roughness}
      metalness={FLOOR_RING_GOLD.metalness}
      side={DoubleSide}
    />
  </T.Mesh>
{/each}
