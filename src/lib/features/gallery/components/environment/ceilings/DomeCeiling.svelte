<script lang="ts">
  /**
   * DomeCeiling
   *
   * Premium domed ceiling for rotunda spaces with:
   * - Hemisphere dome geometry
   * - Concentric decorative rings
   * - Gold trim details
   *
   * Inspired by the domes of grand museums and cathedrals.
   */

  import { T } from "@threlte/core";
  import { BackSide } from "three";
  import { CEILING_MAIN, GOLD_TRIM } from "../../../domain/constants/gallery-materials";
  import { WALL_HEIGHT } from "../../../domain/constants/gallery-dimensions";

  interface Props {
    /** Center position of the dome */
    position: { x: number; z: number };
    /** Radius of the dome base */
    radius: number;
    /** Base height where dome starts (typically wall height) */
    baseHeight?: number;
    /** Height of the dome above the base */
    domeHeight?: number;
    /** Number of horizontal segments for smoothness */
    segments?: number;
  }

  let {
    position,
    radius,
    baseHeight = WALL_HEIGHT,
    domeHeight,
    segments = 32,
  }: Props = $props();

  // Calculate dome height if not provided (proportional to radius)
  const actualDomeHeight = domeHeight ?? radius * 0.5;

  // Decorative ring positions (as fraction of dome height)
  const ringPositions = [0.2, 0.4, 0.6, 0.8];
  const ringThickness = 8;
</script>

<T.Group position={[position.x, baseHeight, position.z]}>
  <!-- Main dome (hemisphere) -->
  <T.Mesh>
    <T.SphereGeometry
      args={[
        radius,
        segments,
        segments / 2,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ]}
    />
    <T.MeshStandardMaterial
      color={CEILING_MAIN.color}
      roughness={CEILING_MAIN.roughness}
      metalness={CEILING_MAIN.metalness}
      side={BackSide}
    />
  </T.Mesh>

  <!-- Decorative gold rings around the dome -->
  {#each ringPositions as heightRatio, i (i)}
    {@const ringY = actualDomeHeight * heightRatio}
    {@const ringRadius = radius * Math.cos(Math.asin(heightRatio))}
    <T.Mesh position={[0, ringY, 0]}>
      <T.TorusGeometry args={[ringRadius, ringThickness, 8, segments]} />
      <T.MeshStandardMaterial
        color={GOLD_TRIM.color}
        roughness={GOLD_TRIM.roughness}
        metalness={GOLD_TRIM.metalness}
      />
    </T.Mesh>
  {/each}

  <!-- Central oculus decoration (top of dome) -->
  <T.Mesh position={[0, actualDomeHeight - 20, 0]} rotation.x={Math.PI / 2}>
    <T.CircleGeometry args={[radius * 0.15, 24]} />
    <T.MeshStandardMaterial
      color={GOLD_TRIM.color}
      roughness={GOLD_TRIM.roughness}
      metalness={GOLD_TRIM.metalness}
    />
  </T.Mesh>
</T.Group>
