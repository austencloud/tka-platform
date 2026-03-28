<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    playerX: number;
    playerY: number;
    tileSize: number;
    gridWidth: number;
    gridHeight: number;
    children: Snippet;
  }

  let { playerX, playerY, tileSize, gridWidth, gridHeight, children }: Props = $props();

  let viewportEl: HTMLElement | undefined = $state();
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  // Track viewport size via ResizeObserver
  $effect(() => {
    if (!viewportEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        viewportWidth = entry.contentRect.width;
        viewportHeight = entry.contentRect.height;
      }
    });
    observer.observe(viewportEl);
    return () => observer.disconnect();
  });

  // Center the camera on the player's tile, clamped to grid bounds
  let totalWidth = $derived(gridWidth * tileSize);
  let totalHeight = $derived(gridHeight * tileSize);

  // Player center in pixel space
  let playerCenterX = $derived((playerX + 0.5) * tileSize);
  let playerCenterY = $derived((playerY + 0.5) * tileSize);

  // Desired translation to center player in viewport
  let rawTx = $derived(viewportWidth / 2 - playerCenterX);
  let rawTy = $derived(viewportHeight / 2 - playerCenterY);

  // Clamp so we don't show void beyond the grid edges
  let tx = $derived(
    totalWidth <= viewportWidth
      ? (viewportWidth - totalWidth) / 2
      : Math.max(viewportWidth - totalWidth, Math.min(0, rawTx))
  );
  let ty = $derived(
    totalHeight <= viewportHeight
      ? (viewportHeight - totalHeight) / 2
      : Math.max(viewportHeight - totalHeight, Math.min(0, rawTy))
  );

  let innerStyle = $derived(
    `transform: translate(${tx}px, ${ty}px); ` +
    `width: ${totalWidth}px; height: ${totalHeight}px;`
  );
</script>

<div class="museum-camera" bind:this={viewportEl}>
  <div class="museum-camera-inner" style={innerStyle}>
    {@render children()}
  </div>
</div>

<style>
  .museum-camera {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    background: #0a0a0a;
  }

  .museum-camera-inner {
    position: relative;
    transition: transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    will-change: transform;
  }
</style>
