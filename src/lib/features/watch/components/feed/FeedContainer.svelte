<!--
  FeedContainer

  TikTok-style full-screen vertical feed with:
  - Viewport-perfect cards (100dvh)
  - Scroll snap on touch devices
  - Snap detection with haptic feedback
  - Directional preloading (5 ahead, 1 behind)
  - Auto-load when 3 items from end
-->
<script lang="ts">

import { getFeedPreloader } from "$lib/features/watch/get-feed-preloader";
import { getFeedScrollBehavior } from "$lib/features/watch/get-feed-scroll-behavior";
import { getFeedSnapDetector } from "$lib/features/watch/get-feed-snap-detector";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount, onDestroy } from "svelte";
  import type { FeedItem } from "../../domain/models/feed-models";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { FeedSnapDetector } from "../../services/feed-snap-detector";
  import type { FeedPreloader } from "../../services/feed-preloader";
  import type { FeedScrollBehavior } from "../../services/feed-scroll-behavior";
  import { feedScrollState } from "../../state/feed-scroll-state.svelte";
  import FeedCard from "./FeedCard.svelte";
  import FeedLoadingState from "./FeedLoadingState.svelte";
  import FeedEmptyState from "./FeedEmptyState.svelte";
  import FeedErrorState from "./FeedErrorState.svelte";

  interface Props {
    items: FeedItem[];
    isLoading: boolean;
    hasMore: boolean;
    /** Whether the most recent load failed. */
    hasError?: boolean;
    /** Human-readable error message from the failed load. */
    error?: string | null;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    onLoadMore?: () => void;
    onRetry?: () => void;
    onCardClick?: (item: FeedItem) => void;
    onCreatorClick?: (creatorId: string, creatorName: string) => void;
    onCtaClick?: (item: FeedItem) => void;
    onScroll?: (scrollY: number) => void;
  }

  const {
    items,
    isLoading,
    hasMore,
    hasError = false,
    error = null,
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    onLoadMore,
    onRetry,
    onCardClick,
    onCreatorClick,
    onCtaClick,
    onScroll,
  }: Props = $props();

  // Element refs
  let containerRef = $state<HTMLDivElement | null>(null);

  // Services
  let hapticService: HapticFeedback | undefined;
  let snapDetector: FeedSnapDetector | undefined;
  let preloader: FeedPreloader | undefined;
  let scrollBehavior: FeedScrollBehavior | undefined;

  // Card refs for entry animations
  let cardRefs = new Map<string, { triggerEntryAnimation: () => void }>();

  // Computed
  const isEmpty = $derived(items.length === 0 && !isLoading && !hasError);

  // Track items near end for preloading
  const LOAD_MORE_THRESHOLD = 3;

  onMount(async () => {
    // Resolve services
    try {
      hapticService = getHapticFeedback();
    } catch {
      // Not available
    }

    try {
      snapDetector = getFeedSnapDetector();
      preloader = getFeedPreloader();
      scrollBehavior = getFeedScrollBehavior();
    } catch {
      // Services not registered yet - create inline
      const { FeedSnapDetector } = await import("../../services/feed-snap-detector");
      const { FeedPreloader } = await import("../../services/feed-preloader");
      const { FeedScrollBehavior } = await import("../../services/feed-scroll-behavior");

      snapDetector = new FeedSnapDetector();
      preloader = new FeedPreloader();
      scrollBehavior = new FeedScrollBehavior(feedScrollState);
    }

    // Attach snap detector
    if (containerRef && snapDetector) {
      snapDetector.attach(containerRef, () => items.length);

      // Handle snap completion
      snapDetector.onSnapComplete((index) => {
        handleSnapComplete(index);
      });
    }

    // Initial preload range
    if (preloader) {
      preloader.updatePosition(0, null, items.length);
    }
  });

  onDestroy(() => {
    snapDetector?.detach();
    preloader?.cancelAll();
    scrollBehavior?.reset();
    cardRefs.clear();
  });

  // Handle scroll events
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    const scrollY = target.scrollTop;

    // Update scroll behavior (header visibility)
    scrollBehavior?.handleScroll(scrollY);

    // Notify parent
    onScroll?.(scrollY);

    // Check if we need to load more (3 items from end)
    if (hasMore && !isLoading && items.length > 0) {
      const currentIndex = snapDetector?.currentIndex ?? Math.floor(scrollY / target.clientHeight);
      if (currentIndex >= items.length - LOAD_MORE_THRESHOLD) {
        onLoadMore?.();
      }
    }
  }

  function handleSnapComplete(index: number) {
    // Haptic feedback
    hapticService?.trigger("selection");

    // Update preloader with new position
    const direction = feedScrollState.scrollDirection;
    preloader?.updatePosition(index, direction, items.length);

    // Trigger entry animation on the current card
    const item = items[index];
    if (item) {
      const cardRef = cardRefs.get(item.id);
      cardRef?.triggerEntryAnimation();
    }

    // Update state
    feedScrollState.setCurrentCardIndex(index);

    // Preload content for visible range
    preloadVisibleRange(index);

    // Screen reader announcement
    announceCardChange(index);
  }

  async function preloadVisibleRange(currentIndex: number) {
    if (!preloader) return;

    const range = preloader.getPreloadRange();

    for (let i = range.start; i <= range.end; i++) {
      const item = items[i];
      if (!item) continue;

      // Preload based on content type
      if (item.contentType === "video" && item.videoUrl) {
        preloader.preloadVideo(item.videoUrl);
      } else if (item.thumbnailUrl) {
        preloader.preloadImage(item.thumbnailUrl);
      }
    }
  }

  function announceCardChange(index: number) {
    // Create live region announcement for screen readers
    const item = items[index];
    if (!item) return;

    const announcement = t('watch_feed_card_announcement', { current: index + 1, total: items.length, title: item.title, creator: item.creatorName });

    // Use existing live region or create one
    let liveRegion = document.getElementById("feed-live-region");
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "feed-live-region";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      liveRegion.className = "sr-only";
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = announcement;
  }

  function registerCardRef(id: string, ref: { triggerEntryAnimation: () => void }) {
    cardRefs.set(id, ref);
  }

  function unregisterCardRef(id: string) {
    cardRefs.delete(id);
  }

  function handleCardClick(item: FeedItem) {
    onCardClick?.(item);
  }

  function handleCreatorClick(creatorId: string, creatorName: string) {
    onCreatorClick?.(creatorId, creatorName);
  }

  function handleCtaClick(item: FeedItem) {
    onCtaClick?.(item);
  }

  // Check if item is in preload range
  function isInPreloadRange(index: number): boolean {
    return preloader?.isInPreloadRange(index) ?? false;
  }
