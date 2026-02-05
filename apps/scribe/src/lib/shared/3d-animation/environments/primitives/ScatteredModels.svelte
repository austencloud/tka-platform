<script lang="ts">
  /**
   * ScatteredModels Primitive
   *
   * Scatters multiple instances of a GLTF model around a scene.
   * Uses instancing for performance when available.
   * Ground Y is derived from user proportions by default.
   */

  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { useMemo } from "$lib/shared/3d-animation/utils/use-memo.svelte";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";

  interface PlacementConfig {
    /** Position [x, y, z] */
    position: [number, number, number];
    /** Scale (uniform or [x, y, z]) */
    scale: number | [number, number, number];
    /** Y-axis rotation in radians */
    rotation: number;
  }

  interface Props {
    /** Path to the GLTF/GLB file */
    src: string;
    /** Number of instances to scatter */
    count?: number;
    /** Area to scatter within {width, depth} centered at origin */
    area?: { width: number; depth: number };
    /** Override Y position (uses user proportions if not provided) */
    overrideGroundY?: number;
    /** Scale range [min, max] */
    scaleRange?: [number, number];
    /** Minimum distance from center (to avoid avatar) */
    minDistanceFromCenter?: number;
    /** Random seed for reproducible placement */
    seed?: number;
  }

  // Default values in meters (1 unit = 1 meter)
  let {
    src,
    count = 10,
    area = { width: 2, depth: 2 }, // 2m x 2m area
    overrideGroundY,
    scaleRange = [0.04, 0.075], // ~4-7.5cm scale
    minDistanceFromCenter = 0.4, // 40cm from center
    seed = 12345,
  }: Props = $props();

  // Use dynamic ground Y from user proportions, or override if provided
  const groundY = $derived(overrideGroundY ?? userProportionsState.groundY);

  // Load the model - reactive to src changes
  const gltf = $derived(useGltf(src));

  // Seeded random number generator for reproducible results
  function seededRandom(s: number): () => number {
    return () => {
      s = Math.sin(s * 9999) * 10000;
      return s - Math.floor(s);
    };
  }

  // Generate placement configurations
  const placements = useMemo<PlacementConfig[]>(() => {
    const rand = seededRandom(seed);
    const configs: PlacementConfig[] = [];

    for (let i = 0; i < count; i++) {
      // Random position within area
      let x = (rand() - 0.5) * area.width;
      let z = (rand() - 0.5) * area.depth;

      // Ensure minimum distance from center
      const dist = Math.sqrt(x * x + z * z);
      if (dist < minDistanceFromCenter) {
        const angle = Math.atan2(z, x);
        x = Math.cos(angle) * minDistanceFromCenter;
        z = Math.sin(angle) * minDistanceFromCenter;
      }

      // Random scale and rotation
      const scale = scaleRange[0] + rand() * (scaleRange[1] - scaleRange[0]);
      const rotation = rand() * Math.PI * 2;

      configs.push({
        position: [x, groundY, z],
        scale,
        rotation,
      });
    }

    return configs;
  });
</script>

{#if $gltf}
  {#each placements as placement, i (i)}
    <T
      is={$gltf.scene.clone()}
      position.x={placement.position[0]}
      position.y={placement.position[1]}
      position.z={placement.position[2]}
      scale={typeof placement.scale === "number"
        ? placement.scale
        : placement.scale[0]}
      rotation.y={placement.rotation}
    />
  {/each}
{/if}
