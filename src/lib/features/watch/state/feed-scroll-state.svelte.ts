/**
 * Feed Scroll State
 *
 * Reactive state for tracking scroll position, direction, and header visibility.
 * Used by FeedScrollBehavior to control auto-hide header.
 */

class FeedScrollState {
	/** Whether the floating header is currently visible */
	isHeaderVisible = $state(true);

	/** Last recorded scroll Y position */
	lastScrollY = $state(0);

	/** Current scroll direction (null = no scroll yet) */
	scrollDirection = $state<"up" | "down" | null>(null);

	/** Current card index (for snap detection) */
	currentCardIndex = $state(0);

	/** Total scroll distance since direction change */
	scrollDistanceSinceDirectionChange = $state(0);

	showHeader() {
		this.isHeaderVisible = true;
	}

	hideHeader() {
		this.isHeaderVisible = false;
	}

	updateScrollPosition(scrollY: number) {
		const delta = scrollY - this.lastScrollY;
		const newDirection = delta > 0 ? "down" : "up";

		// Reset distance counter on direction change
		if (newDirection !== this.scrollDirection) {
			this.scrollDistanceSinceDirectionChange = 0;
		}

		this.scrollDistanceSinceDirectionChange += Math.abs(delta);
		this.scrollDirection = newDirection;
		this.lastScrollY = scrollY;
	}

	setCurrentCardIndex(index: number) {
		this.currentCardIndex = index;
	}

	reset() {
		this.isHeaderVisible = true;
		this.lastScrollY = 0;
		this.scrollDirection = null;
		this.currentCardIndex = 0;
		this.scrollDistanceSinceDirectionChange = 0;
	}
}

export const feedScrollState = new FeedScrollState();
export type { FeedScrollState };
