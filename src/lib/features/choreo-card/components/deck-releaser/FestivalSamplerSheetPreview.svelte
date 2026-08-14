<script lang="ts">
  import { onMount } from "svelte";
  import type { FestivalSamplerPair } from "../../services/festival-sampler-renderer";
  import {
    drawFestivalSamplerSheetPreview,
    type FestivalSamplerSheetSide,
  } from "../../services/festival-sampler-sheet-preview";

  interface Props {
    pairs: readonly FestivalSamplerPair[];
    side: FestivalSamplerSheetSide;
    packNumber: number;
  }

  let { pairs, side, packNumber }: Props = $props();
  let canvas: HTMLCanvasElement;
  let isNearViewport = $state(false);

  $effect(() => {
    if (!canvas) return;

    if (!isNearViewport) {
      // Sixty packs means 120 sheets. Releasing distant backing stores keeps
      // scrolling light without changing the size or position of any row.
      canvas.width = 1;
      canvas.height = 1;
      return;
    }

    drawFestivalSamplerSheetPreview(canvas, pairs, side);
  });

  onMount(() => {
    if (!("IntersectionObserver" in window)) {
      isNearViewport = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isNearViewport = entry?.isIntersecting ?? false;
      },
      { rootMargin: "900px 0px" }
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  });
</script>

<canvas
  bind:this={canvas}
  class:rendered={isNearViewport}
  aria-label={`Pack ${packNumber} ${side} sheet`}
>
  Pack {packNumber}
  {side} sheet
</canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 8.5 / 11;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    box-shadow: 0 18px 52px rgba(0, 0, 0, 0.36);
    contain: layout paint;
  }

  canvas.rendered {
    background: #ffffff;
  }
</style>
