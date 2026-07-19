<!-- src/lib/shared/shape-matrix/components/MandalaHeroLayer.svelte
  Static engine-aligned mandala canvas. Fills its parent (which must be the
  SAME square AnimatorCanvas renders into — that shared frame is the whole
  alignment contract). Opacity animates via CSS so the still-mandala → ghost
  transition never re-rasterizes. -->
<script lang="ts">
  import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
  import { drawAlignedMandala } from "../services/mandala-hero";

  let { paths, clubTipDx, opacity = 1 }: {
    paths: MandalaPaths; clubTipDx: number; opacity?: number;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let box = $state<HTMLDivElement | null>(null);

  $effect(() => {
    const el = canvas, host = box;
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
        ctx.clearRect(0, 0, sizePx, sizePx);
        drawAlignedMandala(ctx, p, sizePx, { clubTipDx });
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    return () => ro.disconnect();
  });
</script>

<div class="mandala-layer" bind:this={box} style="opacity: {opacity}" aria-hidden="true">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .mandala-layer {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    transition: opacity 400ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .mandala-layer { transition: none; }
  }
</style>
