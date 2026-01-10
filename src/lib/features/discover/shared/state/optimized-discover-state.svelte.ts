/**
 * Optimized Explore State - Mobile Performance
 *
 * Progressive loading gallery state with:
 * - Pagination and virtual scrolling
 * - Intelligent image preloading
 * - Mobile-first performance optimizations
 * - Skeleton loading states
 * - Connection-aware image request throttling
 */

import { container } from "$lib/shared/di";
import type {
  ExploreLoadingState,
  IOptimizedDiscoverer,
  SequenceMetadata,
} from "../services/contracts/IOptimizedDiscoverer";
import { adjustQueueForConnection } from "../utils/image-request-queue";
import { getConnectionInfo } from "../utils/connection-quality";

export function createOptimizedExploreState() {
  // Services
  const galleryService = container.items.optimizedDiscoverer;

  // Initialize connection-aware image request throttling
  const connectionInfo = getConnectionInfo();
  adjustQueueForConnection(connectionInfo.quality);

  // Core state
  let sequences = $state<SequenceMetadata[]>([]);
  let loadingState = $state<ExploreLoadingState>({
    isInitialLoading: false,
    isLoadingMore: false,
    error: null,
    loadedCount: 0,
    totalCount: 0,
  });

  // Pagination state
  let currentPage = $state(1);
  let hasMore = $state(true);
  let isInfiniteScrollEnabled = $state(true);

  // Search state
  let searchQuery = $state("");
  let isSearching = $state(false);
  let searchResults = $state<SequenceMetadata[]>([]);

  // Performance tracking
  let loadStartTime = $state<number | null>(null);
  let lastLoadDuration = $state<number | null>(null);

  // Computed values
  const isLoading = $derived(
    loadingState.isInitialLoading || loadingState.isLoadingMore
  );

  const displayedSequences = $derived.by(() =>
    searchQuery.length > 0 ? searchResults : sequences
  );

  const loadingProgress = $derived.by(() => {
    if (loadingState.totalCount === 0) return 0;
    return Math.round(
      (loadingState.loadedCount / loadingState.totalCount) * 100
    );
  });

  const canLoadMore = $derived.by(
    () => hasMore && !isLoading && !loadingState.error
  );

  // Load initial sequences
  async function loadInitialSequences(): Promise<void> {
    if (loadingState.isInitialLoading) return;

    try {
      loadStartTime = performance.now();

      loadingState.isInitialLoading = true;
      loadingState.error = null;

      const result = await galleryService.loadInitialSequences();

      sequences = result.sequences;
      loadingState.loadedCount = result.sequences.length;
      loadingState.totalCount = result.totalCount;
      hasMore = result.hasMore;
      currentPage = result.nextPage;

      // Start preloading next batch
      if (result.sequences.length > 0) {
        void galleryService.preloadNextBatch(result.sequences.slice(10, 20));
      }

      const duration = performance.now() - (loadStartTime || 0);
      lastLoadDuration = Math.round(duration);
    } catch (error) {
      console.error("Initial load failed:", error);
      loadingState.error =
        error instanceof Error ? error.message : "Failed to load sequences";
    } finally {
      loadingState.isInitialLoading = false;
    }
  }

  // Load more sequences (infinite scroll)
  async function loadMoreSequences(): Promise<void> {
    if (!canLoadMore) return;

    try {
      loadingState.isLoadingMore = true;
      loadingState.error = null;

      const result = await galleryService.loadMoreSequences(currentPage);

      // Append new sequences
      sequences = [...sequences, ...result.sequences];
      loadingState.loadedCount = sequences.length;
      hasMore = result.hasMore;
      currentPage = result.nextPage;

      // Preload next batch
      if (result.sequences.length > 0) {
        void galleryService.preloadNextBatch(result.sequences);
      }
    } catch (error) {
      console.error(`Failed to load page ${currentPage}:`, error);
      loadingState.error =
        error instanceof Error
          ? error.message
          : "Failed to load more sequences";
    } finally {
      loadingState.isLoadingMore = false;
    }
  }

  // Search sequences with debouncing
  let searchTimeout: number | null = null;
  async function searchSequences(query: string): Promise<void> {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchQuery = query.trim();

    // If empty query, show all sequences
    if (searchQuery.length === 0) {
      searchResults = [];
      isSearching = false;
      return;
    }

    // Debounce search
    searchTimeout = window.setTimeout(async () => {
      try {
        isSearching = true;

        const result = await galleryService.searchSequences(searchQuery);
        searchResults = result.sequences;
      } catch (error) {
        console.error("Search failed:", error);
        searchResults = [];
      } finally {
        isSearching = false;
      }
    }, 300); // 300ms debounce
  }

  // Clear search and return to main gallery
  function clearSearch(): void {
    searchQuery = "";
    searchResults = [];
    isSearching = false;
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  }

  // Refresh gallery (clear cache and reload)
  async function refreshGallery(): Promise<void> {
    // Clear cache
    galleryService.clearCache();

    // Reset state
    sequences = [];
    searchResults = [];
    currentPage = 1;
    hasMore = true;
    loadingState = {
      isInitialLoading: false,
      isLoadingMore: false,
      error: null,
      loadedCount: 0,
      totalCount: 0,
    };

    // Reload
    await loadInitialSequences();
  }

  // Intersection observer for infinite scroll
  function setupInfiniteScroll(element: HTMLElement): (() => void) | void {
    if (!isInfiniteScrollEnabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && canLoadMore) {
            void loadMoreSequences();
          }
        });
      },
      {
        rootMargin: "200px", // Start loading 200px before reaching bottom
        threshold: 0.1,
      }
    );

    observer.observe(element);

    // Return cleanup function
    return () => observer.disconnect();
  }

  return {
    // State
    get sequences() {
      return sequences;
    },
    get loadingState() {
      return loadingState;
    },
    get searchQuery() {
      return searchQuery;
    },
    get searchResults() {
      return searchResults;
    },
    get isSearching() {
      return isSearching;
    },
    get currentPage() {
      return currentPage;
    },
    get hasMore() {
      return hasMore;
    },
    get lastLoadDuration() {
      return lastLoadDuration;
    },

    // Computed
    get isLoading() {
      return isLoading;
    },
    get displayedSequences() {
      return displayedSequences;
    },
    get loadingProgress() {
      return loadingProgress;
    },
    get canLoadMore() {
      return canLoadMore;
    },

    // Actions
    loadInitialSequences,
    loadMoreSequences,
    searchSequences,
    clearSearch,
    refreshGallery,
    setupInfiniteScroll,

    // Settings
    get isInfiniteScrollEnabled() {
      return isInfiniteScrollEnabled;
    },
    set isInfiniteScrollEnabled(value: boolean) {
      isInfiniteScrollEnabled = value;
    },
  };
}
