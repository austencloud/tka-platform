/**
 * Feed Loader Contract
 *
 * Interface for loading unified feed content from multiple sources.
 */

import type { FeedPage, FeedQuery } from "../../domain/models/feed-models";

export interface IFeedLoader {
	/**
	 * Load a page of feed items.
	 * Merges videos and sequences into a unified, sorted feed.
	 */
	loadFeedPage(query: FeedQuery): Promise<FeedPage>;
}
