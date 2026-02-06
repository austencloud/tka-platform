/**
 * Feed Snap Detector Contract
 *
 * Interface for detecting scroll snap completion in the feed.
 */

export interface IFeedSnapDetector {
	/**
	 * Attach the detector to a scroll container.
	 */
	attach(container: HTMLElement, getItemCount: () => number): void;

	/**
	 * Detach from the current container.
	 */
	detach(): void;

	/**
	 * Register a callback for snap completion.
	 */
	onSnapComplete(callback: (index: number) => void): void;

	/**
	 * Get the current snap index.
	 */
	get currentIndex(): number;
}
