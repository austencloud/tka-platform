<!-- src/lib/shared/shape-matrix/components/MandalaHeroLayer.svelte
  Static engine-aligned mandala canvas. Fills its parent (which must be the
  SAME square AnimatorCanvas renders into — that shared frame is the whole
  alignment contract). Opacity animates via CSS so the still-mandala → ghost
  transition never re-rasterizes. -->
<script lang="ts">
  import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { drawAlignedMandala } from "../services/mandala-hero";

  let {
    paths,
    clubTipDx,
    opacity = 1,
    glowColor,
  }: {
    paths: MandalaPaths;
    clubTipDx: number;
    opacity?: number;
    glowColor?: string;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let box = $state<HTMLDivElement | null>(null);
  const transitionDuration = motionDuration(DURATION.normal);

  $effect(() => {
    const el = canvas,
      host = box;
    const p = paths; // reactive dep: redraw when the cell changes
    if (!el || !host) return;
    const draw = () => {
      const sizeCss = Math.min(host.clientWidth, host.clientHeight);
      const dpr = window.devicePixelRatio || 1;
      const sizePx = Math.max(1, Math.round(sizeCss * dpr));
      el.width = sizePx;
      el.height = sizePx;
      el.style.width = `${sizeCss}px`;
      el.style.height = `${sizeCss}px`;
      const ctx = el.getContext("2d");
      if (ctx) {
        const startedAt = import.meta.env.DEV ? performance.now() : 0;
        ctx.clearRect(0, 0, sizePx, sizePx);
        drawAlignedMandala(ctx, p, sizePx, { clubTipDx });
        if (import.meta.env.DEV) {
          performance.measure(`shape-matrix:hero-draw:${sizePx}`, {
            start: startedAt,
            end: performance.now(),
          });
        }
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    return () => ro.disconnect();
  });
</script>

<div
  class="mandala-layer"
  bind:this={box}
  style={`opacity: ${opacity}; --mandala-duration: ${transitionDuration}ms; --mandala-glow: ${glowColor ?? "var(--theme-accent, #f59e0b)"}`}
  aria-hidden="true"
>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .mandala-layer {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    filter: drop-shadow(
      0 0 0.3rem
        color-mix(in srgb, var(--mandala-glow) 34%, transparent)
    );
    transition: opacity var(--mandala-duration) var(--transition-easing, ease);
  }
  @media (prefers-reduced-motion: reduce) {
    .mandala-layer {
      transition: none;
    }
  }
</style>
