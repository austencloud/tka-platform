<!-- src/lib/shared/shape-matrix/components/ShapeMatrixMandalaArt.svelte
  The one Shape Matrix mandala artwork primitive. A matrix tile and the
  detail hero's cold floor are two instances of THIS component showing the
  same cached vector image (shape-matrix-artwork.ts); the hero instance
  scales it to the engine hand orbit so the animator's trail lands on top.

  `claim` stamps the shared `view-transition-name` through the name registry,
  so only the endpoint that currently owns the artwork carries it and the
  native shared-element transition can morph one instance into the other.

  It fills its parent (which must own a square box). Source changes crossfade
  in place through the shared Crossfade primitive. -->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { claimedViewTransitionName } from "$lib/shared/transitions/claimed-view-transition-name";
  import { DURATION, STAGGER } from "$lib/shared/transitions/transitions";
  import { SHAPE_MATRIX_ACTIVE_MANDALA_NAME } from "../services/shape-matrix-artwork";

  let {
    src,
    alt = "",
    scale = 1,
    glowColor = null,
    claim = false,
    instant = false,
  }: {
    src: string;
    alt?: string;
    /** Engine alignment factor for the hero; tiles stay at 1. */
    scale?: number;
    /** Soft glow behind the strokes; null renders the plain tile. */
    glowColor?: string | null;
    /** True on the ONE instance that owns the shared-element name right now. */
    claim?: boolean;
    /**
     * Show the current source with no crossfade. A shared-element transition
     * snapshots the element the frame it changes; a crossfade in progress
     * would put the OUTGOING image in that snapshot.
     */
    instant?: boolean;
  } = $props();
</script>

<div
  class="mandala-art"
  class:glow={glowColor !== null}
  style:--art-scale={scale}
  style:--art-glow={glowColor ?? undefined}
  use:claimedViewTransitionName={{
    name: SHAPE_MATRIX_ACTIVE_MANDALA_NAME,
    enabled: claim,
  }}
>
  {#if instant}
    <img class="instant" {src} {alt} draggable="false" />
  {:else}
    <Crossfade key={src} fill duration={DURATION.emphasis} delay={STAGGER.micro}>
      <img {src} {alt} draggable="false" />
    </Crossfade>
  {/if}
</div>

<style>
  .mandala-art {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .mandala-art.glow {
    filter: drop-shadow(
      0 0 0.3rem color-mix(in srgb, var(--art-glow) 34%, transparent)
    );
  }

  .mandala-art img.instant {
    position: absolute;
    inset: 0;
  }

  .mandala-art img {
    display: block;
    width: 100%;
    height: 100%;
    transform: scale(var(--art-scale, 1));
    transform-origin: 50% 50%;
    user-select: none;
    -webkit-user-drag: none;
  }
</style>
