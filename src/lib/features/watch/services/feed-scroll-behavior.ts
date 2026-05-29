/**
 * Feed Scroll Behavior Implementation
 *
 * Controls header visibility based on scroll direction.
 * - Shows header immediately on any upward scroll
 * - Hides header after 50px scrolled down
 * - Uses 30px threshold for snappier response
 */

import type { FeedScrollState } from "../state/feed-scroll-state.svelte";

/** Minimum scroll delta to trigger direction detection */
const SCROLL_THRESHOLD = 30;

/** Scroll distance needed to hide header when scrolling down */
const HIDE_DISTANCE = 50;

export class FeedScrollBehavior {
	private state: FeedScrollState;

	constructor(scrollState: FeedScrollState) {
		this.state = scrollState;
	}

	get isHeaderVisible(): boolean {
		return this.state.isHeaderVisible;
	}

	handleScroll(scrollY: number): void {
		const delta = scrollY - this.state.lastScrollY;

		// Ignore tiny scroll movements
		if (Math.abs(delta) < SCROLL_THRESHOLD) {
			return;
		}

		// Update state tracking
		this.state.updateScrollPosition(scrollY);

		// At the top - always show header
		if (scrollY <= 0) {
			this.showHeader();
			return;
		}

		if (this.state.scrollDirection === "up") {
			// Show header immediately on scroll up
			this.showHeader();
		} else if (this.state.scrollDirection === "down") {
			// Hide header after scrolling down enough
			if (this.state.scrollDistanceSinceDirectionChange >= HIDE_DISTANCE) {
				this.hideHeader();
			}
		}
	}

	showHeader(): void {
		this.state.showHeader();
	}

	hideHeader(): void {
		this.state.hideHeader();
	}

	reset(): void {
		this.state.reset();
	}
}
