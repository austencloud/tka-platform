<script lang="ts">
  /**
   * VirtualizedCreatorGrid - High-performance virtualized grid for creators
   *
   * Uses TanStack Virtual to render only visible rows, dramatically improving
   * performance for large user lists. Includes:
   * - Dynamic column count based on container width
   * - Infinite scroll trigger for pagination
   * - Visibility-driven color extraction
   */

  import {
    createVirtualizer,
    type VirtualItem,
  } from "@tanstack/svelte-virtual";
  import { onMount, onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import CreatorCard from "./CreatorCard.svelte";

  interface Props {
    users: EnhancedUserProfile[];
    currentUserId?: string;
    followingInProgress: Set<string>;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onUserClick: (user: EnhancedUserProfile) => void;
    onFollowToggle: (user: EnhancedUserProfile) => void;
    onLoadMore?: () => void;
  }

  const {
    users = [],
    currentUserId,
    followingInProgress = new Set(),
    hasMore = false,
    isLoadingMore = false,
    onUserClick,
    onFollowToggle,
    onLoadMore,
  }: Props = $props();

  // Container and scroll element refs
  let scrollElement = $state<HTMLDivElement | null>(null);
  let containerWidth = $state(0);

  // Reactive state for virtualizer data
  let virtualRows = $state<VirtualItem[]>([]);
  let totalHeight = $state(0);

  // Track extracted colors per user ID
  let userColors = $state<Map<string, string>>(new Map());

  // Color extraction queue for batched processing
  let colorExtractionQueue: string[] = [];
  let isProcessingColors = false;

  // Dynamic column count based on container width
  // Match original PanelGrid behavior: minCardWidth="240px"
  const columnCount = $derived.by(() => {
    if (containerWidth === 0) return 2;
    if (containerWidth >= 1200) return 5;
    if (containerWidth >= 960) return 4;
    if (containerWidth >= 720) return 3;
    return 2;
  });

  // Calculate row count based on users and columns
  const rowCount = $derived(Math.ceil(users.length / columnCount));

  // Fixed card height for user cards (avatar + info + stats + button + padding)
  // Increased to account for full card content including follow button
  const CARD_HEIGHT = 240;
  const GAP = 20;
  const estimatedRowHeight = $derived(CARD_HEIGHT + GAP);

  // Get users for a specific row
  function getRowUsers(rowIndex: number): EnhancedUserProfile[] {
    const startIndex = rowIndex * columnCount;
    const endIndex = Math.min(startIndex + columnCount, users.length);
    return users.slice(startIndex, endIndex);
  }

  // Get color for a user
  function getUserColor(userId: string): string | undefined {
    return userColors.get(userId);
  }

  // Queue color extraction for a user
  function queueColorExtraction(userId: string) {
    if (colorExtractionQueue.includes(userId)) return;
    colorExtractionQueue.push(userId);
    if (!isProcessingColors) {
      processColorQueue();
    }
  }

  // Process color extraction queue in batches
  async function processColorQueue() {
    isProcessingColors = true;
    while (colorExtractionQueue.length > 0) {
      // Process up to 10 at a time
      const batch = colorExtractionQueue.splice(0, 10);
      // Colors are extracted by CreatorCard components
      // Just small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    isProcessingColors = false;
  }

  // Handle color extraction callback from card
  function handleColorExtracted(userId: string, color: string) {
    userColors = new Map(userColors).set(userId, color);
  }

  // Intersection observer for infinite scroll
  let loadMoreTrigger = $state<HTMLDivElement | null>(null);
  let loadMoreObserver: IntersectionObserver | null = null;

  // Initialize virtualizer and subscribe to updates
  onMount(() => {
    if (!scrollElement) return;

    // Create virtualizer store
    const virtualizerStore = createVirtualizer({
      count: rowCount,
      getScrollElement: () => scrollElement,
      estimateSize: () => estimatedRowHeight,
      overscan: 3, // Render 3 extra rows above/below viewport
    });

    // Subscribe to virtualizer updates
    const unsubscribe = virtualizerStore.subscribe((v) => {
      virtualRows = v.getVirtualItems();
      totalHeight = v.getTotalSize();
    });

    // ResizeObserver to track container width
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          containerWidth = width;
          // Force virtualizer to recalculate
          const v = get(virtualizerStore);
          v.measure();
        }
      }
    });

    resizeObserver.observe(scrollElement);

    // Initial measurement
    requestAnimationFrame(() => {
      if (scrollElement) {
        const width = scrollElement.getBoundingClientRect().width;
        if (width > 0) containerWidth = width;
      }
    });

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
    };
  });

  // Setup infinite scroll observer
  $effect(() => {
    if (!loadMoreTrigger || !onLoadMore) return;

    loadMoreObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: scrollElement,
        rootMargin: "300px", // Trigger 300px before reaching bottom
        threshold: 0,
      }
    );

    loadMoreObserver.observe(loadMoreTrigger);

    return () => {
      loadMoreObserver?.disconnect();
      loadMoreObserver = null;
    };
  });

  // Reconfigure virtualizer when rowCount or estimatedRowHeight changes
  $effect(() => {
    // Capture reactive dependencies
    const count = rowCount;
    const height = estimatedRowHeight;

    // Run update outside reactive tracking
    untrack(() => {
      if (!scrollElement) return;

      // Create new virtualizer with updated config
      const virtualizerStore = createVirtualizer({
        count,
        getScrollElement: () => scrollElement,
        estimateSize: () => height,
        overscan: 3,
      });

      // Subscribe to updates
      const unsubscribe = virtualizerStore.subscribe((v) => {
        virtualRows = v.getVirtualItems();
        totalHeight = v.getTotalSize();
      });

      // Cleanup previous subscription on next effect run
      return unsubscribe;
    });
  });
