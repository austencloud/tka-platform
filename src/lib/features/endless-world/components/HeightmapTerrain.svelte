<script lang="ts">
  /**
   * HeightmapTerrain
   *
   * Renders terrain from heightmap data as a displaced PlaneGeometry.
   * Uses vertex displacement to create elevation based on heightmap values.
   * Optionally accepts satellite imagery texture for realistic rendering.
   */

  import { T } from "@threlte/core";
  import * as THREE from "three";
  import type { HeightmapData, TerrainConfig } from "../terrain/terrain-types";

  interface Props {
    /** Heightmap elevation data */
    heightmap: HeightmapData;
    /** Terrain configuration (size, segments) */
    config: TerrainConfig;
    /** Vertical exaggeration factor (1 = real scale) */
    verticalExaggeration?: number;
    /** Whether to show wireframe */
    wireframe?: boolean;
    /** Base color for the terrain (used when no texture) */
    color?: string;
    /** Position offset */
    position?: [number, number, number];
    /** Optional satellite texture canvas */
    satelliteTexture?: HTMLCanvasElement | null;
  }

  let {
    heightmap,
    config,
    verticalExaggeration = 1,
    wireframe = false,
    color = "#4a7c4e",
    position = [0, 0, 0],
    satelliteTexture = null,
  }: Props = $props();

  // Create geometry with displaced vertices
  const geometry = $derived.by(() => {
    const geo = new THREE.PlaneGeometry(
      config.width,
      config.depth,
      config.widthSegments,
      config.depthSegments
    );

    // Rotate to lay flat (XZ plane)
    geo.rotateX(-Math.PI / 2);

    // Displace vertices based on heightmap
    const positions = geo.attributes.position as THREE.BufferAttribute;
    if (!positions) return geo;

    const { heights, width: hmWidth, height: hmHeight, minElevation, maxElevation } = heightmap;
    const elevationRange = maxElevation - minElevation || 1;

    for (let i = 0; i < positions.count; i++) {
      // Get vertex position in local coords
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Convert to UV coordinates (0-1)
      const u = (x / config.width + 0.5);
      const v = (z / config.depth + 0.5);

      // Sample heightmap (bilinear interpolation)
      const hmX = u * (hmWidth - 1);
      const hmY = v * (hmHeight - 1);

      const height = sampleHeightmap(heights, hmWidth, hmHeight, hmX, hmY);

      // Normalize height to 0-maxHeight range and apply exaggeration
      const normalizedHeight = ((height - minElevation) / elevationRange) * config.maxHeight;
      positions.setY(i, normalizedHeight * verticalExaggeration);
    }

    // Update normals for proper lighting
    geo.computeVertexNormals();

    return geo;
  });

  // Bilinear sampling of heightmap
  function sampleHeightmap(
    heights: Float32Array,
    width: number,
    height: number,
    x: number,
    y: number
  ): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);

    const fx = x - x0;
    const fy = y - y0;

    const h00 = heights[y0 * width + x0] ?? 0;
    const h10 = heights[y0 * width + x1] ?? 0;
    const h01 = heights[y1 * width + x0] ?? 0;
    const h11 = heights[y1 * width + x1] ?? 0;

    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fy) + h1 * fy;
  }

  // Create texture from satellite canvas if available
  const texture = $derived.by(() => {
    if (!satelliteTexture) return null;
    const tex = new THREE.CanvasTexture(satelliteTexture);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    return tex;
  });

  // Create material - use satellite texture if available, otherwise solid color
  const material = $derived.by(() => {
    if (texture) {
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.85,
        metalness: 0.0,
        flatShading: false,
        wireframe,
        side: THREE.DoubleSide,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.9,
      metalness: 0.0,
      flatShading: false,
      wireframe,
      side: THREE.DoubleSide,
    });
  });
</script>

<T.Mesh {geometry} {material} position.x={position[0]} position.y={position[1]} position.z={position[2]} castShadow receiveShadow />
