/**
 * Watch Feed State
 *
 * Reactive state management for the Watch > Feed tab.
 * Handles pagination and loading states.
 * Connects to FeedLoader service for data fetching.
 */

import type { FeedItem } from "../domain/models/feed-models";
import type { FeedLoader } from "../services/feed-loader";


export type FeedStatus = "idle" | "loading" | "loaded" | "error";

/**
 * Creates reactive feed state for Watch > Feed.
 */
export function createWatchFeedState() {
	let items: FeedItem[] = $state([]);
	let status = $state<FeedStatus>("idle");
	let error = $state<string | null>(null);
	let _hasMore = $state(true);
	let nextCursor = $state<string | null>(null);

	// Get feed loader from DI container (may not be available immediately)
	let feedLoader: FeedLoader | null = null;

	function getFeedLoader(): FeedLoader | null {
		if (!feedLoader) {
			try {
				feedLoader = getFeedLoader() ?? null;
			} catch {
				// Container not ready yet
			}
		}
		return feedLoader;
	}

	async function loadFeed(isLoadMore = false) {
		const loader = getFeedLoader();
		if (!loader) {
			console.warn("[WatchFeedState] FeedLoader not available");
			return;
		}

		if (status === "loading") return;

		status = "loading";
		error = null;

		try {
			const page = await loader.loadFeedPage({
				cursor: isLoadMore ? nextCursor ?? undefined : undefined,
				limit: 15,
			});

			if (isLoadMore) {
				items = [...items, ...page.items];
			} else {
				items = [...page.items];
			}
			nextCursor = page.nextCursor;
			_hasMore = page.hasMore;
			status = "loaded";
		} catch (err) {
			console.error("[WatchFeedState] Failed to load feed:", err);
			error = err instanceof Error ? err.message : "Failed to load feed";
			status = "error";
		}
	}

	return {
		// Getters
		get items() {
			return items;
		},
		get status() {
			return status;
		},
		get error() {
			return error;
		},
		get hasMore() {
			return _hasMore;
		},
		get isLoading() {
			return status === "loading";
		},
		get isEmpty() {
			return status === "loaded" && items.length === 0;
		},

		// Actions
		loadInitial() {
			loadFeed(false);
		},

		loadMore() {
			if (_hasMore && status !== "loading") {
				loadFeed(true);
			}
		},

		reset() {
			items = [];
			status = "idle";
			error = null;
			_hasMore = true;
			nextCursor = null;
		},
	};
}

export type WatchFeedState = ReturnType<typeof createWatchFeedState>;
