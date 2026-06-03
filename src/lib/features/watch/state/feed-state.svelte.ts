/**
 * Feed State
 *
 * Manages pagination state for the public video feed.
 * Uses Svelte 5 runes for reactive state management.
 */

import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";

/**
 * Feed loading status
 */
export type FeedStatus = "idle" | "loading" | "error" | "loaded";

/**
 * Creates reactive feed state for pagination
 */
export function createFeedState() {
  let videos = $state<CollaborativeVideo[]>([]);
  let status = $state<FeedStatus>("idle");
  let error = $state<string | null>(null);
  let hasMore = $state(true);
  let nextCursor = $state<string | null>(null);

  return {
    get videos() {
      return videos;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    get hasMore() {
      return hasMore;
    },
    get nextCursor() {
      return nextCursor;
    },
    get isLoading() {
      return status === "loading";
    },
    get isEmpty() {
      return status === "loaded" && videos.length === 0;
    },

    setLoading() {
      status = "loading";
      error = null;
    },

    setVideos(newVideos: CollaborativeVideo[], cursor: string | null, more: boolean) {
      videos = newVideos;
      nextCursor = cursor;
      hasMore = more;
      status = "loaded";
      error = null;
    },

    appendVideos(newVideos: CollaborativeVideo[], cursor: string | null, more: boolean) {
      videos = [...videos, ...newVideos];
      nextCursor = cursor;
      hasMore = more;
      status = "loaded";
      error = null;
    },

    setError(message: string) {
      status = "error";
      error = message;
    },

    reset() {
      videos = [];
      status = "idle";
      error = null;
      hasMore = true;
      nextCursor = null;
    },
  };
}

export type FeedState = ReturnType<typeof createFeedState>;
