<script lang="ts">
  /**
   * VirtualizedCreatorGrid - High-performance virtualized grid for creators
   *
   * Uses TanStack Virtual with dynamic row measurement to render only visible rows.
   * Row heights are measured from actual DOM content via measureElement/ResizeObserver,
   * so cards of varying height (with/without pronouns, follow buttons) are handled
   * correctly without hardcoded pixel values.
   */

  import {
    createVirtualizer,
    type VirtualItem,
    type SvelteVirtualizer,
  } from "@tanstack/svelte-virtual";
  import { onMount, untrack } from "svelte";
  import type { EnhancedUserProfile, CreatorSortCriteria } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import CreatorCard from "./CreatorCard.svelte";

  interface Props {
    users: EnhancedUserProfile[];
    sortBy?: CreatorSortCriteria;
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
    sortBy = "lastActive",
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

  let virtualizerRef: SvelteVirtualizer<HTMLDivElement, Element> | null = $state(null);

  // Track extracted colors per user ID
  let userColors = $state<Map<string, string>>(new Map());

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

  // Gap between rows (vertical) and between cards (horizontal)
  const GAP = 12;

  // Rough initial estimate - corrected by measureElement after first render
  const INITIAL_ROW_ESTIMATE = 270;

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

  function handleColorExtracted(userId: string, color: string) {
    userColors = new Map(userColors).set(userId, color);
  }

  /**
   * Svelte action for dynamic row measurement.
   * TanStack Virtual's measureElement uses a ResizeObserver internally,
   * so if card content changes height (avatar load, follow toggle), the
   * virtualizer automatically picks up the new size.
   */
  function measureRow(node: HTMLElement) {
    virtualizerRef?.measureElement(node);
    return {
      destroy() {
        virtualizerRef?.measureElement(node);
      },
    };
  }

  // Intersection observer for infinite scroll
  let loadMoreTrigger = $state<HTMLDivElement | null>(null);

  // ResizeObserver for container width tracking (independent of virtualizer)
  onMount(() => {
    if (!scrollElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) containerWidth = width;
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

    return () => resizeObserver.disconnect();
  });

  // Virtualizer lifecycle - recreates when rowCount changes
  $effect(() => {
    if (!scrollElement) return;

    const count = rowCount;

    const virtualizerStore = createVirtualizer({
      count,
      getScrollElement: () => scrollElement,
      estimateSize: () => INITIAL_ROW_ESTIMATE,
      gap: GAP,
      overscan: 3,
    });

    const unsubscribe = virtualizerStore.subscribe((v) => {
      virtualizerRef = v;
      virtualRows = v.getVirtualItems();
      totalHeight = v.getTotalSize();
    });

    return unsubscribe;
  });

  // Keep every rendered row's measured height exact.
  //
  // Cards change height AFTER their row is first measured: auth resolving makes
  // the follow button appear (your own card never has one, so a row mixes tall
  // and short cards), and colors / prop tags / stats render in asynchronously.
  // The virtualizer is also recreated whenever rowCount changes (data loads,
  // column count resolves) — and a fresh instance's ResizeObserver has never
  // observed the rows already in the DOM. Any of these leaves a row sized by a
  // stale estimate, so the next row stacks ~18px too high and the cards overlap.
  //
  // Re-running measureElement on each rendered row re-observes it against the
  // current instance and writes its true border-box height back into the size
  // cache (non-destructive, unlike measure(), which resets every size to the
  // estimate). Positions then re-settle exactly. rAF defers to after paint so
  // the freshly-grown content is laid out before we read it.
  $effect(() => {
    // Track everything that changes a row's height or swaps the instance.
    virtualizerRef;
    void users;
    void currentUserId;
    void sortBy;
    void followingInProgress;
    void columnCount;

    return untrack(() => {
      const v = virtualizerRef;
      const container = scrollElement;
      if (!v || !container) return;
      const frame = requestAnimationFrame(() => {
        for (const node of container.querySelectorAll<HTMLElement>(".virtual-row")) {
          v.measureElement(node);
        }
      });
      return () => cancelAnimationFrame(frame);
    });
  });

  // Setup infinite scroll observer
  $effect(() => {
    if (!loadMoreTrigger || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: scrollElement,
        rootMargin: "300px",
        threshold: 0,
      }
    );

    observer.observe(loadMoreTrigger);

    return () => observer.disconnect();
  });
</script>

<div
  bind:this={scrollElement}
  class="virtual-scroll-container ph-no-capture"
  role="grid"
  aria-rowcount={rowCount}
>
  <div class="virtual-content" style:height="{totalHeight}px">
    {#each virtualRows as virtualRow (virtualRow.key)}
      <div
        class="virtual-row"
        data-index={virtualRow.index}
        use:measureRow
        style:position="absolute"
        style:top="{virtualRow.start}px"
        style:width="100%"
        style:display="grid"
        style:grid-template-columns="repeat({columnCount}, minmax(0, 1fr))"
        style:column-gap="{GAP}px"
        role="row"
        aria-rowindex={virtualRow.index + 1}
      >
        {#each getRowUsers(virtualRow.index) as user, colIndex (user.id)}
          <div role="gridcell" aria-colindex={colIndex + 1}>
            <CreatorCard
              {user}
              {sortBy}
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

  /* Grid items default to min-width:auto (min-content). A card with a long
     nowrap name would otherwise refuse to shrink and overflow its 1fr track,
     making one column wider than its neighbor. min-width:0 lets the cell honor
     the equal track width so the card's own ellipsis truncation takes over. */
  .virtual-row [role="gridcell"] {
    min-width: 0;
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

  /* Responsive column gap */
  @media (max-width: 640px) {
    .virtual-row {
      column-gap: 12px !important;
    }
  }
</style>
