/**
 * PublicVideoLoader
 *
 * Loads public videos from Firestore with pagination support.
 * Wraps CollaborativeVideoManager for the Feed tab.
 */

import type { PublicVideoQuery, PublicVideoPage } from "../../types";
import { getPublicVideos } from "$lib/shared/video-collaboration/services/collaborative-video-manager";

const DEFAULT_PAGE_SIZE = 20;

export class PublicVideoLoader {
  constructor() {}

  async loadPublicVideos(options?: PublicVideoQuery): Promise<PublicVideoPage> {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;

    // Note: Current implementation doesn't support cursor-based pagination
    const videos = await getPublicVideos(limit);

    return {
      videos,
      nextCursor: null, // TODO: Implement proper cursor pagination
      hasMore: videos.length >= limit,
    };
  }
}
