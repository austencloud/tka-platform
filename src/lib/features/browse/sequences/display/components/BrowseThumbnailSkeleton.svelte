<!--
Gallery Thumbnail Skeleton - Loading State Component

State-of-the-art skeleton that matches the real browse gallery:
- Same responsive column breakpoints as BrowseGrid
- Cards are image-only (no metadata/actions) matching ChoreoCardThumbnail
- Varied aspect ratios mimicking real sequence length distribution
- Staggered shimmer for organic feel
- Fade-out transition for smooth handoff to real content
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  const { count = 12, pinchColumnOverride } = $props<{
    count?: number;
    pinchColumnOverride?: number;
  }>();

  let gridRef = $state<HTMLElement | undefined>(undefined);
  let containerWidth = $state(0);

  // Match BrowseGrid breakpoints exactly
  const columnCount = $derived.by(() => {
    if (pinchColumnOverride !== undefined) return pinchColumnOverride;
    if (containerWidth === 0) return 2;
    if (containerWidth >= 1600) return 5;
    if (containerWidth >= 1200) return 4;
    if (containerWidth >= 800) return 3;
    return 2;
  });

  // Realistic aspect ratios derived from LayoutCalculator.calculateGalleryAspectRatio().
  // These represent actual sequence layouts: cols / (rows + 10/21).
  // Distribution weighted toward common beat counts (4-8 beats).
  const ASPECT_RATIO_POOL: number[] = [
    3.39, // 4 beats: 5 / (1 + 10/21) - short wide card
    2.07, // 8 beats: 5 / (2 + 10/21) - medium card
    1.36, // 20 beats: 6 / (4 + 10/21) - tall card
    2.07, // 8 beats again (most common)
    1.62, // 12 beats: 4 / (4 + 10/21) - medium-tall
    2.49, // 10 beats: 6 / (2 + 10/21) - medium-wide
    1.13, // 16 beats: 5 / (4 + 10/21) - near-square
    2.07, // 8 beats (very common)
    1.36, // 20 beats
    3.39, // 4 beats
    1.62, // 12 beats
    2.49, // 10 beats
  ];

  // Deterministic aspect ratio for each skeleton card index.
  // Wraps around the pool so any count works.
  function getAspectRatio(index: number): number {
    return ASPECT_RATIO_POOL[index % ASPECT_RATIO_POOL.length]!;
  }

  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    if (!gridRef) return;
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) containerWidth = w;
      }
    });
    resizeObserver.observe(gridRef);

    requestAnimationFrame(() => {
      if (gridRef) {
        const w = gridRef.getBoundingClientRect().width;
        if (w > 0) containerWidth = w;
      }
    });
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });
</script>

<div
  bind:this={gridRef}
  class="skeleton-grid"
  style:grid-template-columns="repeat({columnCount}, 1fr)"
>
  {#each Array(count) as _, index}
    <div class="skeleton-card">
      <div
        class="skeleton-image"
        style:aspect-ratio={getAspectRatio(index)}
      ></div>
      <!-- Shimmer overlay with staggered timing per card -->
      <div
        class="shimmer"
        style:animation-delay="{(index % columnCount) * 150}ms"
      ></div>
    </div>
  {/each}
</div>

<style>
  .skeleton-grid {
    display: grid;
    gap: var(--spacing-sm);
    width: 100%;
    align-items: start;
  }

  .skeleton-card {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
  }

  .skeleton-image {
    width: 100%;
    /* aspect-ratio set dynamically via inline style */
    background: var(--theme-card-hover-bg);
  }

  /* Separate shimmer element so stagger delay applies per-card */
  .shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--theme-card-hover-bg) 40%,
      rgba(255, 255, 255, 0.04) 50%,
      var(--theme-card-hover-bg) 60%,
      transparent 100%
    );
    animation: shimmer 1.8s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer {
      animation: none;
      opacity: 0;
    }
  }
</style>
