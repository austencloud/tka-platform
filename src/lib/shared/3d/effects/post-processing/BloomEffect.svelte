<script lang="ts">
  /**
   * BloomEffect Component
   *
   * Adds bloom/glow post-processing effect to the 3D scene.
   * Must be used as a child of EffectComposer from threlte-postprocessing.
   *
   * Bloom makes bright objects glow by detecting pixels above a luminance
   * threshold and applying a blur that bleeds outward.
   */

  import { BloomEffect as BloomFX } from "threlte-postprocessing/effects";

  interface Props {
    /** Enable/disable the bloom effect */
    enabled?: boolean;
    /** Bloom intensity multiplier (0 = no bloom, higher = stronger glow) */
    intensity?: number;
    /** Luminance threshold - only pixels brighter than this glow (0-1) */
    luminanceThreshold?: number;
    /** Smoothing for the luminance threshold transition */
    luminanceSmoothing?: number;
    /** Blur radius - how far the glow spreads */
    radius?: number;
    /** Number of mipmap levels for blur quality */
    levels?: number;
  }

  let {
    enabled = true,
    intensity = 1.5,
    luminanceThreshold = 0.8,
    luminanceSmoothing = 0.3,
    radius = 0.4,
    levels = 8,
  }: Props = $props();
</script>

{#if enabled}
  <BloomFX
    {intensity}
    {luminanceThreshold}
    {luminanceSmoothing}
    {radius}
    {levels}
    mipmapBlur={true}
  />
{/if}
