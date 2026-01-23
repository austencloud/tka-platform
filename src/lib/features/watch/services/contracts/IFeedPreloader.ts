/**
 * Feed Preloader Contract
 *
 * Interface for preloading media content in the feed.
 */

export interface IFeedPreloader {
	/**
	 * Update the current viewing position.
	 * Calculates new preload range based on direction.
	 */
	updatePosition(
		currentIndex: number,
		direction: "up" | "down" | null,
		totalItems: number
	): void;

	/**
	 * Get the current preload range.
	 */
	getPreloadRange(): { start: number; end: number };

	/**
	 * Check if an index is in the current preload range.
	 */
	isInPreloadRange(index: number): boolean;

	/**
	 * Preload a video URL.
	 */
	preloadVideo(url: string): void;

	/**
	 * Preload an image URL.
	 */
	preloadImage(url: string): void;

	/**
	 * Cancel all pending preloads.
	 */
	cancelAll(): void;
}
