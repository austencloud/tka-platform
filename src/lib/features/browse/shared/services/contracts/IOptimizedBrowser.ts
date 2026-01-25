/**
 * Optimized Explore Service - Mobile-First Performance
 *
 * Implements progressive loading, virtual scrolling, and image optimization
 * to dramatically improve mobile gallery performance.
 */

export interface SequenceMetadata {
  id: string;
  word: string;
  thumbnailUrl: string;
  webpThumbnailUrl?: string;
  width?: number; // Image width for layout stability
  height?: number; // Image height for layout stability
  length: number;
  hasImage: boolean;
  priority: boolean; // Above-the-fold
}

export interface PaginatedSequences {
  sequences: SequenceMetadata[];
  totalCount: number;
  hasMore: boolean;
  nextPage: number;
}

export interface ExploreLoadingState {
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadedCount: number;
  totalCount: number;
}

export interface IOptimizedExploreer {
  /**
   * Load initial batch of sequences (first 20-30 for mobile)
   */
  loadInitialSequences(): Promise<PaginatedSequences>;

  /**
   * Load next page of sequences
   */
  loadMoreSequences(page: number): Promise<PaginatedSequences>;

  /**
   * Get optimized thumbnail URL with WebP fallback
   */
  getOptimizedThumbnailUrl(sequenceId: string, preferWebP?: boolean): string;

  /**
   * Preload next batch of images for smooth scrolling
   */
  preloadNextBatch(sequences: SequenceMetadata[]): Promise<void>;

  /**
   * Get total sequence count without loading all data
   */
  getTotalSequenceCount(): Promise<number>;

  /**
   * Search sequences with debounced loading
   */
  searchSequences(query: string, page?: number): Promise<PaginatedSequences>;

  /**
   * Clear cache and reset state
   */
  clearCache(): void;
}
