/**
 * Feed Scroll Behavior Contract
 *
 * Interface for managing scroll-based UI behavior (auto-hide header, etc).
 */

export interface IFeedScrollBehavior {
	/**
	 * Handle a scroll event. Updates header visibility based on direction.
	 */
	handleScroll(scrollY: number): void;

	/**
	 * Reset scroll behavior state.
	 */
	reset(): void;
}
