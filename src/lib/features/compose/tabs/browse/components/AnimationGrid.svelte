<!--
AnimationGrid.svelte

Responsive grid for displaying animation cards.
Adapted from DiscoverGrid with animate-css-grid for smooth transitions.

Features:
- Responsive 2-4 column layout based on container width
- FLIP animations for smooth grid transitions
- Empty state support
- Loading skeleton support
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { SavedAnimation } from "../state/browse-state.svelte";
  import { onMount } from "svelte";
  import { wrapGrid } from "animate-css-grid";
  import AnimationCard from "./AnimationCard.svelte";

  const {
    animations = [],
    isLoading = false,
    hasActiveFilters = false,
    onClearFilters = () => {},
    onAction = () => {},
  } = $props<{
    animations?: SavedAnimation[];
    isLoading?: boolean;
    hasActiveFilters?: boolean;
    onClearFilters?: () => void;
    onAction?: (action: string, animation: SavedAnimation) => void;
  }>();

  // Grid element ref for animate-css-grid
  let gridRef = $state<HTMLElement | undefined>(undefined);

  // Track container width to control column count
  let containerWidth = $state(0);

  const columnCount = $derived.by(() => {
    if (containerWidth === 0) return 2; // Default
    if (containerWidth >= 1600) return 6;
    if (containerWidth >= 1200) return 5;
    if (containerWidth >= 800) return 4;
    if (containerWidth >= 481) return 3;
    return 2;
  });

  // Initialize animate-css-grid and ResizeObserver
  onMount(() => {
    // Configure FLIP animation for smooth grid transitions
    const animationConfig = {
      duration: 300,
      stagger: 0,
      easing: "easeInOut" as const,
    };

    // Wrap grid
    let unwrapFunction: (() => void) | undefined;
    if (gridRef) {
      unwrapFunction = wrapGrid(gridRef, animationConfig)?.unwrapGrid;
    }

    // ResizeObserver to track container width changes
    const resizeObserver = gridRef
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            const newWidth = entry.contentRect.width;
            if (newWidth > 0) {
              containerWidth = newWidth;
            }
          }
        })
      : null;

    if (gridRef && resizeObserver) {
      resizeObserver.observe(gridRef);

      // Initial width measurement
      requestAnimationFrame(() => {
        const width = gridRef!.getBoundingClientRect().width;
        if (width > 0) {
          containerWidth = width;
        }
      });
    }

    // Additional safeguard: Re-measure on window resize
    const handleResize = () => {
      if (gridRef) {
        const width = gridRef.getBoundingClientRect().width;
        if (width > 0) {
          containerWidth = width;
        }
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      unwrapFunction?.();
    };
  });

  // Handle animation actions
  function handleAnimationAction(action: string, animation: SavedAnimation) {
    onAction(action, animation);
  }
</script>

{#if isLoading}
  <!-- Loading skeletons -->
  <div
    class="animations-grid"
    style:grid-template-columns="repeat({columnCount}, 1fr)"
  >
    {#each Array(12) as _, i}
      <div class="skeleton-card" style:animation-delay="{i * 50}ms">
        <div class="skeleton-media"></div>
        <div class="skeleton-footer">
          <div class="skeleton-title"></div>
          <div class="skeleton-meta"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if animations.length > 0}
  <!-- Animation grid -->
  <div
    bind:this={gridRef}
    class="animations-grid"
    style:grid-template-columns="repeat({columnCount}, 1fr)"
  >
    {#each animations as animation (animation.id)}
      <AnimationCard
        {animation}
        onPrimaryAction={(anim) => handleAnimationAction("view-detail", anim)}
      />
    {/each}
  </div>
{:else}
  <!-- Empty state -->
  <div class="empty-state">
    {#if hasActiveFilters}
      <!-- Filtered empty state -->
      <i class="fas fa-filter-circle-xmark empty-icon" aria-hidden="true"></i>
      <p class="empty-message">No animations match your filters</p>
      <p class="empty-hint">Try adjusting your search or filters</p>
      <button class="clear-filters-btn" onclick={onClearFilters}>
        <i class="fas fa-times" aria-hidden="true"></i>
        Clear Filters
      </button>
    {:else}
      <!-- No animations at all -->
      <i class="fas fa-film empty-icon" aria-hidden="true"></i>
      <p class="empty-message">{t("empty_no_animations")}</p>
      <p class="empty-hint">
        Create your first animation in the Single, Mirror, Tunnel, or Grid tabs
      </p>
    {/if}
  </div>
{/if}

<style>
  /* Responsive grid that adapts to container width */
  .animations-grid {
    display: grid;
    gap: var(--spacing-lg);
    grid-auto-rows: max-content;
    width: 100%;
  }

  /* Responsive gap adjustments */
  @container (max-width: 480px) {
    .animations-grid {
      gap: 8px;
    }
  }

  @container (min-width: 481px) and (max-width: 1199px) {
    .animations-grid {
      gap: var(--spacing-md);
    }
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: var(--spacing-xl);
    text-align: center;
  }

  .empty-icon {
    font-size: var(--font-size-3xl);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.15));
    margin-bottom: var(--spacing-lg);
  }

  .empty-message {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text-dim);
    margin: 0 0 var(--spacing-sm) 0;
  }

  .empty-hint {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    margin: 0;
    max-width: 400px;
  }

  .clear-filters-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: var(--spacing-md);
    padding: 10px 20px;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 8px;
    color: var(--theme-accent);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-filters-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .clear-filters-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Loading Skeletons */
  .skeleton-card {
    border-radius: 8px;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton-media {
    width: 100%;
    aspect-ratio: 1;
    background: linear-gradient(
      90deg,
      var(--theme-card-bg, rgba(255, 255, 255, 0.03)) 0%,
      var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06)) 50%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.03)) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 2s ease-in-out infinite;
  }

  .skeleton-footer {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-title {
    height: 16px;
    width: 70%;
    background: var(--theme-card-hover-bg);
    border-radius: 4px;
  }

  .skeleton-meta {
    height: 12px;
    width: 50%;
    background: var(--theme-stroke);
    border-radius: 4px;
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes skeleton-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-card {
      animation: none;
    }

    .skeleton-media {
      animation: none;
    }
  }
</style>
