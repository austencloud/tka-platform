/**
 * Watch Module Types
 *
 * Types specific to the Watch module for video browsing.
 */

import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";

/**
 * Tab identifiers for the Watch module
 * Note: Showcase merged into Library. Curator is admin-only (handled separately).
 */
export type WatchTabId = "feed" | "library";

/**
 * Pagination cursor for infinite scroll
 */
export interface PublicVideoQuery {
  cursor?: string;
  limit?: number;
}

/**
 * Paginated response for public videos
 */
export interface PublicVideoPage {
  videos: CollaborativeVideo[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Filter options for showcase videos
 */
export interface ShowcaseFilter {
  category?: string | null;
  performer?: string | null;
  featured?: boolean;
}
