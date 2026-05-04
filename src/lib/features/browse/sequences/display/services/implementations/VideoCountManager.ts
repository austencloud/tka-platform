/**
 * VideoCountManager - Manage video counts for sequences
 *
 * Provides efficient video count lookups with caching.
 * Reduces Firestore reads by caching counts.
 */

import { getVideosForSequence } from "$lib/shared/video-collaboration/services/collaborative-video-manager";

export class VideoCountManager {
  // Cache video counts to avoid repeated Firestore queries
  private countCache = new Map<string, number>();
  // In-flight requests to prevent duplicate fetches
  private pendingRequests = new Map<string, Promise<number>>();

  constructor() {}

  async getVideoCount(sequenceId: string): Promise<number> {
    // Return cached count if available
    const cached = this.countCache.get(sequenceId);
    if (cached !== undefined) {
      return cached;
    }

    // Check for in-flight request
    const pending = this.pendingRequests.get(sequenceId);
    if (pending) {
      return pending;
    }

    // Fetch and cache
    const request = this.fetchCount(sequenceId);
    this.pendingRequests.set(sequenceId, request);

    try {
      const count = await request;
      this.countCache.set(sequenceId, count);
      return count;
    } finally {
      this.pendingRequests.delete(sequenceId);
    }
  }

  async refreshCount(sequenceId: string): Promise<number> {
    // Clear cache and fetch fresh
    this.countCache.delete(sequenceId);
    return this.getVideoCount(sequenceId);
  }

  invalidateCache(sequenceId: string): void {
    this.countCache.delete(sequenceId);
  }

  private async fetchCount(sequenceId: string): Promise<number> {
    try {
      const videos = await getVideosForSequence(sequenceId);
      return videos.length;
    } catch (error) {
      console.warn(
        `[VideoCountManager] Failed to fetch video count for ${sequenceId}:`,
        error
      );
      return 0;
    }
  }
}
