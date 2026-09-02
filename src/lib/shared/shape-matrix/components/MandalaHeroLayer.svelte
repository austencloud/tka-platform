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

  const transitionDuration = motionDuration(DURATION.normal);
  const effectiveOpacity = $derived(handoff ? 1 : opacity);
  const paint = $derived((sizePx: number) => pathsArtworkSrc(paths, sizePx));
</script>

<!-- The square's box comes from container units, not a measurement, so it is
     correct in the same layout pass that sizes the frame. A shared-element
     transition captures the frame the view flips; a JS-measured side would
     still read 0 from the collapsed pane at that moment. -->
<div
  class="mandala-layer"
  class:handoff
  style={`opacity: ${effectiveOpacity}; --mandala-duration: ${transitionDuration}ms`}
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
    container-type: size;
    pointer-events: none;
    transition: opacity var(--mandala-duration) var(--transition-easing, ease);
  }
  /* The snapshot for a shared-element transition is taken the frame the
     floor is asked to show; a fade-in would capture a half-transparent tile. */
  .mandala-layer.handoff {
    transition: none;
  }
  .mandala-square {
    width: min(100cqw, 100cqh);
    height: min(100cqw, 100cqh);
    overflow: visible;
  }
  @media (prefers-reduced-motion: reduce) {
    .mandala-layer {
      transition: none;
    }
  }
</style>
