<!--
Gallery Thumbnail Skeleton - Loading State Component

Provides smooth skeleton loading animation while images load.
Optimized for mobile performance with CSS-only animations.
-->
<script lang="ts">
  const { viewMode = "grid", count = 6 } = $props<{
    viewMode?: "grid" | "list";
    count?: number;
  }>();
</script>

<!-- Skeleton Grid -->
<div
  class="skeleton-grid"
  class:list-view={viewMode === "list"}
  class:grid-view={viewMode === "grid"}
>
  {#each Array(count) as _, index}
    <div class="skeleton-thumbnail" data-skeleton-index={index}>
      <!-- Image skeleton -->
      <div class="skeleton-image"></div>

      <!-- Metadata skeleton -->
      <div class="skeleton-metadata">
        <div class="skeleton-title"></div>
        <div class="skeleton-subtitle"></div>
      </div>

      <!-- Actions skeleton -->
      <div class="skeleton-actions">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
    </div>
  {/each}
</div>

<style>
  .skeleton-grid {
    display: grid;
    gap: 16px;
    width: 100%;
  }

  .skeleton-grid.grid-view {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .skeleton-grid.list-view {
    grid-template-columns: 1fr;
  }

  .skeleton-thumbnail {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    padding: 16px;
    position: relative;
    overflow: hidden;
  }

  /* Shimmer animation */
  .skeleton-thumbnail::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      var(--theme-card-hover-bg),
      transparent
    );
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }

  .skeleton-image {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--theme-card-hover-bg);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .skeleton-metadata {
    margin-bottom: 12px;
  }

  .skeleton-title {
    height: 20px;
    background: var(--theme-stroke-strong);
    border-radius: 4px;
    margin-bottom: 8px;
    width: 70%;
  }

  .skeleton-subtitle {
    height: 16px;
    background: var(--theme-card-hover-bg);
    border-radius: 4px;
    width: 50%;
  }

  .skeleton-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .skeleton-button {
    width: 32px;
    height: 32px;
    background: var(--theme-card-hover-bg);
    border-radius: 6px;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .skeleton-grid {
      gap: 12px;
    }

    .skeleton-grid.grid-view {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }

    .skeleton-thumbnail {
      padding: 12px;
    }

    .skeleton-image {
      aspect-ratio: 4 / 3; /* Better for mobile */
    }
  }

  @media (max-width: 480px) {
    .skeleton-grid {
      gap: 8px;
    }

    .skeleton-grid.grid-view {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }

    .skeleton-thumbnail {
      padding: 8px;
    }
  }

  /* Reduce animation on low-power devices */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-thumbnail::before {
      animation: none;
    }
  }

  /* Performance optimization - stagger animations */
  .skeleton-thumbnail:nth-child(1) {
    animation-delay: 0ms;
  }
  .skeleton-thumbnail:nth-child(2) {
    animation-delay: 100ms;
  }
  .skeleton-thumbnail:nth-child(3) {
    animation-delay: 200ms;
  }
  .skeleton-thumbnail:nth-child(4) {
    animation-delay: 300ms;
  }
  .skeleton-thumbnail:nth-child(5) {
    animation-delay: 400ms;
  }
  .skeleton-thumbnail:nth-child(6) {
    animation-delay: 500ms;
  }
</style>
