<script lang="ts">
  /**
   * CofferedCeiling
   *
   * Premium coffered ceiling with:
   * - Flat ceiling panel
   * - Grid of decorative beams
   *
   * Classic museum exhibition hall aesthetic.
   */

  import { T } from "@threlte/core";
  import { BackSide } from "three";
  import { CEILING_MAIN, CEILING_BEAM } from "../../../domain/constants/gallery-materials";
  import { WALL_HEIGHT } from "../../../domain/constants/gallery-dimensions";

  interface Props {
    /** Center position of the ceiling */
    position: { x: number; z: number };
    /** Width of the ceiling (X axis) */
    width: number;
    /** Depth of the ceiling (Z axis) */
    depth: number;
    /** Height of the ceiling from floor */
    height?: number;
    /** Rotation around Y axis (radians) */
    rotation?: number;
    /** Spacing between beams */
    beamSpacing?: number;
  }

  let {
    position,
    width,
    depth,
    height = WALL_HEIGHT,
    rotation = 0,
    beamSpacing = 400,
  }: Props = $props();

  // Beam dimensions
  const beamWidth = 20;
  const beamDepth = 30; // How far beam extends down from ceiling

  // Calculate beam positions
  const beamsX: number[] = [];
  const beamsZ: number[] = [];

  // Beams along X axis
  const numBeamsX = Math.floor(width / beamSpacing);
  const startX = -width / 2 + beamSpacing / 2;
  for (let i = 0; i <= numBeamsX; i++) {
    beamsX.push(startX + i * beamSpacing - beamSpacing / 2);
  }

  // Beams along Z axis
  const numBeamsZ = Math.floor(depth / beamSpacing);
  const startZ = -depth / 2 + beamSpacing / 2;
  for (let i = 0; i <= numBeamsZ; i++) {
    beamsZ.push(startZ + i * beamSpacing - beamSpacing / 2);
  }
</script>

<T.Group position={[position.x, height, position.z]} rotation.y={rotation}>
  <!-- Main ceiling panel -->
  <T.Mesh rotation.x={Math.PI / 2}>
    <T.PlaneGeometry args={[width, depth]} />
    <T.MeshStandardMaterial
      color={CEILING_MAIN.color}
      roughness={CEILING_MAIN.roughness}
      metalness={CEILING_MAIN.metalness}
      side={BackSide}
    />
  </T.Mesh>

  <!-- Beams running along X axis (parallel to width) -->
  {#each beamsZ as z, i (i)}
    <T.Mesh position={[0, -beamDepth / 2, z]}>
      <T.BoxGeometry args={[width, beamDepth, beamWidth]} />
      <T.MeshStandardMaterial
        color={CEILING_BEAM.color}
        roughness={CEILING_BEAM.roughness}
        metalness={CEILING_BEAM.metalness}
      />
    </T.Mesh>
  {/each}

  <!-- Beams running along Z axis (parallel to depth) -->
  {#each beamsX as x, i (i)}
    <T.Mesh position={[x, -beamDepth / 2, 0]}>
      <T.BoxGeometry args={[beamWidth, beamDepth, depth]} />
      <T.MeshStandardMaterial
        color={CEILING_BEAM.color}
        roughness={CEILING_BEAM.roughness}
        metalness={CEILING_BEAM.metalness}
      />
    </T.Mesh>
  {/each}
</T.Group>
