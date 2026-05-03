/**
 * PublicVideoLoader
 *
 * Loads public videos from Firestore with pagination support.
 * Wraps CollaborativeVideoManager for the Feed tab.
 */

import type { PublicVideoQuery, PublicVideoPage } from "../../types";
import type { CollaborativeVideoManager } from "$lib/shared/video-collaboration/services/implementations/CollaborativeVideoManager";

const DEFAULT_PAGE_SIZE = 20;

export class PublicVideoLoader {
  constructor(
    private collaborativeVideoManager: CollaborativeVideoManager
  ) {}

  async loadPublicVideos(options?: PublicVideoQuery): Promise<PublicVideoPage> {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;

    // Note: Current implementation doesn't support cursor-based pagination
    // This is a simplified version that loads all videos up to limit
    // A proper implementation would add cursor support to CollaborativeVideoManager
    const videos = await this.collaborativeVideoManager.getPublicVideos(limit);

    return {
      videos,
      nextCursor: null, // TODO: Implement proper cursor pagination
      hasMore: videos.length >= limit,
    };
  }
}
