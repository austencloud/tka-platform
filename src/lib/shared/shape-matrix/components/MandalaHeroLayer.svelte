<!-- src/lib/shared/shape-matrix/components/MandalaHeroLayer.svelte
  Engine-aligned still mandala floor. Fills its parent (which must be the
  SAME square AnimatorCanvas renders into — that shared frame is the whole
  alignment contract) and renders the shared ShapeMatrixMandalaArt primitive
  painted at engine alignment by the animator's own guide painter, so the
  floor is pixel-for-pixel the guide the live canvas will draw over it.
  Opacity animates via CSS so the still-mandala → live-guide transition never
  re-rasterizes. During a shared-element handoff the floor is forced fully
  visible with no transition so the transition snapshot has artwork in it. -->
<script lang="ts">
  import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { pathsArtworkSrc } from "../services/shape-matrix-artwork";
  import ShapeMatrixMandalaArt from "./ShapeMatrixMandalaArt.svelte";

  let {
    paths,
    artKey,
    opacity = 1,
    claim = false,
    handoff = false,
  }: {
    paths: MandalaPaths;
    /** Identity of the pair these paths belong to; a change crossfades. */
    artKey: string;
    opacity?: number;
    /** This floor owns the shared tile↔hero transition name right now. */
    claim?: boolean;
    /** A shared-element transition is capturing: show the artwork, instantly. */
    handoff?: boolean;
  } = $props();

  let box = $state<HTMLDivElement | null>(null);
  let side = $state(0);
  const transitionDuration = motionDuration(DURATION.normal);
  const effectiveOpacity = $derived(handoff ? 1 : opacity);
  const paint = $derived((sizePx: number) => pathsArtworkSrc(paths, sizePx));

  $effect(() => {
    const host = box;
    if (!host) return;
    const measure = () => {
      side = Math.min(host.clientWidth, host.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  });
</script>

<div
  class="mandala-layer"
  class:handoff
  bind:this={box}
  style={`opacity: ${effectiveOpacity}; --mandala-duration: ${transitionDuration}ms; --mandala-side: ${side}px`}
  aria-hidden="true"
>
  <div class="mandala-square">
    <ShapeMatrixMandalaArt {paint} {artKey} {claim} instant={handoff} />
  </div>
</div>

<style>
  .mandala-layer {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    transition: opacity var(--mandala-duration) var(--transition-easing, ease);
  }
  /* The snapshot for a shared-element transition is taken the frame the
     floor is asked to show; a fade-in would capture a half-transparent tile. */
  .mandala-layer.handoff {
    transition: none;
  }
  .mandala-square {
    width: var(--mandala-side);
    height: var(--mandala-side);
    overflow: visible;
  }
  @media (prefers-reduced-motion: reduce) {
    .mandala-layer {
      transition: none;
    }
  }
</style>
