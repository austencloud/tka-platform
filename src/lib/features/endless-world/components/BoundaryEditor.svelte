<script lang="ts">
  /**
   * BoundaryEditor
   *
   * Interactive tool for defining campground boundaries by clicking
   * on the terrain to place fence posts. Creates a polygon that can
   * be saved and used for cropping.
   */

  import { T, useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import type { TerrainConfig, GeoBounds } from "../terrain/terrain-types";

  interface BoundaryPoint {
    /** World coordinates */
    world: THREE.Vector3;
    /** Normalized UV coordinates (0-1) relative to terrain */
    uv: { u: number; v: number };
  }

  interface Props {
    /** Whether boundary editing mode is active */
    active?: boolean;
    /** Terrain configuration for coordinate conversion */
    terrainConfig: TerrainConfig;
    /** Terrain position offset */
    terrainOffset?: [number, number, number];
    /** Geographic bounds for coordinate conversion */
    geoBounds?: GeoBounds;
    /** Callback when boundary changes */
    onboundarychange?: (points: BoundaryPoint[]) => void;
    /** Initial boundary points */
    initialPoints?: BoundaryPoint[];
  }

  let {
    active = false,
    terrainConfig,
    terrainOffset = [0, 0, 0],
    geoBounds,
    onboundarychange,
    initialPoints = [],
  }: Props = $props();

  const { scene, camera, renderer } = useThrelte();

  // Boundary points state
  let boundaryPoints = $state<BoundaryPoint[]>(initialPoints);
  let isPolygonClosed = $state(false);

  // Raycaster for terrain intersection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Find terrain mesh for raycasting
  function findTerrainMesh(): THREE.Mesh | null {
    let terrainMesh: THREE.Mesh | null = null;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
        // Find the largest plane (terrain, not ground plane)
        if (!terrainMesh || obj.geometry.parameters.width > 100) {
          terrainMesh = obj;
        }
      }
    });
    return terrainMesh;
  }

  function handleClick(event: MouseEvent) {
    if (!active || isPolygonClosed) return;

    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    // Convert to normalized device coordinates
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera.current);

    const terrainMesh = findTerrainMesh();
    if (!terrainMesh) return;

    const intersects = raycaster.intersectObject(terrainMesh);
    const firstIntersect = intersects[0];
    if (firstIntersect) {
      const point = firstIntersect.point.clone();

      // Convert world position to UV coordinates relative to terrain
      const u = (point.x - terrainOffset[0]) / terrainConfig.width + 0.5;
      const v = (point.z - terrainOffset[2]) / terrainConfig.depth + 0.5;

      const newPoint: BoundaryPoint = {
        world: point,
        uv: { u, v },
      };

      boundaryPoints = [...boundaryPoints, newPoint];
      onboundarychange?.(boundaryPoints);
    }
  }

  function closeBoundary() {
    if (boundaryPoints.length >= 3) {
      isPolygonClosed = true;
      onboundarychange?.(boundaryPoints);
    }
  }

  function clearBoundary() {
    boundaryPoints = [];
    isPolygonClosed = false;
    onboundarychange?.([]);
  }

  function undoLastPoint() {
    if (boundaryPoints.length > 0) {
      boundaryPoints = boundaryPoints.slice(0, -1);
      onboundarychange?.(boundaryPoints);
    }
  }

  // Convert UV to geo coordinates if bounds available
  function uvToGeo(uv: { u: number; v: number }) {
    if (!geoBounds) return null;
    const lat = geoBounds.nw.lat + (geoBounds.se.lat - geoBounds.nw.lat) * uv.v;
    const lng = geoBounds.nw.lng + (geoBounds.se.lng - geoBounds.nw.lng) * uv.u;
    return { lat, lng };
  }

  // Export boundary data
  function exportBoundary() {
    const data = {
      points: boundaryPoints.map((p) => ({
        uv: p.uv,
        geo: uvToGeo(p.uv),
        world: { x: p.world.x, y: p.world.y, z: p.world.z },
      })),
      closed: isPolygonClosed,
      terrainConfig: {
        width: terrainConfig.width,
        depth: terrainConfig.depth,
      },
      geoBounds,
    };
    return data;
  }

  // Expose functions via binding
  export { closeBoundary, clearBoundary, undoLastPoint, exportBoundary, boundaryPoints, isPolygonClosed };

  // Create line geometry connecting points
  const lineGeometry = $derived.by(() => {
    if (boundaryPoints.length < 2) return null;

    const points = boundaryPoints.map((p) => p.world);
    const firstPoint = points[0];
    if (isPolygonClosed && points.length >= 3 && firstPoint) {
      points.push(firstPoint); // Close the loop
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  });

  // Set up click listener when active
  $effect(() => {
    if (!active) return;

    const canvas = renderer.domElement;
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("click", handleClick);
    };
  });
</script>

<!-- Boundary markers (fence posts) -->
{#each boundaryPoints as point, i}
  <T.Mesh position={[point.world.x, point.world.y + 5, point.world.z]}>
    <T.SphereGeometry args={[3, 16, 16]} />
    <T.MeshStandardMaterial
      color={i === 0 ? "#22c55e" : isPolygonClosed ? "#f97316" : "#facc15"}
      emissive={i === 0 ? "#22c55e" : isPolygonClosed ? "#f97316" : "#facc15"}
      emissiveIntensity={0.3}
    />
  </T.Mesh>
  <!-- Vertical pole -->
  <T.Mesh position={[point.world.x, point.world.y + 2.5, point.world.z]}>
    <T.CylinderGeometry args={[0.5, 0.5, 5, 8]} />
    <T.MeshStandardMaterial color="#8b4513" />
  </T.Mesh>
  <!-- Point number label would go here if we had text rendering -->
{/each}

<!-- Boundary lines -->
{#if lineGeometry}
  <T.Line geometry={lineGeometry}>
    <T.LineBasicMaterial
      color={isPolygonClosed ? "#f97316" : "#facc15"}
      linewidth={2}
    />
  </T.Line>
{/if}
