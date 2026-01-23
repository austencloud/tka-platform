/**
 * Watch ITI Container
 *
 * Provides services for the Watch module with TikTok-style feed:
 * - Content loading
 * - Video playback control
 * - Scroll behavior (header auto-hide)
 * - Snap detection (haptic feedback)
 * - Directional preloading
 */

import { createContainer } from "iti";
import { FeedLoader } from "$lib/features/watch/services/implementations/FeedLoader";
import { VideoPlaybackController } from "$lib/features/watch/services/implementations/VideoPlaybackController";
import { FeedScrollBehavior } from "$lib/features/watch/services/implementations/FeedScrollBehavior";
import { FeedSnapDetector } from "$lib/features/watch/services/implementations/FeedSnapDetector";
import { FeedPreloader } from "$lib/features/watch/services/implementations/FeedPreloader";
import { PublicVideoLoader } from "$lib/features/watch/services/implementations/PublicVideoLoader";
import { feedScrollState } from "$lib/features/watch/state/feed-scroll-state.svelte";
import type { ICollaborativeVideoManager } from "$lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager";
import type { IExploreLoader } from "$lib/features/explore/sequences/display/services/contracts/IExploreLoader";

export interface WatchContainerDeps {
	collaborativeVideoManager: ICollaborativeVideoManager;
	exploreLoader: IExploreLoader;
}

export function createWatchContainer(deps: WatchContainerDeps) {
	return createContainer()
		.add({
			publicVideoLoader: () => new PublicVideoLoader(deps.collaborativeVideoManager),
			videoPlaybackController: () => new VideoPlaybackController(),
			feedScrollBehavior: () => new FeedScrollBehavior(feedScrollState),
			feedSnapDetector: () => new FeedSnapDetector(),
			feedPreloader: () => new FeedPreloader(),
		})
		.add((ctx) => ({
			feedLoader: () => new FeedLoader(ctx.publicVideoLoader, deps.exploreLoader),
		}));
}

export type WatchContainer = ReturnType<typeof createWatchContainer>;
