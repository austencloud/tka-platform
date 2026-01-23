/**
 * Feed Snap Detector Contract
 *
 * Detects when scroll has settled on a new card.
 * Fires callbacks with the current card index.
 */

export type SnapCallback = (index: number) => void;

export interface IFeedSnapDetector {
	/**
	 * Start monitoring scroll events on a container.
	 * @param container The scrollable element to monitor
	 * @param getItemCount Function returning current number of items
	 */
	attach(container: HTMLElement, getItemCount: () => number): void;

	/**
	 * Stop monitoring scroll events.
	 */
	detach(): void;

	/**
	 * Register a callback to be called when snap completes.
	 * @param callback Function called with the current card index
	 * @returns Unsubscribe function
	 */
	onSnapComplete(callback: SnapCallback): () => void;

	/**
	 * Get the current snapped card index.
	 */
	readonly currentIndex: number;

	/**
	 * Manually set the current index (for initial state).
	 */
	setCurrentIndex(index: number): void;
}
