/**
 * Feed Scroll Behavior Contract
 *
 * Manages header visibility based on scroll direction.
 * Shows header on scroll up, hides on scroll down after threshold.
 */

export interface IFeedScrollBehavior {
	/**
	 * Process a scroll event and update header visibility.
	 * @param scrollY Current scroll position
	 */
	handleScroll(scrollY: number): void;

	/**
	 * Force show the header (e.g., when reaching top)
	 */
	showHeader(): void;

	/**
	 * Force hide the header
	 */
	hideHeader(): void;

	/**
	 * Reset scroll tracking state
	 */
	reset(): void;

	/**
	 * Whether the header is currently visible
	 */
	readonly isHeaderVisible: boolean;
}
