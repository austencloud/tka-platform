<!-- src/lib/shared/shape-matrix/components/MandalaHeroLayer.svelte
  Engine-aligned still mandala floor. Fills its parent (which must be the
  SAME square AnimatorCanvas renders into — that shared frame is the whole
  alignment contract) and renders the shared ShapeMatrixMandalaArt primitive
  scaled by alignScale, so the floor IS the matrix tile the user picked.
  Opacity animates via CSS so the still-mandala → ghost transition never
  re-rasterizes. During a shared-element handoff the floor is forced fully
  visible with no transition so the transition snapshot has artwork in it. -->
<script lang="ts">
  import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { alignScale } from "../services/mandala-hero";
  import { pathsArtworkSrc } from "../services/shape-matrix-artwork";
  import ShapeMatrixMandalaArt from "./ShapeMatrixMandalaArt.svelte";

  let {
    paths,
    clubTipDx,
    opacity = 1,
    glowColor,
    claim = false,
    handoff = false,
  }: {
    paths: MandalaPaths;
    clubTipDx: number;
    opacity?: number;
    glowColor?: string;
    /** This floor owns the shared tile↔hero transition name right now. */
    claim?: boolean;
    /** A shared-element transition is capturing: show the artwork, instantly. */
    handoff?: boolean;
  } = $props();

  let box = $state<HTMLDivElement | null>(null);
  let side = $state(0);
  const transitionDuration = motionDuration(DURATION.normal);
  const src = $derived(pathsArtworkSrc(paths, clubTipDx));
  const scale = $derived(alignScale(clubTipDx));
  const effectiveOpacity = $derived(handoff ? 1 : opacity);

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
    <ShapeMatrixMandalaArt
      {src}
      {scale}
      {claim}
      instant={handoff}
      glowColor={glowColor ?? "var(--theme-accent, #f59e0b)"}
    />
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
