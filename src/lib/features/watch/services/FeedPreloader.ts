/**
 * Feed Preloader Implementation
 *
 * Preloads content based on scroll direction:
 * - Scrolling down: preload 5 ahead, 1 behind
 * - Scrolling up: preload 5 behind, 1 ahead
 */

/** Number of items to preload in scroll direction */
const AHEAD_COUNT = 5;

/** Number of items to keep loaded behind */
const BEHIND_COUNT = 1;

export class FeedPreloader {
	private currentRange: { start: number; end: number } = { start: 0, end: 0 };
	private preloadingUrls = new Set<string>();
	private abortController: AbortController | null = null;

	updatePosition(
		currentIndex: number,
		direction: "up" | "down" | null,
		totalItems: number
	): void {
		let start: number;
		let end: number;

		if (direction === "down" || direction === null) {
			// Default/scrolling down: preload ahead
			start = Math.max(0, currentIndex - BEHIND_COUNT);
			end = Math.min(totalItems - 1, currentIndex + AHEAD_COUNT);
		} else {
			// Scrolling up: preload behind
			start = Math.max(0, currentIndex - AHEAD_COUNT);
			end = Math.min(totalItems - 1, currentIndex + BEHIND_COUNT);
		}

		this.currentRange = { start, end };
	}

	getPreloadRange(): { start: number; end: number } {
		return { ...this.currentRange };
	}

	async preloadVideo(url: string): Promise<void> {
		if (this.preloadingUrls.has(url)) return;
		this.preloadingUrls.add(url);

		try {
			// Create video element to preload metadata
			const video = document.createElement("video");
			video.preload = "metadata";

			await new Promise<void>((resolve, reject) => {
				video.onloadedmetadata = () => resolve();
				video.onerror = () => reject(new Error("Failed to preload video"));
				video.src = url;
			});
		} catch {
			// Preload failed - not critical
		} finally {
			this.preloadingUrls.delete(url);
		}
	}

	async preloadImage(url: string): Promise<void> {
		if (this.preloadingUrls.has(url)) return;
		this.preloadingUrls.add(url);

		try {
			await new Promise<void>((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve();
				img.onerror = () => reject(new Error("Failed to preload image"));
				img.src = url;
			});
		} catch {
			// Preload failed - not critical
		} finally {
			this.preloadingUrls.delete(url);
		}
	}

	cancelAll(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		this.preloadingUrls.clear();
	}

	isInPreloadRange(index: number): boolean {
		return index >= this.currentRange.start && index <= this.currentRange.end;
	}
}
