/**
 * Feed Preloader Contract
 *
 * Handles directional preloading of feed content.
 * Preloads 5 items ahead and 1 behind based on scroll direction.
 */

export interface PreloadRange {
	start: number;
	end: number;
}

export interface PreloadItem {
	type: "video" | "image";
	url: string;
}

export interface IFeedPreloader {
	/**
	 * Update the preloader with new scroll position and direction.
	 * @param currentIndex Current card index
	 * @param direction Scroll direction
	 * @param totalItems Total number of items in feed
	 */
	updatePosition(
		currentIndex: number,
		direction: "up" | "down" | null,
		totalItems: number
	): PreloadRange;

	/**
	 * Get the range of items that should be preloaded.
	 */
	getPreloadRange(): PreloadRange;

	/**
	 * Preload a video (loads metadata + first frame).
	 * @param url Video URL
	 */
	preloadVideo(url: string): Promise<void>;

	/**
	 * Preload an image into browser cache.
	 * @param url Image URL
	 */
	preloadImage(url: string): Promise<void>;

	/**
	 * Cancel all pending preloads.
	 */
	cancelAll(): void;

	/**
	 * Check if an index is within the preload range.
	 */
	isInPreloadRange(index: number): boolean;
}
