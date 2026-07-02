<!--
  SequencePeek — a fixed-dimension, optionally tilted box showing a real
  sequence thumbnail. The box is reserved space (no layout shift when the
  thumbnail streams in) and the tilt is a fixed per-slot angle, never random.
  Pass `sequence={undefined}` to render just the reserved box (pool still
  loading). The optional `overlay` snippet rotates with the box — used for the
  per-level DifficultyBadge on the chooser's level fan.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    sequence?: SequenceData;
    /** Reserved box width, px. */
    width: number;
    /** Reserved box height, px. */
    height: number;
    /** Fixed tilt in degrees (deterministic per slot). */
    tilt?: number;
    overlay?: Snippet;
  }
  let { sequence, width, height, tilt = 0, overlay }: Props = $props();
</script>

<div
  class="peek"
  style:width="{width}px"
  style:height="{height}px"
  style:--tilt="{tilt}deg"
>
  {#if sequence}
    <!-- Peeks are tiny — a baked-in QR is unscannable noise at this size, so
         disallow it. No explicit visibility override: peeks share the gallery
         grid's default cache class (static/cloud hits) instead of forcing a
         custom-keyed local render per peek. -->
    <PropAwareThumbnail {sequence} eager allowQR={false} />
  {/if}
  {#if overlay}
    <span class="overlay">{@render overlay()}</span>
  {/if}
</div>

<style>
  .peek {
    position: relative;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    transform: rotate(var(--tilt, 0deg));
  }
  .overlay {
    position: absolute;
    top: 3px;
    left: 3px;
    line-height: 0;
  }
</style>