</script>

<div
  bind:this={containerRef}
  class="feed-container"
  onscroll={handleScroll}
  role="feed"
  aria-label={t('watch_feed_label')}
>
  {#if isLoading && items.length === 0}
    <!-- Initial loading state -->
    <FeedLoadingState count={1} fullscreen />
  {:else if hasError && items.length === 0}
    <!-- Error state - surfaced instead of silently collapsing to empty -->
    <FeedErrorState message={error} {onRetry} />
  {:else if isEmpty}
    <!-- Empty state -->
    <FeedEmptyState />
  {:else}
    <!-- Feed items -->
    <div class="feed-list">
      {#each items as item, index (item.id)}
        <FeedCard
          {item}
          {bluePropType}
          {redPropType}
          {catDogModeEnabled}
          preloadPriority={isInPreloadRange(index) ? "high" : "low"}
          onCardClick={handleCardClick}
          onCreatorClick={handleCreatorClick}
          onCtaClick={handleCtaClick}
          onMount={(ref) => registerCardRef(item.id, ref)}
          onDestroy={() => unregisterCardRef(item.id)}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .feed-container {
    position: absolute;
    inset: 0;
    height: 100dvh;
    /* CRITICAL: Use 'scroll' not 'auto' for consistent snap behavior */
    overflow-y: scroll;
    overflow-x: hidden;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    /* BASE scroll snap - applied ALWAYS, not just in media query */
    scroll-snap-type: y mandatory;
  }

  /* Fallback for browsers without dvh support */
  @supports not (height: 100dvh) {
    .feed-container {
      height: var(--viewport-height, 100vh);
    }
  }

  /* Desktop: soften to proximity to not fight mouse wheel */
  @media (hover: hover) and (pointer: fine) {
    .feed-container {
      scroll-snap-type: y proximity;
    }
  }

  /* Disable snap entirely under reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .feed-container {
      scroll-snap-type: none;
    }
  }

  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Screen reader only class */
  :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
