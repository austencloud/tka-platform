/**
 * Sequence Videos State
 *
 * Reactive Svelte 5 state for fetching and managing videos linked to a sequence.
 * Use this in components to display collaborative videos for a sequence.
 *
 * Usage:
 * ```svelte
 * <script>
 *   import { createSequenceVideosState } from '$lib/shared/video-collaboration';
 *   const videosState = createSequenceVideosState(sequenceId);
 * </script>
 *
 * {#if videosState.loading}
 *   <p>Loading videos...</p>
 * {:else if videosState.videos.length > 0}
 *   {#each videosState.videos as video}
 *     <VideoCard {video} />
 *   {/each}
 * {:else}
 *   <p>No videos yet</p>
 * {/if}
 * ```
 */

import type { CollaborativeVideo } from "../domain/CollaborativeVideo";
import type { ICollaborativeVideoManager } from "../services/contracts/ICollaborativeVideoManager";
import { container } from "$lib/shared/di";

export interface SequenceVideosState {
  /** Videos linked to this sequence */
  readonly videos: CollaborativeVideo[];
  /** Loading state */
  readonly loading: boolean;
  /** Error if fetch failed */
  readonly error: string | null;
  /** Whether there are any videos */
  readonly hasVideos: boolean;
  /** Number of videos */
  readonly videoCount: number;
  /** Refresh the video list */
  refresh(): Promise<void>;
}

/**
 * Create reactive state for videos linked to a sequence
 */
export function createSequenceVideosState(
  sequenceId: string
): SequenceVideosState {
  let videos = $state<CollaborativeVideo[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const hasVideos = $derived(videos.length > 0);
  const videoCount = $derived(videos.length);

  // Get service from DI container
  const videoService = container.items.collaborativeVideoManager;

  async function refresh(): Promise<void> {
    if (!videoService) {
      error = "Video service not available";
      loading = false;
      return;
    }

    loading = true;
    error = null;

    try {
      videos = await videoService.getVideosForSequence(sequenceId);
    } catch (e) {
      console.error("Failed to fetch sequence videos:", e);
      error = e instanceof Error ? e.message : "Failed to load videos";
      videos = [];
    } finally {
      loading = false;
    }
  }

  // Initial fetch
  refresh();

  return {
    get videos() {
      return videos;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get hasVideos() {
      return hasVideos;
    },
    get videoCount() {
      return videoCount;
    },
    refresh,
  };
}

/**
 * Lightweight check for whether a sequence has any videos
 * Useful for showing video indicators without loading full video data
 */
export function createVideoPresenceCheck(sequenceId: string): {
  readonly hasVideos: boolean;
  readonly loading: boolean;
} {
  let hasVideos = $state(false);
  let loading = $state(true);

  const videoService = container.items.collaborativeVideoManager;

  if (videoService) {
    videoService
      .getVideosForSequence(sequenceId)
      .then((videos: CollaborativeVideo[]) => {
        hasVideos = videos.length > 0;
      })
      .catch(() => {
        hasVideos = false;
      })
      .finally(() => {
        loading = false;
      });
  } else {
    loading = false;
  }

  return {
    get hasVideos() {
      return hasVideos;
    },
    get loading() {
      return loading;
    },
  };
}
