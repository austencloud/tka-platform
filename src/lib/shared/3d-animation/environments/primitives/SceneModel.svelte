<script lang="ts">
  /**
   * SceneModel Primitive
   *
   * Loads and displays a GLTF/GLB model in the scene.
   * Wrapper around useGltf with positioning and scaling.
   */

  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";

  interface Props {
    /** Path to the GLTF/GLB file (relative to static/) */
    src: string;
    /** Position in 3D space */
    position?: [number, number, number];
    /** Uniform scale or [x, y, z] scale */
    scale?: number | [number, number, number];
    /** Rotation in radians [x, y, z] */
    rotation?: [number, number, number];
    /** Whether to cast shadows */
    castShadow?: boolean;
    /** Whether to receive shadows */
    receiveShadow?: boolean;
  }

  let {
    src,
    position = [0, 0, 0],
    scale = 1,
    rotation = [0, 0, 0],
    castShadow = false,
    receiveShadow = false,
  }: Props = $props();

  // Load the model - reactive to src changes
  const gltf = $derived(useGltf(src));

  // Normalize scale to array
  const scaleArray = $derived(
    typeof scale === "number" ? [scale, scale, scale] : scale
  );
</script>

{#if $gltf}
  <T
    is={$gltf.scene}
    position.x={position[0]}
    position.y={position[1]}
    position.z={position[2]}
    scale.x={scaleArray[0]}
    scale.y={scaleArray[1]}
    scale.z={scaleArray[2]}
    rotation.x={rotation[0]}
    rotation.y={rotation[1]}
    rotation.z={rotation[2]}
    {castShadow}
    {receiveShadow}
  />
{/if}