</script>

<div
  bind:this={scrollElement}
  class="virtual-scroll-container"
  role="grid"
  aria-rowcount={rowCount}
>
  <div class="virtual-content" style:height="{totalHeight}px">
    {#each virtualRows as virtualRow (virtualRow.key)}
      <div
        class="virtual-row"
        style:position="absolute"
        style:top="{virtualRow.start}px"
        style:width="100%"
        style:display="grid"
        style:grid-template-columns="repeat({columnCount}, 1fr)"
        style:gap="{GAP}px"
        role="row"
        aria-rowindex={virtualRow.index + 1}
      >
        {#each getRowUsers(virtualRow.index) as user, colIndex (user.id)}
          <div role="gridcell" aria-colindex={colIndex + 1}>
            <CreatorCard
              {user}
              accentColor={getUserColor(user.id)}
              {currentUserId}
              isFollowLoading={followingInProgress.has(user.id)}
              onUserClick={() => onUserClick(user)}
              onFollowToggle={() => onFollowToggle(user)}
              onColorExtracted={(color) => handleColorExtracted(user.id, color)}
            />
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Infinite scroll trigger -->
  {#if hasMore}
    <div bind:this={loadMoreTrigger} class="load-more-trigger">
      {#if isLoadingMore}
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>Loading more creators...</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .virtual-scroll-container {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    /* Smooth scrolling for virtual lists */
    scroll-behavior: smooth;
    /* Custom scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-accent) var(--scrollbar-track);
  }

  .virtual-scroll-container::-webkit-scrollbar {
    width: 8px;
  }

  .virtual-scroll-container::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .virtual-scroll-container::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent);
    border-radius: 4px;
  }

  .virtual-content {
    position: relative;
    width: 100%;
  }

  /* Focus styles for keyboard navigation (WCAG AAA) */
  .virtual-row [role="gridcell"]:focus-within {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
    border-radius: 8px;
  }

  .virtual-row {
    padding: 0 var(--spacing-sm, 4px);
    box-sizing: border-box;
  }

  .load-more-trigger {
    padding: 24px;
    min-height: 80px;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .loading-indicator i {
    font-size: var(--font-size-lg);
    color: var(--theme-accent);
  }

  /* Responsive gap adjustments */
  @media (max-width: 640px) {
    .virtual-row {
      gap: 12px !important;
    }
  }
</style>
