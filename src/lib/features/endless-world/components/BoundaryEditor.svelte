<script lang="ts">
  /**
   * BoundaryEditor
   *
   * Renders 3D boundary markers (fence posts) and connecting lines.
   * Click handling is done at the module level since raycasting inside
   * the Threlte Canvas wasn't receiving events properly.
   */

  import { T } from "@threlte/core";
  import * as THREE from "three";

  interface BoundaryPoint {
    /** World coordinates */
    world: { x: number; y: number; z: number };
    /** Normalized UV coordinates (0-1) relative to terrain */
    uv: { u: number; v: number };
  }

  interface Props {
    /** Boundary points to render */
    points?: BoundaryPoint[];
    /** Whether the polygon is closed */
    closed?: boolean;
  }

  let {
    points = [],
    closed = false,
  }: Props = $props();

  // Create line geometry connecting points
  const lineGeometry = $derived.by(() => {
    if (points.length < 2) return null;

    const vectors = points.map((p) => new THREE.Vector3(p.world.x, p.world.y + 3, p.world.z));
    const firstVector = vectors[0];
    if (closed && vectors.length >= 3 && firstVector) {
      vectors.push(firstVector.clone()); // Close the loop
    }

    const geo = new THREE.BufferGeometry().setFromPoints(vectors);
    return geo;
  });
</script>

<!-- Boundary markers (fence posts) -->
{#each points as point, i}
  <!-- Marker sphere -->
  <T.Mesh position={[point.world.x, point.world.y + 8, point.world.z]}>
    <T.SphereGeometry args={[4, 16, 16]} />
    <T.MeshStandardMaterial
      color={i === 0 ? "#22c55e" : closed ? "#f97316" : "#facc15"}
      emissive={i === 0 ? "#22c55e" : closed ? "#f97316" : "#facc15"}
      emissiveIntensity={0.5}
    />
  </T.Mesh>
  <!-- Vertical pole -->
  <T.Mesh position={[point.world.x, point.world.y + 4, point.world.z]}>
    <T.CylinderGeometry args={[1, 1, 8, 8]} />
    <T.MeshStandardMaterial color="#8b4513" />
  </T.Mesh>
{/each}

<!-- Boundary lines -->
{#if lineGeometry}
  <T.Line geometry={lineGeometry}>
    <T.LineBasicMaterial
      color={closed ? "#f97316" : "#facc15"}
      linewidth={3}
    />
  </T.Line>
{/if}
