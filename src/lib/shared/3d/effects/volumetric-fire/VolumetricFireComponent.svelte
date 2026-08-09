<script lang="ts">
  /**
   * VolumetricFireComponent
   *
   * Real volumetric raymarched fire using ThreeVolumetricFire library.
   * Much more realistic than particle-based fire.
   */

  import { T, useTask, useThrelte } from "@threlte/core";
  import { useTexture } from "@threlte/extras";
  import { VolumetricFire } from "./ThreeVolumetricFire.js";
  import { Vector3 } from "three";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    /** Position in world space */
    position?: Vector3 | [number, number, number];
    /** Fire width */
    width?: number;
    /** Fire height */
    height?: number;
    /** Fire depth */
    depth?: number;
    /** Slice spacing (lower = higher quality, more expensive) */
    sliceSpacing?: number;
    /** Scale multiplier for the whole fire */
    scale?: number;
  }

  let {
    position = new Vector3(0, 0, 0),
    width = 1.0,
    height = 2.0,
    depth = 1.0,
    sliceSpacing = 0.1,
    scale = 1.0,
  }: Props = $props();

  const { camera } = useThrelte();

  // Load textures
  const noiseTexture = useTexture("/textures/fire/nzw.png");
  const profileTexture = useTexture("/textures/fire/firetex.png");

  let fire: VolumetricFire | null = $state(null);
  let elapsedTime = 0;

  // Convert position to Vector3 if array
  const posVec = $derived(
    Array.isArray(position) ? new Vector3(...position) : position
  );

  // Create fire when textures are ready
  $effect(() => {
    const noise = $noiseTexture;
    const profile = $profileTexture;
    const cam = camera.current;

    if (noise && profile && cam && !fire) {
      try {
        // SliceSpacing must be scaled with size to prevent vertex buffer overflow
        // Larger fires need larger spacing between slices
        const scaledSliceSpacing = sliceSpacing * scale;

        fire = new VolumetricFire({
          camera: cam,
          textureNoise: noise,
          textureProfile: profile,
          width: width * scale,
          height: height * scale,
          depth: depth * scale,
          sliceSpacing: scaledSliceSpacing,
          segments: 16, // Reduced from 24 for better performance
        });
      } catch {
        // Fire effect creation failed - likely missing textures
      }
    }
  });

  // Update fire each frame
  useTask((delta) => {
    if (fire) {
      elapsedTime += delta;
      fire.position.copy(posVec);
      fire.update(elapsedTime);
    }
  });

  onDestroy(() => {
    if (fire) {
      fire.geometry.dispose();
      if (fire.material && "dispose" in fire.material) {
        (fire.material as { dispose: () => void }).dispose();
      }
    }
  });
</script>

{#if fire}
  <T is={fire} />
{/if}
