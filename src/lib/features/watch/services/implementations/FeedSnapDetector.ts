/**
 * Feed Snap Detector Implementation
 *
 * Detects when scroll has settled on a card.
 * Uses native 'scrollend' event when available (modern browsers),
 * falls back to timeout-based detection (150ms after last scroll).
 * Calculates card index from scrollTop / viewportHeight.
 */

type SnapCallback = (index: number) => void;

/** Time after last scroll event to consider scroll "ended" (fallback only) */
const SCROLL_END_TIMEOUT_MS = 100; // Reduced for snappier feel

export class FeedSnapDetector {
	private container: HTMLElement | null = null;
	private getItemCount: (() => number) | null = null;
	private scrollEndTimer: number | null = null;
	private callbacks = new Set<SnapCallback>();
	private _currentIndex = 0;
	private lastFiredIndex = -1;
	private useNativeScrollEnd = false;

	get currentIndex(): number {
		return this._currentIndex;
	}

	attach(container: HTMLElement, getItemCount: () => number): void {
		this.detach();
		this.container = container;
		this.getItemCount = getItemCount;

		// Check for native scrollend support (Chrome 114+, Firefox 109+, Safari 17.4+)
		this.useNativeScrollEnd = "onscrollend" in window;

		if (this.useNativeScrollEnd) {
			// Use native scrollend - fires exactly when scroll settles
			container.addEventListener("scrollend", this.handleScrollEnd, { passive: true });
		} else {
			// Fallback to timeout-based detection
			container.addEventListener("scroll", this.handleScroll, { passive: true });
		}
	}

	detach(): void {
		if (this.container) {
			if (this.useNativeScrollEnd) {
				this.container.removeEventListener("scrollend", this.handleScrollEnd);
			} else {
				this.container.removeEventListener("scroll", this.handleScroll);
			}
			this.container = null;
		}
		if (this.scrollEndTimer !== null) {
			window.clearTimeout(this.scrollEndTimer);
			this.scrollEndTimer = null;
		}
		this.getItemCount = null;
	}

	onSnapComplete(callback: SnapCallback): () => void {
		this.callbacks.add(callback);
		return () => {
			this.callbacks.delete(callback);
		};
	}

	/** Native scrollend handler - fires when scroll actually settles */
	private handleScrollEnd = (): void => {
		this.onScrollEnd();
	};

	/** Fallback scroll handler with timeout detection */
	private handleScroll = (): void => {
		// Clear previous timeout
		if (this.scrollEndTimer !== null) {
			window.clearTimeout(this.scrollEndTimer);
		}

		// Set new timeout
		this.scrollEndTimer = window.setTimeout(() => {
			this.onScrollEnd();
		}, SCROLL_END_TIMEOUT_MS);
	};

	private onScrollEnd(): void {
		if (!this.container || !this.getItemCount) return;

		const viewportHeight = this.container.clientHeight;
		const scrollTop = this.container.scrollTop;
		const itemCount = this.getItemCount();

		if (viewportHeight === 0 || itemCount === 0) return;

		// Calculate which card is in view
		// Round to nearest card (handles partial scrolls)
		const rawIndex = scrollTop / viewportHeight;
		const newIndex = Math.round(rawIndex);

		// Clamp to valid range
		this._currentIndex = Math.max(0, Math.min(newIndex, itemCount - 1));

		// Only fire callback if index changed
		if (this._currentIndex !== this.lastFiredIndex) {
			this.lastFiredIndex = this._currentIndex;
			this.fireCallbacks();
		}
	}

	private fireCallbacks(): void {
		for (const callback of this.callbacks) {
			try {
				callback(this._currentIndex);
			} catch (error) {
				console.error("[FeedSnapDetector] Callback error:", error);
			}
		}
	}
}
